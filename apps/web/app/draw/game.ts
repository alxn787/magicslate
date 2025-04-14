import { ClearCanvas } from ".";
import { Tool } from "../components/MainCanvas";
import { getExistingShapes } from "./http";


type Shape =  {
    type:"rect";
    x:number;
    y:number;
    width:number;
    height:number;
} | {
    type:"circle";
    centerX:number;
    centerY:number;
    radius:number;
} | {
    type:"pencil";
    points: {x: number, y: number}[];
    color: string;
    lineWidth: number;
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
        };
    }

    ClearCanvas(){
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "rgba(0,0,0)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.existingShapes.map(shape=>{
            if(shape.type == "rect"){
                this.ctx.strokeStyle = "rgba(255,0,255)";        
                this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
            }
            else if(shape.type == "circle"){
                this.ctx.strokeStyle = "rgba(255,0,255)";  
                this.ctx.beginPath();
                this.ctx.arc(shape.centerX, shape.centerY, shape.radius, 0, 2 * Math.PI);
                this.ctx.stroke();
                this.ctx.closePath();
            }
            else if(shape.type == "pencil") {
                this.ctx.strokeStyle = shape.color || this.pencilColor;
                this.ctx.lineWidth = shape.lineWidth || this.pencilLineWidth;
                this.ctx.lineJoin = "round";
                this.ctx.lineCap = "round";
                
                this.ctx.beginPath();
                if(shape.points.length == 0) return;
               // @ts-ignore
                this.ctx.moveTo(shape.points[0].x, shape.points[0].y);
                
                for (let i = 1; i < shape.points.length; i++) {
                    if(!shape.points[i]) return;
                    //@ts-ignore
                    this.ctx.lineTo(shape.points[i].x, shape.points[i].y);
                }
                this.ctx.stroke();
                this.ctx.closePath();
                this.ctx.lineWidth = 1;
            }else if(this.selectedTool == "zoomIn"){
                this.ctx.scale(1.1,1.1);
                this.selectedTool = "circle";
            }else if(this.selectedTool == "zoomOut"){
                this.ctx.scale(0.9,0.9);
                this.selectedTool = "circle";
            }
        }) 

    }
    

    MouseDownHandler = (e:MouseEvent)=>{
        this.clicked = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
        if(this.selectedTool == "pencil"){
            this.currentPoints = [{x:e.clientX,y:e.clientY}];
        }
    }

    MouseUpHandler = (e:MouseEvent)=>{
        this.clicked = false;
        const width = e.clientX - this.startX;
        const height = e.clientY - this.startY;
    
        let shape: Shape;
        if (this.selectedTool === "pencil") {
            if(this.currentPoints.length < 2) return;
            shape = {
                type: "pencil",
                points: [...this.currentPoints],
                color: this.pencilColor,
                lineWidth: this.pencilLineWidth
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
                height
            };
        } else if (this.selectedTool === "circle") {
            const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
            const centerX = this.startX + width / 2;
            const centerY = this.startY + height / 2;
    
            shape = {
                type: "circle",
                centerX,
                centerY,
                radius
            };
        }
         else {
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

    MouseMoveHandler = (e:MouseEvent)=>{
        if(!this.clicked) return;
            const width =  e.clientX - this.startX;
            const height = e.clientY - this.startY;
            console.log(width,height)
           
            this.ClearCanvas();
            this.ctx.strokeStyle = "rgba(255,0,255)";    
            const selectedTool = this.selectedTool
            if(selectedTool == "rect"){
                this.ctx.strokeRect(this.startX, this.startY, width, height);
            }
            else if(selectedTool == "circle"){
                const radius = Math.max(Math.abs(height),Math.abs(width))/2;
                const centerX = (this.startX + width/2);
                const centerY = (this.startY + height/2);
                console.log(centerX,centerY,radius);
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                this.ctx.stroke();  
                this.ctx.closePath();
            }
            else if(selectedTool == "pencil"){
                this.currentPoints.push({x:e.clientX,y:e.clientY});
                this.ClearCanvas();
                this.ctx.strokeStyle = this.pencilColor;
                this.ctx.lineWidth = this.pencilLineWidth;
                this.ctx.lineJoin = "round";
                this.ctx.lineCap = "round";
                
                this.ctx.beginPath();
                if(this.currentPoints.length == 0) return;
                //@ts-ignore
                this.ctx.moveTo(this.currentPoints[0].x, this.currentPoints[0].y);
                
                for (let i = 1; i < this.currentPoints.length; i++) {
                    if(!this.currentPoints[i]) return;
                    //@ts-ignore
                    this.ctx.lineTo(this.currentPoints[i].x, this.currentPoints[i].y);
                }
                this.ctx.stroke();
                this.ctx.closePath();
                this.ctx.lineWidth = 1;
            }
    }
    initMouseHandler(){
        this.canvas.addEventListener('mousedown', this.MouseDownHandler);
        this.canvas.addEventListener("mouseup", this.MouseUpHandler);
        this.canvas.addEventListener("mousemove", this.MouseMoveHandler);
    }

}