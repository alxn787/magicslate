import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { middleware } from './middleware';
import { JWT_SECRET } from '@repo/backend-common/config';
import { createUserSchema } from '@repo/common/types';
import prisma from '@repo/db/client';

const app = express();

app.post('/signup', async(req: Request,res:Response)=>{

    const parseddata = createUserSchema.safeParse(req.body);
    if(!parseddata.success){
        res.json({
            error: "invalid input"
        })
        return;
    }
    const { email, password, name } = parseddata.data;
    
    try{
        const user = await prisma.user.create({
            data: {
                email,
                password,
                name: name
            }
        })
        res.json({
            userId: user.id
        })
    
    }catch(error){
        res.json({
            error: error
        })
    }
})

app.post('/signin', (req,res)=>{
    const userId = 1;
    const token = jwt.sign({userId},JWT_SECRET);
})

app.post('/room',middleware, (req,res)=>{

    const data = createUserSchema.safeParse(req.body);
    if(!data.success){
        res.json({
            error: "invalid input"
        })
        return;
    }

  
    // db call


    res.json({
        roomId: 123
    })

})

app.listen(3001);