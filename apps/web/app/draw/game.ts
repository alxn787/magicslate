import { Tool } from "../components/MainCanvas";
import { getExistingShapes } from "./http";


type Shape =  {
    type:"rect";
    x:number;
    y:number;
    width:number;
    height:number;
    id:string;
} | {
    type:"circle";
    centerX:number;
    centerY:number;
    radius:number;
    id:string;
} | {
    type:"pencil";
    points: {x: number, y: number}[];
    color: string;
    lineWidth: number;
    id:string;
}

export class Game{

    private canvas : HTMLCanvasElement
    private ctx : CanvasRenderingContext2D
    private existingShapes:Shape[] = [];
    private roomId:string;
    private token:string;
    private socket:WebSocket;
    private clicked : boolean 
    private startX = 0;
    private startY = 0;
    private selectedTool: Tool = 'circle'
    private currentPoints: {x: number, y: number}[] = [];
    private pencilColor: string = "rgba(255,0,255)";
    private pencilLineWidth: number = 1;
    private scale = 1;
    
    // Selection and moving properties
    private selectedShape: Shape | null = null;
    private isMoving: boolean = false;
    private moveOffsetX: number = 0;
    private moveOffsetY: number = 0;

    constructor(canvas:HTMLCanvasElement,roomId:string,token:string, socket:WebSocket ){
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.roomId = roomId;
        this.token = token;
        this.socket = socket
        this.clicked = false;
        this.init()
        this.initHandler();
        this.initMouseHandler();
    }

    destroy(){
        this.canvas.removeEventListener('mousedown', this.MouseDownHandler);
        this.canvas.removeEventListener("mouseup", this.MouseUpHandler);
        this.canvas.removeEventListener("mousemove", this.MouseMoveHandler);
    }

    setTool(Tool:Tool){
        this.selectedTool =  Tool;
        // Deselect when changing tools
        if (Tool !== 'select') {
            this.selectedShape = null;
        }
    }

    setPencilColor(color: string) {
        this.pencilColor = color;
    }

    setPencilLineWidth(width: number) {
        this.pencilLineWidth = width;
    }

    zoomIn() {
        this.scale *= 1.2;
        if (this.scale > 10) this.scale = 10; // Limit max zoom
        this.ClearCanvas();
    }
    
    zoomOut() {
        this.scale /= 1.2;
        if (this.scale < 0.1) this.scale = 0.1; // Limit min zoom
        this.ClearCanvas();
    }
    
    resetZoom() {
        this.scale = 1;
        this.ClearCanvas();
    }

    clearSlate(){
        this.socket.send(JSON.stringify({
            type: "clearslate",
            roomId: this.roomId
        }));
        this.existingShapes = [];
        this.selectedShape = null;
        this.ClearCanvas(); 
    }
    
    async init(){
        this.existingShapes = await getExistingShapes(this.roomId ,this.token);
        this.ClearCanvas();
    }

