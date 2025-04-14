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
                this.ctx.beginPath();
                this.ctx.arc(shape.centerX, shape.centerY, shape.radius, 0, 2 * Math.PI);
                this.ctx.stroke();
                this.ctx.closePath();
            }
        }) 
    }

    MouseUpHandler = (e)=>{
        this.clicked = false;
        const width = e.clientX - this.startX;
        const height = e.clientY - this.startY;
    
        let shape: Shape;
    
        if (this.selectedTool === "rect") {
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
        } else {
            return; // Unknown tool or "pencil" not yet supported
        }
    
        this.existingShapes.push(shape);
        this.socket.send(JSON.stringify({
            type: "chat",
            message: JSON.stringify(shape),
            roomId: this.roomId
        }));
    
        this.ClearCanvas();
    }
    MouseDownHandler = (e)=>{
        this.clicked = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
    }

    MouseMoveHandler = (e:MouseEvent)=>{
        if(!this.clicked) return;
            const width =  e.clientX - this.startX;
            const height = e.clientY - this.startY;
           
            this.ClearCanvas();
            this.ctx.strokeStyle = "rgba(255,0,255)";    
            const selectedTool = this.selectedTool
            if(selectedTool == "rect"){
                this.ctx.strokeRect(this.startX, this.startY, width, height);
            }
            else if(selectedTool == "circle"){
                const radius = Math.max(Math.abs(height),Math.abs(width))/2;
                const centerX = this.startX + radius;
                const centerY = this.startY + radius;
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                this.ctx.stroke();  
                this.ctx.closePath();
        }
    }
    initMouseHandler(){
        this.canvas.addEventListener('mousedown', this.MouseDownHandler);
        this.canvas.addEventListener("mouseup", this.MouseUpHandler);
        this.canvas.addEventListener("mousemove", this.MouseMoveHandler);
    }

}
    