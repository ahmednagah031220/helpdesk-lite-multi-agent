import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import { compare } from "bcryptjs";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/db";
import { Role } from "@/lib/enums";

const providers: Provider[] = [
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      const email = String(credentials.email);
      const password = String(credentials.password);

      const user = await prisma.user.findFirst({
        where: { email },
        orderBy: { createdAt: "asc" },
      });
      if (!user?.password) return null;

      const valid = await compare(password, user.password);
      if (!valid) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        orgId: user.orgId,
      };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "credentials") return true;
      if (!user.email) return false;

      const defaultOrgSlug = process.env.DEFAULT_ORG_SLUG ?? "acme";
      const org =
        (await prisma.organization.findUnique({
          where: { slug: defaultOrgSlug },
        })) ??
        (await prisma.organization.create({
          data: {
            name: process.env.DEFAULT_ORG_NAME ?? "Acme Corp",
            slug: defaultOrgSlug,
          },
        }));

      const existing = await prisma.user.findFirst({
        where: { orgId: org.id, email: user.email },
      });

      if (existing) {
        user.id = existing.id;
        (user as { role: Role }).role = existing.role;
        (user as { orgId: string }).orgId = existing.orgId;
        return true;
      }

      const created = await prisma.user.create({
        data: {
          email: user.email,
          name: user.name ?? user.email.split("@")[0],
          password: null,
          role: Role.EMPLOYEE,
          authProvider: account?.provider ?? "oidc",
          orgId: org.id,
        },
      });
      user.id = created.id;
      (user as { role: Role }).role = created.role;
      (user as { orgId: string }).orgId = created.orgId;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = (user as { role: Role }).role;
        token.orgId = (user as { orgId: string }).orgId;
      }
      return token;
    },
  },
});
