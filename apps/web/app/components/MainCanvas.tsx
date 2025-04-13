"use client";

import { useEffect, useRef } from "react";
import { InitDraw } from "../draw";

export default function MainCanvas({roomId,token,socket}:{roomId:string,token:string,socket:WebSocket}){
        const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if(canvasRef.current){
            const canvas = canvasRef.current;
            InitDraw(canvas,roomId,token ,socket);
        }
    }, [canvasRef]);

    return (
        <div>
            <canvas className="w-screen h-screen" ref={canvasRef}></canvas>
            <div className="flex justify-start gap-2 absolute top-0 left-0">
                <button className="bg-white text-black">Rectangle</button>
                <button className="bg-white text-black">Circle</button>
            </div>
        </div>
    )
}