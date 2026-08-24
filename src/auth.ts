import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/config/env";
import { writeAuditEvent } from "@/lib/audit/auditLog";

/**
 * Team-member login (openid/email/profile only) is a separate OAuth flow
 * from the two Gmail-account-connect flows under /api/oauth/google — this
 * config never requests gmail.* scopes and never touches GmailAccount
 * rows. TeamMember doubles as the login allowlist: only an active member
 * whose email matches the Google account may sign in.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: getEnv().GOOGLE_CLIENT_ID ?? "",
      clientSecret: getEnv().GOOGLE_CLIENT_SECRET ?? "",
      authorization: { params: { scope: "openid email profile" } },
    }),
  ],
  session: { strategy: "jwt" },
  secret: getEnv().AUTH_SECRET,
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const member = await prisma.teamMember.findUnique({ where: { email: user.email } });
      return Boolean(member?.isActive);
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const member = await prisma.teamMember.findUnique({ where: { email: user.email } });
        if (member) {
          token.teamMemberId = member.id;
          await writeAuditEvent({
            eventType: "LOGIN_SUCCEEDED",
            entityType: "TeamMember",
            entityId: member.id,
            actorTeamMemberId: member.id,
          });
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.teamMemberId) session.teamMemberId = token.teamMemberId as string;
      return session;
    },
  },
});
