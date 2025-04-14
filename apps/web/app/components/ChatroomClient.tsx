'use client';

import { use, useEffect, useRef, useState } from "react";
import { useSocket } from "../../hooks/useSocket";
import { InitDraw } from "../draw";

export function ChatroomCLient({ messages, id }: { messages: string[], id: string }) {
    const { socket, loading } = useSocket();
    const [chats, setChats] = useState(messages);  
    const [currentMessage, setCurrentMessage] = useState("");
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (socket && !loading) {
            socket.send(JSON.stringify({
                type: 'join_room',
                roomId: id
            }));
    
            const handleMessage = (event: MessageEvent) => {
                const data = JSON.parse(event.data);
                if (data.type === 'chat') {
                    setChats(prevChats => [...prevChats, data.message]);
                }
            };
    
            socket.addEventListener("message", handleMessage);
    
            return () => {
                socket.removeEventListener("message", handleMessage);
            };
        }
    }, [socket, loading, id]);

    useEffect(() => {
        if(canvasRef.current){
            const canvas = canvasRef.current;
            

            InitDraw( canvas);
        }
    }, [canvasRef]);

    return (
        <div className="w-full h-full">
            {chats.map((message, index) => (
                <div key={index}>
                    {message}
                </div>
            ))}

            <input value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} />

            <button onClick={() => {
               if(currentMessage == "") return;
               socket?.send(JSON.stringify({
                type: "chat",
                message: currentMessage,
                roomId: id
            }));
            setCurrentMessage("");  
            }}>
                Send message
            </button>

            <canvas className="w-screen h-screen" ref={canvasRef}></canvas>
        </div>
    );
}
