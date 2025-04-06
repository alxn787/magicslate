import { WebSocketServer } from "ws";
import jwt, { JwtPayload } from 'jsonwebtoken';

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection",function connection(ws,request) {

    const url = request.url;
    const params = new URLSearchParams(url?.split("?")[1]);
    const token = params.get("token") || "";
    const decoded = jwt.verify(token,process.env.JWT_SECRET as string);

    if(!(decoded as JwtPayload).userId || !decoded){
        ws.close();
        return;
    }

    ws.on("error",console.error);

    ws.on("message",function message(data){
        ws.send("Hello World!");
    })

});