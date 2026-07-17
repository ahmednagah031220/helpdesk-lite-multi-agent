import type { NextAuthConfig } from "next-auth";
import { Role } from "@/lib/enums";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = (user as { role: Role }).role;
        token.orgId = (user as { orgId: string }).orgId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.orgId = token.orgId as string;
      }
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      const isPublic = pathname === "/login" || pathname.startsWith("/api/auth");

      if (!isLoggedIn && !isPublic) {
        return false;
      }

      if (isLoggedIn && pathname === "/login") {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
