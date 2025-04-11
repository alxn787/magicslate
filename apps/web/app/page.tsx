import Authbutton from './components/Authbutton';
import LoginForm from './components/RoomInput';
import './globals.css'
import { useSession } from 'next-auth/react';
export default function Home() {
  return (
    <div >
      <Authbutton/>
    </div>
  );
}
