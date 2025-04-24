import { WebSocket, WebSocketServer } from "ws";
import jwt, { JwtPayload } from 'jsonwebtoken';
import { JWT_SECRET } from "@repo/backend-common/config";
import prisma from "@repo/db/client";

const wss = new WebSocketServer({ port: 8080 });

function checkUser(token:string):string | null{

    try{
        console.log(token);
        const decoded = jwt.verify(token,JWT_SECRET);

    if(typeof(decoded) == "string"){
        return null;
    }
    if(!decoded || !decoded.userId){
        return null;
    }
    console.log(decoded);
    return (decoded as JwtPayload).userId;

    }catch(e){
        return null;
    }

}

interface user {
    ws: WebSocket;
    userId: string;
    rooms: string[];
}

const users: user[] = [];

wss.on("connection",function connection(ws,request) {

    const url = request.url;
    const params = new URLSearchParams(url?.split("?")[1]);
    const token = params.get("token") || "";
    const userId = checkUser(token);
    if(!userId){
        ws.close();
        return;
    }
    users.push({
        userId,
        rooms:[],
        ws
    })

    ws.on("message",async function message(data){
       
        try{
            const parsedData = JSON.parse(data as unknown as string);

            if(parsedData.type == 'join_room'){
                const user = users.find(x => x.ws == ws);
                user?.rooms.push(parsedData.roomId);
                console.log(user);
            }

            if(parsedData.type == 'leave_room'){
                const user = users.find(x => x.ws == ws);
                const rooms = user?.rooms.filter(x => x == parsedData.roomId);
            }

            if(parsedData.type == 'chat'){
                const user = users.find(x => x.ws == ws);
                console.log(user);
                const roomId = parsedData.roomId;
                const message = parsedData.message;

                await prisma.chat.create({
                    data: {
                        message: message,
                        userId: userId,
                        roomId: roomId
                    }
                })

                users.forEach(user=>{
                    if(user.rooms.includes(roomId) && user.userId != userId){
                        user.ws.send(JSON.stringify({
                            type: 'chat',
                            message: message,
                            roomId:roomId
                        }))
                    }
                })
            }

            if(parsedData.type == 'clearslate'){
                const roomId = parsedData.roomId;
                await prisma.chat.deleteMany({
                    where:{
                        roomId: roomId
                    }
                })
                users.forEach(user=>{
                    if(user.rooms.includes(roomId)){
                        user.ws.send(JSON.stringify({
                            type: 'clearslate',
                            roomId:roomId
                        }))
                    }
                })
            }

            if(parsedData.type == 'updateShape'){
                const roomId = parsedData.roomId;
                const Shape = parsedData.shape;
              
                users.forEach(user=>{
                    if(user.rooms.includes(roomId) && user.userId != userId){
                        user.ws.send(JSON.stringify({
                            type: 'updateShape',
                            shape: Shape,
                            roomId:roomId
                        }))
                    }
                })
            }

            if(parsedData.type == 'updatedShape'){
                const roomId = parsedData.roomId;
                const Shape = parsedData.shape;
                console.log(Shape);
               
              
            }

        }catch(e){
            console.log(e);
        }
    })

});