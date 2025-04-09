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
    
    const token = req.headers['authorization']??"";
    const decoded = jwt.verify(token,JWT_SECRET);
    if((decoded as JwtPayload).userId){
        res.userId = (decoded as JwtPayload).userId;
        next();
    }else{
        res.status(401).send("Unauthorized");
        return;
    }
}