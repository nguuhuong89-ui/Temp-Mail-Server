# Workspace

## Overview

TempMail — disposable/temporary email service (similar to temp-mail.io). pnpm workspace monorepo with three artifacts:

- `artifacts/api-server` (Express 5) — REST API at `/api` PLUS an embedded SMTP server (port `SMTP_PORT`, default 2525 dev / 25 docker) that receives mail, parses it via `mailparser`, stores it in Postgres, and broadcasts via in-process event bus to SSE subscribers at `GET /api/inbox/:address/stream`.
- `artifacts/tempmail` (React + Vite) — end-user inbox UI at `/` and operator admin panel at `/admin/*` (dashboard, domains, emails, ads, setup guide). Uses generated React Query hooks from `@workspace/api-client-react`.
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
