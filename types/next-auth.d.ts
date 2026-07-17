import { Role } from "@/lib/enums";
import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      orgId: string;
    };
  }

  interface User {
    role: Role;
    orgId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    orgId: string;
  }
}

export type AuthSession = NextAuth.Session;
