'use client';
import { useSession } from "next-auth/react";
import RoomInput from "../components/RoomInput";

export default function CreateRoom() {
    const session = useSession();
    const token  = session.data?.backendToken;
  return (
    <div>
      <h1>Create Room</h1>
      <RoomInput/>
      {token}
    </div>
  );
}