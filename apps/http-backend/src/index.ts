import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { middleware } from './middleware';
import { JWT_SECRET } from '@repo/backend-common/config';
import { createRoomSchema, createUserSchema, signInSchema } from '@repo/common/types';
import prisma from '@repo/db/client';
import bcrypt from 'bcrypt';

const app = express();
app.use(express.json());

declare global{
    namespace Express{
        interface Request{
            userId:string;
        }
    }
}

app.post('/signup', async(req: Request,res:Response)=>{

    const parseddata = createUserSchema.safeParse(req.body);
    if(!parseddata.success){
        res.json({
            error: "invalid input"
        })
        return;
    }
    const { email, password, name } = parseddata.data;

    const hashedPassword = await bcrypt.hash(password,10);
    
    try{
        const user = await prisma.user.create({
            data: {
                email: email,
                password: hashedPassword,
                name: name
            }
        })
        res.json({
            userId: user.id
        })
    
    }catch(error){
        res.json({
            error: "user already exists"
        })
    }
})

app.post('/signin', async(req:Request,res:Response)=>{

    const parseddata = signInSchema.safeParse(req.body);
    console.log(parseddata);
    if(!parseddata.success){
        res.json({
            error: "invalid input"
        })
        return;
    }
    const { email, password } = parseddata.data;

    
    const user = await prisma.user.findFirst({
        where: {
            email: email
        }
    })
    console.log(user);
    if(!user){
        res.json({
            error: "invalid email"
        })
        return;
    }
    const isPasswordCorrect = await bcrypt.compare(password,user.password);
    if(!isPasswordCorrect){
        res.json({
            error: "invalid password"
        })
        return;
    }
    if(isPasswordCorrect){
        const token = jwt.sign({
            userId: user.id
        },JWT_SECRET);
        res.json({
            token: token
        })
        return;
    }
})

app.post('/room',middleware, async(req:Request,res:Response)=>{

    const parseddata = createRoomSchema.safeParse(req.body);
    if(!parseddata.success){
        res.json({
            error: "invalid input"
        })
        return;
    }
    const { roomName } = parseddata.data;
    const userId = res.userId;

    try{
        const room = await prisma.room.create({
            data: {
                slug: roomName,
                adminId: userId
            }
        })
        res.json({
            roomId: room.id
        })
        return;
    }catch(error){
        console.log(error);
    }
   
})

app.get('/chats/:roomId', middleware, async(req:Request,res:Response)=>{
    const roomId = req.params.roomId;
    const messages = await prisma.chat.findMany({
        where: {
            roomId: roomId
        },
        take: 50
    })
    
    res.json({
        messages: messages
    })
}) 

app.listen(3001);