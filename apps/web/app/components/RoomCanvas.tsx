'use client';
import { use, useEffect, useRef, useState } from "react";
import { WS_BACKEND_URL } from "@repo/common/types";
import MainCanvas from "./MainCanvas";

export function CanvasClient({roomId,token} : {roomId:string, token:string}){
    const [socket,setSocket] = useState<WebSocket | null>(null);

    useEffect(() => {
       const ws = new WebSocket(`${WS_BACKEND_URL}?token=${token}`);

       ws.onopen = ()=>{
           setSocket(ws);
           ws.send(JSON.stringify({
               type:"join_room",
               roomId
           }));
       }
    },[]);

    if(!socket) return <div>Loading...</div>;

    return (
        <div className="w-full h-full">
            <MainCanvas roomId={roomId} token={token} socket={socket}/>
        </div>
    );
}