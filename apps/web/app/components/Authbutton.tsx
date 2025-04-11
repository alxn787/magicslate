'use client';

import { signIn, signOut, useSession } from 'next-auth/react';


export default function Authbutton() {
  const { data: session } = useSession();

  if (session) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm">Hi, {session.user?.name}</span>
        <button onClick={() => signOut()}>Sign out</button>
      </div>
    );
  }

  return <button onClick={() => signIn('google')}>Sign in with Google</button>;
}
