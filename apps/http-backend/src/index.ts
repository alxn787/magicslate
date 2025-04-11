import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { middleware } from './middleware';
import { JWT_SECRET } from '@repo/backend-common/config';
import { createUserSchema, signInSchema } from '@repo/common/types';
import prisma from '@repo/db/client';
import bcrypt from 'bcrypt';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors({
    origin: ["http://localhost:3000", "https://your-vercel-site.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true
  }));

declare global{
    namespace Express{
        interface Request{
            userId:string;
        }
    }
}


app.post('/room',middleware, async(req:Request,res:Response)=>{

   
    const  roomName  = req.body.roomName;
    const userId = req.userId;
    console.log(userId);
    console.log(roomName);

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

app.get('/room/:slug', middleware, async(req:Request,res:Response)=>{
    const slug = req.params.slug;
    const room = await prisma.room.findFirst({
        where: {
            slug: slug
        }
    })
    
    res.json({
        room
    })
}) 

app.post('/auth/google', async (req: Request, res: Response) => {
       try{
        const { email, name,picture } = req.body;
        console.log(email,name);
        let user = await prisma.user.findFirst({
            where:{
                email
            }
        })

        if(!user){

            user = await prisma.user.create({
                data:{
                    email,
                    name,
                    picture
                }
            })
        }
        console.log(JWT_SECRET);
        const token = jwt.sign({
            userId: user.id
        },JWT_SECRET);
        res.json({
            token: token
        })
        }catch(e){
            res.json({
                error: e
            })
       }
});
  

app.listen(3001);