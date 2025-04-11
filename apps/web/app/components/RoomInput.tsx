'use client';

import { BACKEND_URL } from "@repo/common/types";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useForm, SubmitHandler } from "react-hook-form";

type Inputs = {
  roomName: string;
};

export default function RoomInput() {
  const { register, handleSubmit, formState: { errors } } = useForm<Inputs>();
  const session = useSession();
  const token = session.data?.backendToken;

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    try {
        const res = await axios.post(
            `${BACKEND_URL}/room`,
            { roomName: data.roomName ,
              token: token
            },
          );
          
      alert(res.data.roomId);
    } catch (err) {
      alert( err);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center">
      <form className="flex flex-col" onSubmit={handleSubmit(onSubmit)}>
        <input
          placeholder="Enter room name to create"
          {...register("roomName", { required: true })}
        />
        {errors.roomName && <span className="text-red-500">Room name is required</span>}
        
        <input
          className="cursor-pointer"
          type="submit"
          value="Create Room"
        />
      </form>
    </div>
  );
}
