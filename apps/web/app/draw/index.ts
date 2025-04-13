'use client';
import { BACKEND_URL } from "@repo/common/types";
import axios from "axios";
import { clear } from "console";

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

export async function InitDraw ( canvas:HTMLCanvasElement, roomId:string,token:string, socket:WebSocket) {

    let existingShapes:Shape[] = await getExistingShapes(roomId,token);

    const ctx = canvas.getContext("2d");
            if(!ctx) return;

    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if(message.type == "chat"){

        }const parsedShape = JSON.parse(message.message);
        existingShapes.push(parsedShape);
        ClearCanvas(existingShapes,canvas,ctx);
    }

    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    ctx.fillStyle = "rgba(0,0,0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ClearCanvas(existingShapes,canvas,ctx)

    let clicked = false;
    let startX = 0;
    let startY = 0;
    canvas.addEventListener("mousedown", (e) => {
        clicked = true;
        startX = e.clientX;
        startY = e.clientY;
    });
    canvas.addEventListener("mouseup", (e) => {
        clicked = false;
        const width =  e.clientX - startX;
        const height = e.clientY - startY;
        const shape: Shape = {
            type:"rect",
            x:startX,
            y:startY,
            width,
            height
        }
       existingShapes.push(shape);
       socket.send(JSON.stringify({
           type:"chat",
           message:JSON.stringify(shape),
           roomId
       }));

    });
    canvas.addEventListener("mousemove", (e) => {
        if(!clicked) return;
        const width =  e.clientX - startX;
        const height = e.clientY - startY;
       
        ClearCanvas(existingShapes,canvas,ctx)

        ctx.strokeStyle = "rgba(255,0,255)";        
        ctx.strokeRect(startX, startY, width, height);
    });
    
}

function ClearCanvas(existingShapes:Shape[], canvas:HTMLCanvasElement, ctx:CanvasRenderingContext2D){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0,0,0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    existingShapes.map(shape=>{
        if(shape.type == "rect"){
            ctx.strokeStyle = "rgba(255,0,255)";        
            ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        }
    }) 
}

async function getExistingShapes(roomId:string,token:string){
    const res = await axios.post(`${BACKEND_URL}/chats/${roomId}`,
        {token:token}
    )
    const messages = res.data.messages
    const shapes = messages.map((x:{message:string})=>{
        const messageData = JSON.parse(x.message);
        return messageData;
    })
    console.log(shapes);
    return shapes;
}