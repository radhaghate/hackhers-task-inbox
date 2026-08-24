import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    teamMemberId?: string;
    user?: DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    teamMemberId?: string;
  }
}
