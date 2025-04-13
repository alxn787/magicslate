import { useForm } from "react-hook-form";

export const JoinRoom = () => {

    type Inputs = {
        roomId:string
    }

    const { register, handleSubmit, formState: { errors } } = useForm<Inputs>();
    const onSubmit = async (data:Inputs)=>{
        alert(data.roomId);
        console.log(data);
    }

    return (
        <div>
            <form onSubmit={handleSubmit(onSubmit)}>
            <input type="text" placeholder="Enter room id" {...register("roomId")}/>
            {errors.roomId && <span className="text-red-500">Room id is required</span>}
            <button type="submit">Join Room</button>
            </form>
            
        </div>
    )
}