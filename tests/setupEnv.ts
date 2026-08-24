import { userInfo } from "node:os";

// Fixed, non-secret test values. Deliberately does NOT load the
// developer's real .env — tests must be deterministic and must never
// touch the real dev database or any real credentials. Vitest already
// sets NODE_ENV=test for us.
//
// DB-touching tests use a dedicated `_test` database so they never touch
// real dev data. Override with TEST_DATABASE_URL if your local Postgres
// setup needs a different user/host (e.g. CI).
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? `postgresql://${userInfo().username}@localhost:5432/hackhers_task_inbox_test`;
process.env.ENCRYPTION_KEY = "0".repeat(64);
process.env.AUTH_SECRET = "test-auth-secret-not-for-production-use";
process.env.GMAIL_PROVIDER = "mock";
process.env.LLM_PROVIDER = "mock";
