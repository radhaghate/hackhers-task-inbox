# HackHERS Task Inbox

An AI-assisted email operations dashboard for the Rutgers HackHERS/WiCS team. It connects the two club Gmail
inboxes, classifies incoming mail with an LLM, turns actionable messages into an editable checklist, and can
draft (never send) suggested replies for a human to review and send themselves from Gmail.

**This is a human-in-the-loop assistant. It never sends email automatically** — the `GmailProvider` interface
(`src/lib/gmail/types.ts`) has no send method at all, so no code path in the app can invoke one.

The app is fully usable with zero Google or Anthropic credentials: it ships with a mock Gmail provider, a mock
LLM provider, and fictional seed data, so you can run the whole product locally before configuring anything real.

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · PostgreSQL via Prisma 7 (works with Supabase or any
Postgres) · Gmail API + Google OAuth · Anthropic (swappable LLM abstraction) · Zod · Auth.js v5 · Vitest ·
Playwright.

## Quickstart (mock mode — no external accounts needed)

```bash
npm install

# 1. Get a local Postgres database. Either:
#    (a) create a free Supabase project and copy its connection string, or
#    (b) install Postgres locally:
brew install postgresql@16
brew services start postgresql@16
createdb hackhers_task_inbox

# 2. Configure environment
cp .env.example .env
# Fill in DATABASE_URL (see above), then generate the two required secrets:
openssl rand -hex 32      # -> ENCRYPTION_KEY
openssl rand -base64 32   # -> AUTH_SECRET
# Leave GMAIL_PROVIDER=mock, LLM_PROVIDER=mock, AUTH_DEV_BYPASS=true — this is the default in .env.example.

# 3. Set up the database
npm run db:migrate   # applies prisma/migrations
npm run db:seed       # loads fictional demo data across all 5 dashboard sections

# 4. Run it
npm run dev
```

Open `http://localhost:3000` — you're auto-signed-in as a seeded "Dev User" (via `AUTH_DEV_BYPASS`), and the
dashboard is populated with fictional threads spanning Needs Attention, Upcoming, Waiting for Reply, Completed,
and Ignored.

Try a scan against the mock Gmail fixtures (separate from the seed data — simulates new mail arriving):

