import { z } from "zod";

const boolFromString = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const intFromString = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? Number.parseInt(v, 10) : fallback))
    .pipe(z.number().int().positive());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, "ENCRYPTION_KEY must be a 32-byte hex string (openssl rand -hex 32)"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET is required"),
  AUTH_URL: z.string().default("http://localhost:3000"),
  AUTH_DEV_BYPASS: boolFromString,

  GMAIL_PROVIDER: z.enum(["mock", "google"]).default("mock"),
  LLM_PROVIDER: z.enum(["mock", "anthropic", "manual"]).default("mock"),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-5"),

  CRON_SECRET: z.string().optional(),
  SCAN_INTERVAL_DAYS: intFromString(2),

  NEEDS_ATTENTION_WINDOW_DAYS: intFromString(2),
  MAX_EMAIL_BODY_CHARS: intFromString(6000),
  MAX_CONCURRENT_CLASSIFY_CALLS: intFromString(3),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Parses and validates process.env once per process. Throws with a clear
 * message on startup if required config is missing, instead of failing
 * confusingly deep inside a route handler or the scan pipeline.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function isMockGmail(): boolean {
  return getEnv().GMAIL_PROVIDER === "mock";
}

export function isMockLLM(): boolean {
  return getEnv().LLM_PROVIDER === "mock";
}

/** Manual mode: the scan exports candidate threads to a batch file instead of calling any model. */
export function isManualLLM(): boolean {
  return getEnv().LLM_PROVIDER === "manual";
}

export function isAuthDevBypassActive(): boolean {
  const env = getEnv();
  return env.AUTH_DEV_BYPASS === true && env.NODE_ENV !== "production";
}

/**
 * Test-only escape hatch: getEnv() caches its parsed result for the life of
 * the process, which is normally correct (env config doesn't change at
 * runtime) but breaks tests that need to flip a provider switch (e.g.
 * LLM_PROVIDER) between cases. Never call this outside tests.
 */
export function __resetEnvCacheForTests(): void {
  cached = undefined;
}
