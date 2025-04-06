import express from 'express';
import jwt from 'jsonwebtoken';
import { middleware } from './middleware';
import { JWT_SECRET } from '@repo/backend-common/config';
import { createUserSchema } from '@repo/common/types';

const app = express();

app.post('/signup', (req,res)=>{

    const data = createUserSchema.safeParse(req.body);
    if(!data.success){
        return res.json({
            error: "invalid input"
        })
    }
    const username = req.body.username;
    const password = req.body.password;

})

app.post('/signin', (req,res)=>{
    const userId = 1;
    const token = jwt.sign({userId},JWT_SECRET);
})

app.post('/room',middleware, (req,res)=>{
    const roomName = req.body.roomName;
    const userId = req.body.userId;
})

app.listen(3001);