import { BACKEND_URL } from "@repo/common/types";
import axios from "axios";

export async function getExistingShapes(roomId:string,token:string){
    const res = await axios.post(`${BACKEND_URL}/chats/${roomId}`,
        {token:token}
    )
    const messages = res.data.messages
    const shapes = messages.map((x:{message:string})=>{
        const messageData = JSON.parse(x.message);
        return messageData;
    })
    console.log(shapes);
    return shapes;
}