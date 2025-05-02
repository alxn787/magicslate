import { Tool } from "../components/MainCanvas";
import { DrawingProperties } from "../components/Sidebar";
import { getExistingShapes } from "./http";

type BaseShapeStyle = {
    strokeColor: string;
    strokeWidth: number;
    fillColor: string;
    opacity: number;
    id: string;
}


type Shape = ({
    type: "rect";
    x: number;
    y: number;
    width: number;
    height: number;
} & BaseShapeStyle) | ({
    type: "circle";
    centerX: number;
    centerY: number;
    radius: number;
} & BaseShapeStyle) | ({
    type: "pencil";
    points: { x: number, y: number }[];
} & BaseShapeStyle);

export class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private existingShapes: Shape[] = [];
    private roomId: string;
    private token: string;
    private socket: WebSocket;
    private clicked: boolean;
    private startX = 0;
    private startY = 0;
    private selectedTool: Tool = 'circle';
    private currentPoints: { x: number, y: number }[] = [];
    private pencilColor: string = "rgba(255,0,255)"; // Note: This seems redundant with drawingProperties.strokeColor for 'pencil' type
    private pencilLineWidth: number = 1; // Note: This seems redundant with drawingProperties.strokeWidth for 'pencil' type
    private scale = 1;

    private selectedShape: Shape | null = null;
    private isMoving: boolean = false;
    private moveOffsetX: number = 0;
    private moveOffsetY: number = 0;

    private drawingProperties: DrawingProperties = {
        strokeColor: "#1a1c2c",
        strokeWidth: 2,
        fillColor: "transparent",
        opacity: 1
    };

    constructor(canvas: HTMLCanvasElement, roomId: string, token: string, socket: WebSocket) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.roomId = roomId;
        this.token = token;
        this.socket = socket;
        this.clicked = false;
        this.init();
        this.initHandler();
        this.initMouseHandler();
    }

    destroy() {
        this.canvas.removeEventListener('mousedown', this.MouseDownHandler);
        this.canvas.removeEventListener("mouseup", this.MouseUpHandler);
        this.canvas.removeEventListener("mousemove", this.MouseMoveHandler);
    }

    setTool(tool: Tool) {
        this.selectedTool = tool;
        if (tool !== 'select') {
            this.selectedShape = null;
        }
    }

    setPencilColor(color: string) {
        this.pencilColor = color; // This will be updated to use drawingProperties.strokeColor
    }

    setPencilLineWidth(width: number) {
        this.pencilLineWidth = width; // This will be updated to use drawingProperties.strokeWidth
    }

    setDrawingProperties(props: DrawingProperties): void {
        this.drawingProperties = props;
         // When drawing properties are updated, redraw to show potential changes on selected shape if applicable
        this.ClearCanvas();
    }

    // This method should apply styles based on the shape being drawn, not global properties
    private applyShapeStyles(ctx: CanvasRenderingContext2D, shape: Shape) {
        ctx.strokeStyle = shape.strokeColor;
        ctx.lineWidth = shape.strokeWidth;

        if (shape.fillColor !== "transparent") {
            const { fillColor, opacity } = shape;
            const r = parseInt(fillColor.slice(1, 3), 16);
            const g = parseInt(fillColor.slice(3, 5), 16);
            const b = parseInt(fillColor.slice(5, 7), 16);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        } else {
            ctx.fillStyle = "transparent";
        }
    }


    zoomIn() {
        this.scale = Math.min(this.scale * 1.2, 10);
        this.ClearCanvas();
    }

    zoomOut() {
        this.scale = Math.max(this.scale / 1.2, 0.1);
        this.ClearCanvas();
    }

    resetZoom() {
        this.scale = 1;
        this.ClearCanvas();
    }

    clearSlate() {
        this.socket.send(JSON.stringify({ type: "clearslate", roomId: this.roomId }));
        this.existingShapes = [];
        this.selectedShape = null;
        this.ClearCanvas();
        this.selectedTool = "select";
    }

    async init() {
        this.existingShapes = await getExistingShapes(this.roomId, this.token);
        this.ClearCanvas();
    }

    initHandler() {
        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === "chat") {
                const parsedShape = JSON.parse(message.message);
                this.existingShapes.push(parsedShape);
                this.ClearCanvas();
            } else if (message.type === "clearslate") {
                this.existingShapes = [];
                this.selectedShape = null;
                this.ClearCanvas();
            } else if (message.type === "updateShape") {
                const updatedShape = JSON.parse(message.shape);
                const index = this.existingShapes.findIndex(s => s.id === updatedShape.id);
                if (index !== -1) {
                    this.existingShapes[index] = updatedShape;
                    this.ClearCanvas();
                }
            }
        };
    }

    ClearCanvas() {
        // Clear the entire canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Redraw the background (optional, based on desired behavior)
        this.ctx.fillStyle = "black"; // Or any desired background color
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);


        for (const shape of this.existingShapes) {
            const isSelected = this.selectedShape && shape.id === this.selectedShape.id;

            // Apply styles specific to this shape
            this.applyShapeStyles(this.ctx, shape);

            if (shape.type === "rect") {
                this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
                if (this.ctx.fillStyle !== 'transparent') {
                    this.ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
                }
            } else if (shape.type === "circle") {
                this.ctx.beginPath();
                this.ctx.arc(shape.centerX, shape.centerY, shape.radius, 0, 2 * Math.PI);
                this.ctx.stroke();
                if (this.ctx.fillStyle !== 'transparent') {
                    this.ctx.fill();
                }
                this.ctx.closePath();
            } else if (shape.type === "pencil") {
                this.ctx.lineJoin = "round";
                this.ctx.lineCap = "round";
                this.ctx.beginPath();
                //@ts-ignore
                this.ctx.moveTo(shape.points[0].x, shape.points[0].y);
                for (let i = 1; i < shape.points.length; i++) {
                    //@ts-ignore
                    this.ctx.lineTo(shape.points[i].x, shape.points[i].y);
                }
                this.ctx.stroke();
                this.ctx.closePath();
                // Restore default line width after drawing pencil line
                this.ctx.lineWidth = this.drawingProperties.strokeWidth; // Or reset to a global default if needed
            }

            if (isSelected) {
                this.drawSelectionBox(shape);
            }
        }
         // Restore default drawing properties for potential temporary drawings in MouseMoveHandler
        this.applyDrawingStylesForTemporaryDrawing();
    }

    // Method to apply drawing properties for temporary shapes drawn during mouse move
     private applyDrawingStylesForTemporaryDrawing(useFill = false) {
        this.ctx.strokeStyle = this.drawingProperties.strokeColor;
        this.ctx.lineWidth = this.drawingProperties.strokeWidth;
        if (useFill && this.drawingProperties.fillColor !== "transparent") {
            const { fillColor, opacity } = this.drawingProperties;
            const r = parseInt(fillColor.slice(1, 3), 16);
            const g = parseInt(fillColor.slice(3, 5), 16);
            const b = parseInt(fillColor.slice(5, 7), 16);
            this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        } else {
            this.ctx.fillStyle = "transparent";
        }
    }


    drawSelectionBox(shape: Shape) {
        this.ctx.strokeStyle = "rgba(0,255,255,0.8)";
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);

        if (shape.type === "rect") {
            this.ctx.strokeRect(shape.x - 5, shape.y - 5, shape.width + 10, shape.height + 10);
        } else if (shape.type === "circle") {
            this.ctx.strokeRect(shape.centerX - shape.radius - 5, shape.centerY - shape.radius - 5, shape.radius * 2 + 10, shape.radius * 2 + 10);
        } else if (shape.type === "pencil") {
            const points = shape.points;
            const minX = Math.min(...points.map(p => p.x));
            const maxX = Math.max(...points.map(p => p.x));
            const minY = Math.min(...points.map(p => p.y));
            const maxY = Math.max(...points.map(p => p.y));
            this.ctx.strokeRect(minX - 5, minY - 5, maxX - minX + 10, maxY - minY + 10);
        }

        this.ctx.setLineDash([]);
        // Restore default line width after drawing selection box
         this.ctx.lineWidth = this.drawingProperties.strokeWidth; // Or reset to a global default if needed
    }

    isPointInShape(x: number, y: number, shape: Shape): boolean {
        if (shape.type === "rect") {
            return x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height;
        } else if (shape.type === "circle") {
            const dx = x - shape.centerX;
            const dy = y - shape.centerY;
            return dx * dx + dy * dy <= shape.radius * shape.radius;
        } else if (shape.type === "pencil") {
             // Increased padding for easier selection of pencil lines
            const padding = 10;
            const points = shape.points;
            if (points.length < 2) return false;

            const minX = Math.min(...points.map(p => p.x)) - padding;
            const maxX = Math.max(...points.map(p => p.x)) + padding;
            const minY = Math.min(...points.map(p => p.y)) - padding;
            const maxY = Math.max(...points.map(p => p.y)) + padding;

            // Quick check if point is within the bounding box of the pencil line
            if (x < minX || x > maxX || y < minY || y > maxY) return false;

             // Tolerance for how close the point needs to be to the line segment
            const tolerance = shape.strokeWidth / 2 + padding; // Tolerance based on stroke width and padding

            for (let i = 1; i < points.length; i++) {
                const p1 = points[i - 1];
                const p2 = points[i];
                 //@ts-ignore - points are guaranteed to have x and y
                const d = this.pointToLineDistance(x, y, p1, p2);
                if (d <= tolerance) return true;
            }
            return false;
        }
        return false;
    }

    pointToLineDistance(px: number, py: number, p1: { x: number, y: number }, p2: { x: number, y: number }): number {
        const A = px - p1.x;
        const B = py - p1.y;
        const C = p2.x - p1.x;
        const D = p2.y - p1.y;

        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;

        if (len_sq !== 0) {
             param = dot / len_sq;
        }


        let xx, yy;

        if (param < 0) {
            xx = p1.x;
            yy = p1.y;
        } else if (param > 1) {
            xx = p2.x;
            yy = p2.y;
        } else {
            xx = p1.x + param * C;
            yy = p1.y + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }


    findShapeAt(x: number, y: number): Shape | null {
        // Iterate in reverse order to select the topmost shape
        for (let i = this.existingShapes.length - 1; i >= 0; i--) {
            const shape = this.existingShapes[i];
            if (!shape) return null; // Should not happen, but as a safeguard
            if (this.isPointInShape(x, y, shape)) {
                return shape;
            }
        }
        return null;
    }

    moveSelectedShape(dx: number, dy: number) {
        if (!this.selectedShape) return;

        // Create a mutable copy for updates
        const updated: Shape = JSON.parse(JSON.stringify(this.selectedShape));

        if (updated.type === "rect") {
            updated.x += dx;
            updated.y += dy;
        } else if (updated.type === "circle") {
            updated.centerX += dx;
            updated.centerY += dy;
        } else if (updated.type === "pencil") {
            updated.points = updated.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
        }

        const index = this.existingShapes.findIndex(s => s.id === updated.id);
        if (index !== -1) {
             this.existingShapes[index] = updated;
        }

        // Update the selectedShape reference to the modified object
        this.selectedShape = updated;


        this.socket.send(JSON.stringify({ type: "updateShape", roomId: this.roomId, shape: JSON.stringify(updated) }));
        this.ClearCanvas();
    }

    MouseDownHandler = (e: MouseEvent) => {
        this.clicked = true;
        this.startX = e.clientX;
        this.startY = e.clientY;

        if (this.selectedTool === "select") {
            const shape = this.findShapeAt(e.clientX, e.clientY);
            if (shape) {
                this.selectedShape = shape;
                this.isMoving = true;
                 // Calculate offset based on the specific shape type
                if (shape.type === "rect") {
                    this.moveOffsetX = e.clientX - shape.x;
                    this.moveOffsetY = e.clientY - shape.y;
                } else if (shape.type === "circle") {
                    this.moveOffsetX = e.clientX - shape.centerX;
                    this.moveOffsetY = e.clientY - shape.centerY;
                } else if (shape.type === "pencil") {
                     // For pencil, use the first
                     // point for offset
                     // calculation
                     //@ts-ignore
                    this.moveOffsetX = e.clientX - shape.points[0].x;
                     //@ts-ignore   
                    this.moveOffsetY = e.clientY - shape.points[0].y;
                }
            } else {
                this.selectedShape = null;
            }
            this.ClearCanvas(); // Redraw to show selection box or remove it
        } else if (this.selectedTool === "pencil") {
            this.currentPoints = [{ x: e.clientX, y: e.clientY }];
        }
    }

    MouseUpHandler = (e: MouseEvent) => {
        this.clicked = false;

        if (this.selectedTool === "select") {
            this.isMoving = false;
             // Redraw to remove the temporary moving visual if any
            this.ClearCanvas();
            return;
        }

        const width = e.clientX - this.startX;
        const height = e.clientY - this.startY;

        let shape: Shape | null = null;

        // Use drawingProperties for the new shape being created
        const newShapeStyle: BaseShapeStyle = {
            strokeColor: this.drawingProperties.strokeColor,
            strokeWidth: this.drawingProperties.strokeWidth,
            fillColor: this.drawingProperties.fillColor,
            opacity: this.drawingProperties.opacity,
            id: crypto.randomUUID()
        };


        if (this.selectedTool === "pencil") {
            if (this.currentPoints.length < 2) {
                this.currentPoints = []; // Clear points if not enough to form a line
                return;
            }
            shape = {
                type: "pencil",
                points: [...this.currentPoints],
                ...newShapeStyle
            };
            this.currentPoints = [];
        } else if (this.selectedTool === "rect") {
             // Ensure positive width and height for rect creation
             const x = width > 0 ? this.startX : e.clientX;
             const y = height > 0 ? this.startY : e.clientY;
             const w = Math.abs(width);
             const h = Math.abs(height);

            shape = {
                type: "rect",
                x: x,
                y: y,
                width: w,
                height: h,
                ...newShapeStyle
            };
        } else if (this.selectedTool === "circle") {
             // Calculate center and radius for circle creation
            const radius = Math.sqrt(width * width + height * height) / 2; // Use distance for radius
            const centerX = this.startX + width / 2;
            const centerY = this.startY + height / 2;
            shape = {
                type: "circle",
                centerX,
                centerY,
                radius,
                ...newShapeStyle
            };
        }

        if (shape) {
            this.existingShapes.push(shape);
            this.socket.send(JSON.stringify({ type: "chat", message: JSON.stringify(shape), roomId: this.roomId }));
            this.ClearCanvas(); // Redraw with the new shape added
        } else {
             // If no shape was created (e.g., a single click with pencil), just redraw to clear temporary drawing
            this.ClearCanvas();
        }
    }

    MouseMoveHandler = (e: MouseEvent) => {
        if (!this.clicked) return;

        if (this.selectedTool === "select" && this.isMoving && this.selectedShape) {
            const dx = e.clientX - this.startX;
            const dy = e.clientY - this.startY;
             // Move the shape visually immediately
            this.moveSelectedShape(dx, dy);
            this.startX = e.clientX;
            this.startY = e.clientY;
            return; // Exit to prevent drawing temporary shapes while moving
        }

         // Only draw temporary shape if a drawing tool is selected
        if (this.selectedTool === "rect" || this.selectedTool === "circle" || this.selectedTool === "pencil") {
            this.ClearCanvas(); // Clear previous temporary drawing and redraw existing shapes

            const width = e.clientX - this.startX;
            const height = e.clientY - this.startY;

             // Apply current drawing styles for the temporary shape
            this.applyDrawingStylesForTemporaryDrawing(true);


            if (this.selectedTool === "rect") {
                this.ctx.strokeRect(this.startX, this.startY, width, height);
                 if (this.ctx.fillStyle !== 'transparent') {
                    this.ctx.fillRect(this.startX, this.startY, width, height);
                }
            } else if (this.selectedTool === "circle") {
                const radius = Math.sqrt(width * width + height * height) / 2; // Use distance for radius
                const centerX = this.startX + width / 2;
                const centerY = this.startY + height / 2;
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                this.ctx.stroke();
                 if (this.ctx.fillStyle !== 'transparent') {
                    this.ctx.fill();
                }
                this.ctx.closePath();
            } else if (this.selectedTool === "pencil") {
                this.currentPoints.push({ x: e.clientX, y: e.clientY });
                 // Use drawingProperties for pencil tool during drawing
                this.ctx.strokeStyle = this.drawingProperties.strokeColor;
                this.ctx.lineWidth = this.drawingProperties.strokeWidth;
                this.ctx.lineJoin = "round";
                this.ctx.lineCap = "round";

                this.ctx.beginPath();
                 //@ts-ignore
                this.ctx.moveTo(this.currentPoints[0].x, this.currentPoints[0].y);
                for (let i = 1; i < this.currentPoints.length; i++) {
                     //@ts-ignore
                    this.ctx.lineTo(this.currentPoints[i].x, this.currentPoints[i].y);
                }
                this.ctx.stroke();
                this.ctx.closePath();
                 // Restore default line width after drawing temporary pencil line
                this.ctx.lineWidth = this.drawingProperties.strokeWidth; // Or reset to a global default if needed
            }
        }
    }

    initMouseHandler() {
        this.canvas.addEventListener('mousedown', this.MouseDownHandler);
        this.canvas.addEventListener("mouseup", this.MouseUpHandler);
        this.canvas.addEventListener("mousemove", this.MouseMoveHandler);
    }
}