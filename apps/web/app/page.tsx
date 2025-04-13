
import { getServerSession } from 'next-auth';
import Authbutton from './components/Authbutton';
import LoginForm from './components/RoomInput';
import './globals.css'
import { useSession } from 'next-auth/react';
import { authConfig } from './lib/auth';
export default async function Home() {
  const session = await getServerSession(authConfig);
  return (
    <div >
      <Authbutton/>
      {JSON.stringify(session)}
    </div>
  );
}
