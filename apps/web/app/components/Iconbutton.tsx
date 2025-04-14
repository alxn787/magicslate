import { ReactNode } from "react";

export function IconButton({icon,onClick,activated }: {icon:ReactNode,onClick:()=>void , activated:boolean}){
    return(
        <div className={`cursor-pointer rounded-xl p-2 hover:bg-slate-600 ${activated ? "bg-slate-600" : " bg-neutral-700"}`} onClick={onClick}>
            {icon}
        </div>
    )
}