```bash
npm run scan:dry   # retrieves/syncs mail but never calls the model
npm run scan       # full pipeline: sync -> classify -> create tasks
npm run scan       # run again — idempotent, creates nothing new
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm run start` | Production build / start |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit/integration tests (uses a separate `_test` Postgres DB, see below) |
| `npm run test:e2e` | Playwright E2E test against a running dev server |
| `npm run db:migrate` | Apply Prisma migrations (`prisma migrate dev`) |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:seed` | Load fictional demo data (safe to re-run — wipes and recreates its own rows) |
| `npm run db:studio` | Prisma Studio (browse the DB) |
| `npm run scan` | Run one full scan (sync + classify) via the CLI |
| `npm run scan:dry` | Run a scan that syncs mail but skips all model calls |

## Environment variables

See `.env.example` for the full annotated list. Summary:

- **Always required:** `DATABASE_URL`, `ENCRYPTION_KEY`, `AUTH_SECRET`.
- **Mock mode (default, zero external accounts):** `AUTH_DEV_BYPASS=true`, `GMAIL_PROVIDER=mock`,
  `LLM_PROVIDER=mock`.
- **Real Gmail:** set `GMAIL_PROVIDER=google` and configure `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` /
  `GOOGLE_OAUTH_REDIRECT_URI` (see below).
- **Real LLM:** set `LLM_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` (billed separately from any Claude
  subscription), or set `LLM_PROVIDER=manual` to classify by hand — e.g. via Claude Code — at no extra cost
  (see "Manual classification mode" below).
- **Scheduled scans:** `CRON_SECRET` (required in production), `SCAN_INTERVAL_DAYS` (default `2`, documentation
  value — see "Production scheduling" below for what actually enforces the cadence).
- **Tuning:** `NEEDS_ATTENTION_WINDOW_DAYS`, `MAX_EMAIL_BODY_CHARS`, `MAX_CONCURRENT_CLASSIFY_CALLS`.

**Never commit a real `.env` file or real secrets.** `.env*` is gitignored; only `.env.example` (placeholders
only) is tracked.

## Manual classification mode (use your Claude subscription instead of paying for API access)

`LLM_PROVIDER=anthropic` calls the Anthropic API, which is billed separately from any claude.ai or
Claude Code subscription (a subscription doesn't cover programmatic API calls from your own app). If
you'd rather not pay for API usage, set `LLM_PROVIDER=manual` instead: Gmail sync still runs automatically,
but classification becomes a batch step you do by hand — for example by pasting the batch file into a
Claude Code session and asking it to classify the entries, at no extra cost beyond your existing subscription.

1. `npm run scan` (with `LLM_PROVIDER=manual`). Sync runs as normal; instead of calling a model, the scan
   writes every candidate thread to `data/classification-batches/<scanRunId>.json` (gitignored — it contains
   real sanitized email content) and prints the file path.
2. Open that file. It contains the same system prompt the `anthropic` provider uses, plus one entry per
   candidate thread (`subject`, `storedSummary`, `newMessages`) with a `result: null` field.
3. In a Claude Code session (or any Claude interface you have access to), ask it to classify the batch — fill
   in each entry's `result` with a JSON object matching the shape described in the file's `systemPrompt`/
   `instructions` fields. Leave `result: null` on any entry you want to skip; it'll be picked up again on a
   later scan since the thread stays a candidate until it's classified.
4. Apply the filled-in file: `npx tsx scripts/apply-classifications.ts data/classification-batches/<scanRunId>.json`
   (or `npm run classify:apply -- <path>`). This runs the exact same `persistClassification` logic the live
   pipeline uses — same dedup rules, same "never reopen a closed task" invariant — and prints how many tasks
   were created/updated.

The trade-off versus `anthropic` mode: classification isn't fully unattended anymore — a scan on a `/api/cron/scan`
schedule will sync mail and write a batch file every 2 days, but nothing gets classified into tasks until you
run step 3–4 yourself. `ManualLLMProvider.classify()` is never actually invoked (the orchestrator short-circuits
before calling it) — it exists only so `getLLMProvider()` stays total and fails loudly if some other code path
ever tries to call it directly.

## Google Cloud setup (only needed for real Gmail / real team login)

The app is fully usable without this — skip it until you're ready to connect real inboxes or replace
`AUTH_DEV_BYPASS` with real team-member login.

1. Create a Google Cloud project (or reuse one) at [console.cloud.google.com](https://console.cloud.google.com).
2. Enable the **Gmail API** (APIs & Services → Library → search "Gmail API" → Enable).
3. Configure the **OAuth consent screen** (APIs & Services → OAuth consent screen):
   - User type: External (or Internal if your Google Workspace supports it).
   - Add scopes: `.../auth/gmail.readonly`, `.../auth/gmail.compose`, plus the default `openid`, `email`,
     `profile` (used for team-member login).
   - While the app is in "Testing" status, add as **test users**: `rutgers.hackhers@gmail.com`,
     `rutgerswics@gmail.com`, and every team member's Google account email (their `TeamMember.email` in the DB).
4. Create an **OAuth 2.0 Client ID** (APIs & Services → Credentials → Create Credentials → OAuth client ID →
   Web application):
   - Authorized redirect URIs: `http://localhost:3000/api/oauth/google/callback` for local dev, plus your
     production URL's equivalent.
   - Note the Client ID and Client Secret.
5. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` in `.env`.
6. One OAuth client serves two distinct flows:
   - **Team-member login** (`/login`, via Auth.js) requests only `openid email profile`. A signed-in Google
     account only gets dashboard access if its email matches an active row in the `TeamMember` table — seed or
     insert one for each real team member first.
   - **Gmail-account-connect** (`/settings` → Connect) requests `gmail.readonly` + `gmail.compose` for exactly
     one of the two known inboxes at a time. This is what lets the scan pipeline read mail and create drafts.
7. To scan real mail, set `GMAIL_PROVIDER=google`, sign in, go to `/settings`, and click Connect for each
   account. To use the real model, set `LLM_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`.

Scopes requested are intentionally the narrowest that support the product: read access plus draft creation.
The app never requests `gmail.send` or broad `gmail.modify`, and has no code path that could use it if it did.

## Production scheduling

The scan pipeline is one function (`runScan` in `src/lib/scan/orchestrator.ts`) reachable two ways:

1. **`POST /api/cron/scan`** with header `X-Cron-Secret: <CRON_SECRET>`. Point any external scheduler at this
   every `SCAN_INTERVAL_DAYS` (default 2) — e.g. a [Vercel Cron](https://vercel.com/docs/cron-jobs) entry in
   `vercel.json` (`"schedule": "0 13 */2 * *"`), a GitHub Actions workflow on a `schedule` trigger that `curl`s
   the endpoint, or a Supabase scheduled Edge Function. This route is intentionally *not* gated by team-member
   login (there's no browser session on a cron invocation) — the shared secret is the auth boundary instead.
2. **`npm run scan`** (or `scan:dry`) locally/CI for manual runs — same underlying function, no HTTP hop.

Both paths do incremental sync (only new/changed mail since each account's last successful scan), so running
more often than every two days doesn't reprocess anything — dedup and material-change detection make repeat
runs cheap.

## Testing

- `npm run test` runs Vitest against a **separate** `hackhers_task_inbox_test` Postgres database (not your dev
  DB) — several suites exercise real DB behavior (incremental sync, dedup, the scan orchestrator end-to-end)
  against mock Gmail/LLM providers. Create it once:
  ```bash
  createdb hackhers_task_inbox_test
  DATABASE_URL="postgresql://$(whoami)@localhost:5432/hackhers_task_inbox_test" npx prisma migrate deploy
  ```
  Override the default connection string with `TEST_DATABASE_URL` if your Postgres setup differs (see
  `tests/setupEnv.ts`).
- `npm run test:e2e` runs one Playwright test against a real Chromium browser and the dev server (via
  `AUTH_DEV_BYPASS`): open a seeded task, edit a field, mark it complete, confirm it moved to Completed.

## Architecture notes

- **Data model** (`prisma/schema.prisma`): `GmailAccount`, `EmailThread`, `EmailMessage`, `Task`,
  `SuggestedReply`, `Reminder`, `ScanRun`, `AuditEvent`, `TeamMember`. One thread can produce many tasks; tasks
  are never recreated once `COMPLETED` or `DISMISSED` (see `src/lib/scan/persistClassification.ts`).
- **Dashboard sections** are computed, not stored — only `Task.status` persists (`src/lib/dashboard/sections.ts`).
- **Token/cost controls**: per-account `lastHistoryId` cursor for incremental Gmail sync
  (`src/lib/sync/incrementalSync.ts`), dedup by Gmail message/thread ID, material-change detection so unchanged
  threads never get reclassified (`src/lib/sync/materialChange.ts`), signature/quote/tracking-link stripping and
  length-capped truncation before anything reaches the model (`src/lib/sanitize/`), and per-run token/cost
  logging on `ScanRun`.
- **Provider abstractions**: `GmailProvider` and `LLMProvider` (`src/lib/gmail/`, `src/lib/ai/`) each have a mock
  and a real implementation selected by `GMAIL_PROVIDER`/`LLM_PROVIDER`, so either can be swapped or replaced
  without touching the rest of the app.
- **Safety**: OAuth tokens are AES-256-GCM encrypted at rest (`src/lib/crypto/tokenCipher.ts`) and never selected
  into any query that flows to the browser; every scan, classification, edit, dismissal, and draft creation
  writes an `AuditEvent` with structural metadata only (never bodies/tokens); draft creation requires an
  explicit confirm-gated user action and is the only call site of `createDraft` in the codebase.
