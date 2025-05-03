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
                // Filter out the room from the user's rooms list
                if (user) {
                    user.rooms = user.rooms.filter(roomId => roomId !== parsedData.roomId);
                }
            }

            if(parsedData.type == 'chat'){
                const user = users.find(x => x.ws == ws);
                console.log(user);
                const roomId = parsedData.roomId;
                const message = parsedData.message; // This is the final shape object stringified

                // In a real application, you would save the shape to a database here
                // This 'chat' type now represents the final shape creation

                // Broadcast the final shape to all users in the room except the sender
                users.forEach(user=>{
                    if(user.rooms.includes(roomId) && user.userId != userId){
                        user.ws.send(JSON.stringify({
                            type: 'chat', // Use 'chat' type for broadcasting final shapes
                            message: message, // Send the final shape object stringified
                            roomId:roomId
                        }))
                    }
                })
            }

            if(parsedData.type == 'streamingShape'){ // Handle streaming shape updates
                const roomId = parsedData.roomId;
                const shape = parsedData.shape; // This is the temporary shape object stringified

                // Broadcast the temporary shape update to all users in the room except the sender
                // Clients will use this to render the shape as it's being drawn
                users.forEach(user=>{
                    if(user.rooms.includes(roomId) && user.userId != userId){
                        user.ws.send(JSON.stringify({
                            type: 'streamingShape', // Use 'streamingShape' type for broadcasting temporary updates
                            shape: shape, // Send the temporary shape object stringified
                            roomId:roomId
                        }))
                    }
                })
            }


            if(parsedData.type == 'clearslate'){
                const roomId = parsedData.roomId;
                users.forEach(user=>{
                    if(user.rooms.includes(roomId) && user.userId != userId){
                        user.ws.send(JSON.stringify({
                            type: 'clearslate',
                            roomId:roomId
                        }))
                    }
                })
                await prisma.chat.deleteMany({
                    where:{
                        roomId: roomId
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

            if(parsedData.type == 'eraseShape'){ 
                const roomId = parsedData.roomId;
                const shapeToErase = parsedData.shape; 

                users.forEach(user=>{
                    if(user.rooms.includes(roomId) && user.userId != userId){
                        user.ws.send(JSON.stringify({
                            type: 'eraseShape', 
                            shape: shapeToErase,
                            roomId:roomId
                        }))
                    }
                })
            }

        }catch(e){
            console.error("Error handling message:", e); 
        }
    })

    ws.on('close', () => {
        // Remove the user from the active users list when the connection closes
        const index = users.findIndex(user => user.ws === ws);
        if (index !== -1) {
            users.splice(index, 1);
            console.log(`User disconnected. Total users: ${users.length}`);
        }
    });

    ws.on('error', (error) => {
        console.error("WebSocket error:", error);
        // Handle error, potentially close the connection if it's not already
        ws.close();
    });

});

console.log("WebSocket server started on port 8080");
