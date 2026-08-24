import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getEnv } from "@/lib/config/env";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg(getEnv().DATABASE_URL);
  return new PrismaClient({ adapter });
}

// Reuse a single client across hot reloads in dev so we don't exhaust
// Postgres connections.
export const prisma = globalThis.__prisma ?? createPrismaClient();

if (getEnv().NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