    initHandler(){
        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if(message.type == "chat"){
                const parsedShape = JSON.parse(message.message);
                this.existingShapes.push(parsedShape);
                this.ClearCanvas();
            }
            else if(message.type == "clearslate"){
                this.existingShapes = [];
                this.selectedShape = null;
                this.ClearCanvas();
            }
            else if(message.type == "updateShape") {
                const updatedShape = JSON.parse(message.shape);
                const index = this.existingShapes.findIndex(shape => shape.id === updatedShape.id);
                if (index !== -1) {
                    this.existingShapes[index] = updatedShape;
                    this.ClearCanvas();
                }
            }
        };
    }

    ClearCanvas(){
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "rgba(0,0,0)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.existingShapes.map(shape => {
            const isSelected = this.selectedShape && shape.id === this.selectedShape.id;
            
            if(shape.type == "rect"){
                // Draw the rectangle
                this.ctx.strokeStyle = "rgba(255,0,255)";        
                this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
                
                // If selected, draw selection indicators
                if (isSelected) {
                    this.drawSelectionBox(shape);
                }
            }
            else if(shape.type == "circle"){
                this.ctx.strokeStyle = "rgba(255,0,255)";  
                this.ctx.beginPath();
                this.ctx.arc(shape.centerX, shape.centerY, shape.radius, 0, 2 * Math.PI);
                this.ctx.stroke();
                this.ctx.closePath();
                
                // If selected, draw selection indicators
                if (isSelected) {
                    this.drawSelectionBox(shape);
                }
            }
            else if(shape.type == "pencil") {
                this.ctx.strokeStyle = shape.color || this.pencilColor;
                this.ctx.lineWidth = shape.lineWidth || this.pencilLineWidth;
                this.ctx.lineJoin = "round";
                this.ctx.lineCap = "round";
                
                this.ctx.beginPath();
                if(shape.points.length == 0) return;
                //@ts-ignore
                this.ctx.moveTo(shape.points[0].x, shape.points[0].y);
                
                for (let i = 1; i < shape.points.length; i++) {
                    if(!shape.points[i]) return;
                    //@ts-ignore
                    this.ctx.lineTo(shape.points[i].x, shape.points[i].y);
                }
                this.ctx.stroke();
                this.ctx.closePath();
                this.ctx.lineWidth = 1;
                
                // If selected, draw selection indicators
                if (isSelected) {
                    this.drawSelectionBox(shape);
                }
            }
        });
    }
    
    // Draw selection box around the selected shape
    drawSelectionBox(shape: Shape) {
        this.ctx.strokeStyle = "rgba(0,255,255,0.8)";
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        
        if (shape.type === "rect") {
            this.ctx.strokeRect(shape.x - 5, shape.y - 5, shape.width + 10, shape.height + 10);
        } else if (shape.type === "circle") {
            this.ctx.strokeRect(
                shape.centerX - shape.radius - 5,
                shape.centerY - shape.radius - 5,
                shape.radius * 2 + 10,
                shape.radius * 2 + 10
            );
        } else if (shape.type === "pencil") {
            // Calculate bounding box for pencil points
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            
            for (const point of shape.points) {
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
            }
            
            this.ctx.strokeRect(minX - 5, minY - 5, maxX - minX + 10, maxY - minY + 10);
        }
        
        this.ctx.setLineDash([]);
        this.ctx.lineWidth = 1;
    }
    
    // Check if a point is inside a shape
    isPointInShape(x: number, y: number, shape: Shape): boolean {
        if (shape.type === "rect") {
            return x >= shape.x && x <= shape.x + shape.width && 
                   y >= shape.y && y <= shape.y + shape.height;
        } else if (shape.type === "circle") {
            const dx = x - shape.centerX;
            const dy = y - shape.centerY;
            return dx * dx + dy * dy <= shape.radius * shape.radius;
        } else if (shape.type === "pencil") {
            // For pencil, check if the point is near any line segment
            const tolerance = 5; // Pixel tolerance for selection
            
            for (let i = 0; i < shape.points.length; i++) {
                const p1 = shape.points[i-1];
                const p2 = shape.points[i];
                
                // Distance from point to line
                // segment
                if(!p1 || !p2) return false
                const distance = this.pointToLineDistance(x, y, p1.x, p1.y, p2.x, p2.y);
                if (distance <= tolerance) {
                    return true;
                }
            }
            return false;
        }
        return false;
    }
    
    // Calculate distance from point to line segment
    pointToLineDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        
        if (len_sq !== 0) {
            param = dot / len_sq;
        }
        
        let xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // Find the shape at given coordinates
    findShapeAt(x: number, y: number): Shape | null {
        // Search in reverse order to select the top-most shape
        for (let i = this.existingShapes.length - 1; i >= 0; i--) {
            const shape = this.existingShapes[i];
            if(!shape)return null;
            if (this.isPointInShape(x, y, shape)) {
                return shape;
            }
        }
        return null;
    }
    
    // Move selected shape
    moveSelectedShape(dx: number, dy: number) {
        if (!this.selectedShape) return;
        
        const shape = this.selectedShape;
        const updatedShape = { ...shape };
        if(!shape && updatedShape)return;
        
        if (updatedShape.type === "rect") {
            updatedShape.x += dx;
            updatedShape.y += dy;
        } else if (updatedShape.type === "circle") {
            updatedShape.centerX += dx;
            updatedShape.centerY += dy;
        } else if (shape.type === "pencil") {
            updatedShape.points = shape.points.map(point => ({
                x: point.x + dx,
                y: point.y + dy
            }));
        }
        
        // Update the shape in our local array
        const index = this.existingShapes.findIndex(s => s.id === shape.id);
        if (index !== -1) {
            this.existingShapes[index] = updatedShape;
            this.selectedShape = updatedShape;
        }
        
        // Send update to other clients
        this.socket.send(JSON.stringify({
            type: "updateShape",
            roomId: this.roomId,
            shape: JSON.stringify(updatedShape)
        }));
        
        this.ClearCanvas();
    }

    MouseDownHandler = (e:MouseEvent) => {
        this.clicked = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
        
        if (this.selectedTool === "select") {
            // Try to select a shape
            const shape = this.findShapeAt(e.clientX, e.clientY);
            
            if (shape) {
                this.selectedShape = shape;
                this.isMoving = true;
                
                // Calculate offset for smoother dragging
                if (shape.type === "rect") {
                    this.moveOffsetX = e.clientX - shape.x;
                    this.moveOffsetY = e.clientY - shape.y;
                } else if (shape.type === "circle") {
                    this.moveOffsetX = e.clientX - shape.centerX;
                    this.moveOffsetY = e.clientY - shape.centerY;
                } else if (shape.type === "pencil" && shape.points.length > 0) {
                    // Use the first point as
                    // reference
                    //@ts-ignore
                    this.moveOffsetX = e.clientX - shape.points[0].x;
                    //@ts-ignore
                    this.moveOffsetY = e.clientY - shape.points[0].y;
                }
            } else {
                // Clicked on empty space, deselect
                this.selectedShape = null;
            }
            
            this.ClearCanvas();
        } else if (this.selectedTool === "pencil") {
            this.currentPoints = [{x: e.clientX, y: e.clientY}];
        }
    }

    MouseUpHandler = (e:MouseEvent) => {
        this.clicked = false;
        
        if (this.selectedTool === "select") {
            // End moving operation
            this.isMoving = false;
            return;
        }
        
        const width = e.clientX - this.startX;
        const height = e.clientY - this.startY;
    
        let shape: Shape;
        if (this.selectedTool === "pencil") {
            if(this.currentPoints.length < 2) return;
            shape = {
                type: "pencil",
                points: [...this.currentPoints],
                color: this.pencilColor,
                lineWidth: this.pencilLineWidth,
                id: crypto.randomUUID()
            };
            this.existingShapes.push(shape);
            this.socket.send(JSON.stringify({
                type: "chat",
                message: JSON.stringify(shape),
                roomId: this.roomId
            }));
            this.currentPoints = [];
            return;
        }
    
        else if (this.selectedTool === "rect") {
            shape = {
                type: "rect",
                x: this.startX,
                y: this.startY,
                width,
                height,
                id: crypto.randomUUID()
            };
        } else if (this.selectedTool === "circle") {
            const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
            const centerX = this.startX + width / 2;
            const centerY = this.startY + height / 2;
    
            shape = {
                type: "circle",
                centerX,
                centerY,
                radius,
                id: crypto.randomUUID()
            };
        } else {
            return;
        }
    
        this.existingShapes.push(shape);
        this.socket.send(JSON.stringify({
            type: "chat",
            message: JSON.stringify(shape),
            roomId: this.roomId
        }));
    
        this.ClearCanvas();
    }

    MouseMoveHandler = (e:MouseEvent) => {
        if (!this.clicked) return;
        
        if (this.selectedTool === "select" && this.isMoving && this.selectedShape) {
            // Calculate the movement delta
            const dx = e.clientX - this.startX;
            const dy = e.clientY - this.startY;
            
            // Move the selected shape
            this.moveSelectedShape(dx, dy);
            
            // Update start position for next move
            this.startX = e.clientX;
            this.startY = e.clientY;
            return;
        }
        
        const width = e.clientX - this.startX;
        const height = e.clientY - this.startY;
           
        this.ClearCanvas();
        this.ctx.strokeStyle = "rgba(255,0,255)";    
        const selectedTool = this.selectedTool;
        
        if (selectedTool === "rect") {
            this.ctx.strokeRect(this.startX, this.startY, width, height);
        }
        else if (selectedTool === "circle") {
            const radius = Math.max(Math.abs(height), Math.abs(width)) / 2;
            const centerX = (this.startX + width / 2);
            const centerY = (this.startY + height / 2);
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            this.ctx.stroke();  
            this.ctx.closePath();
        }
        else if (selectedTool === "pencil") {
            this.currentPoints.push({x: e.clientX, y: e.clientY});
            this.ClearCanvas();
            this.ctx.strokeStyle = this.pencilColor;
            this.ctx.lineWidth = this.pencilLineWidth;
            this.ctx.lineJoin = "round";
            this.ctx.lineCap = "round";
            
            this.ctx.beginPath();
            if (this.currentPoints.length === 0) return;
            //@ts-ignore
            this.ctx.moveTo(this.currentPoints[0].x, this.currentPoints[0].y);
            
            for (let i = 1; i < this.currentPoints.length; i++) {
                if (!this.currentPoints[i]) return;
                //@ts-ignore
                this.ctx.lineTo(this.currentPoints[i].x, this.currentPoints[i].y);
            }
            this.ctx.stroke();
            this.ctx.closePath();
            this.ctx.lineWidth = 1;
        }
    }
    
    initMouseHandler() {
        this.canvas.addEventListener('mousedown', this.MouseDownHandler);
        this.canvas.addEventListener("mouseup", this.MouseUpHandler);
        this.canvas.addEventListener("mousemove", this.MouseMoveHandler);
    }
}