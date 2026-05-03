# Workspace

## Overview

TempMail — disposable/temporary email service (similar to temp-mail.io). pnpm workspace monorepo with three artifacts:

- `artifacts/api-server` (Express 5) — REST API at `/api` PLUS an embedded SMTP server (port `SMTP_PORT`, default 2525 dev / 25 docker) that receives mail, parses it via `mailparser`, stores it in Postgres, and broadcasts via in-process event bus to SSE subscribers at `GET /api/inbox/:address/stream`.
- `artifacts/tempmail` (React + Vite) — end-user inbox UI at `/` (with QR-code share + per-email delete) and operator admin panel at `/admin/*` (dashboard, domains w/ per-domain webhook URL, emails, ads, blocklist, setup guide). Uses generated React Query hooks from `@workspace/api-client-react`.

## Phase 4 — Public API for AI agents

- **`POST /api/api-keys`** (admin): create key — plaintext returned ONCE (`tm_live_<48 hex>`). Stored as sha256 hash + 14-char prefix only.
- **`POST /api/api-keys/:id/revoke`**, **`DELETE /api/api-keys/:id`** (admin).
- **`/api/v1/*`** (auth via `X-API-Key` or `Authorization: Bearer`): `POST /v1/inboxes` (random or specific localPart+domain, optional `ttlMinutes` 1–10080), `GET /v1/inboxes`, `GET|DELETE /v1/inboxes/:address`, `GET /v1/inboxes/:address/emails?limit=`, `GET|DELETE /v1/inboxes/:address/emails/:id`, `GET /v1/domains`.
- **Object-level auth**: each inbox stores `ownerApiKeyId`. `/v1/*` routes use `loadOwnedInbox()` which returns a uniform 404 when an inbox does not exist OR is owned by a different key (no existence oracle). Legacy public `/api/inbox/:address[*]` routes also short-circuit with 404 if `ownerApiKeyId IS NOT NULL`, so API-owned inboxes can NEVER be read/deleted/refreshed/streamed via the unauthenticated user surface.
- **Auth middleware** (`lib/api-key-auth.ts`): scoped `router.use("/v1", apiKeyAuth)` so it does NOT block admin routes; uses `crypto.timingSafeEqual` for hash comparison; debounced `lastUsedAt` writes (60s).
- **Admin UI**: `/admin/api-keys` (create + revoke + delete with one-time secret display) and `/admin/api-docs` (cURL/JS/Python quickstart with copy-to-clipboard).

## Phase 3 modules (admin extras)

- **Blocklist** (`/api/blocklist`, admin-gated): sender or domain match; cached in-memory and consulted in `smtp.ts` to drop incoming mail before persistence. Cache invalidated on create/delete.
- **Per-domain webhooks**: `domains.webhookUrl`. On each accepted email, `fireEmailWebhook()` POSTs JSON `{event:"email.received", emailId, fromAddress, toAddress, subject, preview, hasAttachments, receivedAt}`. SSRF-hardened: `isSafeWebhookUrl` rejects non-http(s), `localhost`, `*.local/*.internal`, IP-literal private/reserved ranges; `resolveAndCheckSafe` does a DNS lookup (A+AAAA) and rejects if any resolved address is loopback/private/link-local/CGNAT/multicast/IPv4-mapped-private. Fire-and-forget with 5s `AbortController` timeout, never blocks SMTP.
- **Per-email delete**: `DELETE /api/inbox/:address/emails/:id` (token-scoped on the inbox).
- **api-zod barrel**: `lib/api-zod/src/index.ts` uses `export * as schemas` to namespace zod schemas, avoiding name collisions with TS types from `./generated/types`. Consumers: `import { schemas } from "@workspace/api-zod"` then `schemas.HealthCheckResponse`.
- `artifacts/mockup-sandbox` — design canvas (unchanged template).

Self-host: see `Dockerfile`, `docker-compose.yml`, `docker/nginx.conf` at repo root. Compose stack = postgres + api (exposes SMTP port 25) + nginx (serves built frontend + proxies `/api` and SSE).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle). `smtp-server`, `mailparser`, `nodemailer` are externalized in `artifacts/api-server/build.mjs` (resolved from node_modules at runtime).
- **SMTP**: `smtp-server` + `mailparser` embedded in api-server process
- **Realtime**: Server-Sent Events (`/api/inbox/:address/stream`) backed by in-process EventEmitter (`src/lib/events.ts`)
- **Frontend**: React + Vite + wouter + TanStack Query + framer-motion + recharts + shadcn/ui

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
