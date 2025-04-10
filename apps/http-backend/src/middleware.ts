import { JWT_SECRET } from "@repo/backend-common/config";
import { NextFunction, Request, Response } from "express"
import jwt, { JwtPayload } from 'jsonwebtoken';

declare global{
    namespace Express{
        interface Response{
            userId:string;
        }
    }
}

export function middleware(req:Request,res:Response,next:NextFunction){
    const token = req.headers['token'];
    
    if (!token || (Array.isArray(token) && token.length === 0)) {
        res.status(401).send("Unauthorized");
        return;
    }

    const tokenStr = Array.isArray(token) ? token[0] : token;
    if(!tokenStr){ 
        res.status(401).send("Unauthorized");
        return;
    }
    
    const decoded = jwt.verify(tokenStr,JWT_SECRET);
    if(!decoded){
        res.status(401).send("Unauthorized");
        return;
    }

    if((decoded as JwtPayload).userId){
        res.userId = (decoded as JwtPayload).userId;
        next();
    }else{
        res.status(401).send("Unauthorized");
        return;
    }
    
}