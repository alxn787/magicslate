import { z } from "zod";

export const createUserSchema = z.object({
    email: z.string().min(3).max(20),
    password: z.string(),
    name: z.string()
});

export const signInSchema = z.object({
    email: z.string(),
    password: z.string()
});

export const createRoomSchema = z.object({
    roomName: z.string(),
});

export const  BACKEND_URL = 'http://localhost:3001';
export const WS_BACKEND_URL = 'ws://localhost:8080';
