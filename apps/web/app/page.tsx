import Authbutton from './components/Authbutton';
import LoginForm from './components/Login';
import './globals.css'
import { useSession } from 'next-auth/react';
export default function Home() {
  const session = useSession();
  return (
    <div >
      <Authbutton/>
    </div>
  );
}
