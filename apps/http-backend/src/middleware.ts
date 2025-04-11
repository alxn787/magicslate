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
    console.log("bodytoken here",req.body.token);

    const tokenStr = req.body.token;


    console.log(tokenStr);
    console.log(JWT_SECRET);
    
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
        req.userId = (decoded as JwtPayload).userId;
        next();
    }else{
        res.status(401).send("Unauthorized");
        return;
    }
    
}