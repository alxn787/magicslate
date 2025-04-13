import { BACKEND_URL } from "@repo/common/types";
import axios from "axios";
import { getServerSession } from "next-auth";
import { authConfig } from "../../lib/auth";
import { ChatRoom1 } from "../../components/Chatroom";

async function getRoomId(slug:string,token:string){
    const res = await axios.post(`${BACKEND_URL}/room/${slug}`,
        {token:token}
    );
    return res.data.roomId;
}

export default async function ChatRoom ({ params }: { params: { slug: string } }) {
    const slug = ( await params).slug;
    const session = await getServerSession(authConfig);

    const roomId = await getRoomId(slug,session?.backendToken??"");
    
    return(
        <div>
          <ChatRoom1 id={roomId}/>
        </div>
    )
}