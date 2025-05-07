

import { getServerSession } from "next-auth";
import { authConfig } from "../../lib/auth";
import { CanvasClient } from "../../components/RoomCanvas";

export default async function Canvas({params} : {params :{roomId:string}}) {

    const roomId = (await params).roomId
    console.log(roomId);
    const session = await getServerSession(authConfig);
    const token = session?.backendToken;
    if(!token)return(<div>{JSON.stringify(session)}</div>);
    console.log(token);

    return(
        <CanvasClient roomId={roomId} token ={token}/>
    )
    
}
