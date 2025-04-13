import { BACKEND_URL } from "@repo/common/types";
import axios from "axios";
import GoogleProvider from "next-auth/providers/google";
import  { DefaultSession, Session} from "next-auth";

declare module "next-auth" {
    interface Session extends DefaultSession {
      backendToken?: string;
    }
}
  
  declare module "next-auth/jwt" {
    interface JWT {
      backendToken?: string;
    }
  }


export const authConfig = {
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    ],
    secret: process.env.NEXTAUTH_SECRET??"secret",
    callbacks: {
      async jwt({ token, account, profile }:any) {
        if (account && profile?.email) {
         
          const backendToken = await axios.post(`${BACKEND_URL}/auth/google`, {
            email: profile.email  ,
            name: profile.name,
            picture: profile.picture
          });
  
          token.backendToken = backendToken.data.token;
        }
        return token;
      },
      async session({ session, token }:{session:Session, token:any}) {
        session.backendToken = token.backendToken;
        return session;
      },
    },
}