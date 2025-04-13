import { BACKEND_URL } from "@repo/common/types";
import axios from "axios";
import { getServerSession } from "next-auth";
import { authConfig } from "../lib/auth";
import { ChatroomCLient } from "./ChatroomClient";

async function getChats(id: string, token:string) {
    const res = await axios.post(`${BACKEND_URL}/chats/${id}`,
        {token:token}
    );  
    return res.data.messages;
}

export async function ChatRoom1({ id }: { id: string }) {
    const session = await getServerSession(authConfig);
    const token = session?.backendToken;
    const messages = await getChats(id,token??"");

    console.log(session);
    return (
        <div>
            <ChatroomCLient messages={messages.map((x: { message: string })=> x.message)} id={id}/>
        </div>
    );

}