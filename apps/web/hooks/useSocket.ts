import { WS_BACKEND_URL } from "@repo/common/types";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export function useSocket(){
    const [loading, setLoading] = useState(true);
    const [socket,setSocket] = useState<WebSocket>();
    const session = useSession();

    useEffect(()=>{
        const ws = new WebSocket(`${WS_BACKEND_URL}?token=${session?.data?.backendToken}`);
        ws.onopen = ()=>{
            setLoading(false);
            setSocket(ws);
        }
    },[session])

    return({socket,loading});
}