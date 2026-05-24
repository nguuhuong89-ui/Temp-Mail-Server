# AutoMail — Self-Hosted Temporary Email Service

> Disposable email addresses with real-time inbox, custom domains, user accounts, and a full REST API for AI agents and automation.

[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)](./Dockerfile)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=node.js)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm)](https://pnpm.io)

---

## ✨ Features

| Feature | Free | Pro | Admin |
|---|:---:|:---:|:---:|
| Random inbox, real-time email | ✅ | ✅ | ✅ |
| Save inbox history (requires login) | ✅ | ✅ | ✅ |
| Custom inbox address | — | ✅ | ✅ |
| Custom domain (bring your own domain) | — | ✅ | ✅ |
| REST API access (AI agents, automation) | — | ✅ | ✅ |
| Admin panel (domains, users, ads, blocklist) | — | — | ✅ |
| Ad campaign management | — | — | ✅ |

**Core capabilities:**
- 📬 Embedded SMTP server — receives email directly, no third-party relay needed
- ⚡ Real-time inbox via Server-Sent Events (SSE)
- 🔑 Public REST API with API key auth — perfect for QA automation and AI agents
- 🛡️ Blocklist (sender / domain), per-domain webhooks, SSRF-safe
- 🧩 TOTP code extractor — extract 2FA codes from emails via API
- 🌐 Multi-domain support with per-domain DNS verification
- 🎨 Ad campaigns (header, sidebar, inbox, email body placements)
- 👥 User accounts via [Clerk](https://clerk.com) (optional)
- 🐳 Fully Dockerized — deploy in minutes

---

## 📋 Table of Contents

1. [Quick Start (Docker Compose)](#-quick-start-docker-compose)
2. [Architecture](#-architecture)
3. [Configuration Reference](#-configuration-reference)
4. [DNS Setup](#-dns-setup)
5. [Clerk Auth Setup](#-clerk-auth-setup-optional)
6. [Admin Panel](#-admin-panel)
7. [REST API](#-rest-api)
8. [Deploy to Production](#-deploy-to-production)
9. [Local Development](#-local-development)
10. [Troubleshooting](#-troubleshooting)

---

## 🚀 Quick Start (Docker Compose)

### Prerequisites

- Docker ≥ 24 and Docker Compose v2
- A domain or subdomain pointed at your server (for real email delivery)
- Port **25** (SMTP) open on your server/firewall

### 1 — Clone and configure

```bash
git clone https://github.com/your-org/automail.git
cd automail
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
MAIL_DOMAIN=mail.yourdomain.com        # subdomain that receives email
ADMIN_TOKEN=your_random_secret_here    # protect the admin panel
DATABASE_URL=postgres://tempmail:changeme@postgres:5432/tempmail
```

Generate a secure `ADMIN_TOKEN`:
```bash
openssl rand -hex 32
```

### 2 — Start

```bash
docker compose up -d
```

This starts three services:
- **postgres** — database
- **api** — Express API + embedded SMTP on port 25
- **web** — Nginx serving the React frontend + API proxy

### 3 — Open the app

Visit `http://your-server-ip` (or your configured domain).

The admin panel is at `/admin` — authenticate with your `ADMIN_TOKEN`.

> ⚠️ **For real email delivery** you must also configure DNS. See [DNS Setup](#-dns-setup).

---

## 🏗️ Architecture

```
Internet
    │
    ├──── SMTP (port 25) ──────────────────► api-server
    │                                         ├─ embedded smtp-server (mailparser)
    │                                         ├─ stores email → PostgreSQL
    │                                         └─ SSE broadcast → browser
    │
    └──── HTTPS (port 443) ───► Nginx/Proxy
                                    ├─ /         → React frontend (SPA)
                                    └─ /api/*    → api-server (port 8080)
```

### Monorepo structure

```
automail/
├── artifacts/
│   ├── api-server/          # Express 5 + embedded SMTP (Node.js)
│   └── tempmail/            # React + Vite frontend
├── lib/
│   ├── db/                  # Drizzle ORM schema + migrations
│   ├── api-spec/            # OpenAPI spec (source of truth)
│   ├── api-zod/             # Auto-generated Zod validators
│   └── api-client-react/    # Auto-generated React Query hooks
├── docker/
│   └── nginx.conf           # Nginx reverse proxy config
├── Dockerfile               # Multi-stage: deps → build → web | api
└── docker-compose.yml
```

### Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24, pnpm workspaces |
| API | Express 5, TypeScript 5.9 |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4, drizzle-zod |
| SMTP | smtp-server + mailparser |
| Realtime | Server-Sent Events (SSE) |
| Frontend | React, Vite, Wouter, TanStack Query, shadcn/ui, Tailwind v4 |
| Auth | Clerk (optional) |
| Build | esbuild (API), Vite (frontend) |
| API codegen | Orval (OpenAPI → React Query hooks) |

---

## ⚙️ Configuration Reference

Copy `.env.example` to `.env` and fill in the values below.

### Required

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:5432/dbname` |
| `MAIL_DOMAIN` | Domain/subdomain that receives email. MX record must point here. | `mail.example.com` |
| `ADMIN_TOKEN` | Secret to access `/admin`. Use `openssl rand -hex 32`. | `a3f8...` |
| `PORT` | HTTP port for the API server | `8080` |

### SMTP

| Variable | Default | Description |
|---|---|---|
| `SMTP_PORT` | `25` | SMTP port **inside** the container |
| `SMTP_HOST_PORT` | `25` | SMTP port exposed on the **host**. Change to `2525` if port 25 is blocked. |

### Auth (Clerk — optional)

> Skip this section if you don't need user accounts / Pro plans.

| Variable | Description |
|---|---|
| `CLERK_SECRET_KEY` | From Clerk Dashboard → API Keys (`sk_live_...`) |
| `CLERK_PUBLISHABLE_KEY` | From Clerk Dashboard → API Keys (`pk_live_...`) |
| `VITE_CLERK_PROXY_URL` | Public URL of the Clerk proxy: `https://yourdomain.com/api/__clerk` |
| `ADMIN_EMAILS` | Comma-separated emails auto-promoted to `admin+pro` on first login |

### Logging

| Variable | Default | Values |
|---|---|---|
| `LOG_LEVEL` | `info` | `trace` `debug` `info` `warn` `error` |

### Docker Compose extras

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_USER` | `tempmail` | Postgres username (only used for the bundled postgres service) |
| `POSTGRES_PASSWORD` | — | Postgres password |
| `POSTGRES_DB` | `tempmail` | Postgres database name |
| `HTTP_PORT` | `80` | Host port for Nginx |

---

## 🌐 DNS Setup

To receive real email, you need to configure DNS records for your domain.

### Required records

Replace `mail.example.com` with your actual mail subdomain and `YOUR_SERVER_IP` with your server's public IPv4.

| Type | Name / Host | Value | TTL |
|---|---|---|---|
| **A** | `mail` | `YOUR_SERVER_IP` | 300 |
| **MX** | `@` (root domain) | `mail.example.com` | 300 |
| **TXT** | `@` | `v=spf1 mx -all` | 300 |

### Step-by-step (Cloudflare example)

1. Log in to Cloudflare → select your domain
2. Go to **DNS** → **Records**
3. Add the **A record**: Name = `mail`, IPv4 = your server IP, **disable the orange cloud** (DNS only, not proxied — SMTP requires direct IP)
4. Add the **MX record**: Name = `@`, Mail server = `mail.example.com`, Priority = `10`
5. Add the **TXT record**: Name = `@`, Content = `v=spf1 mx -all`
6. Wait 2–5 minutes for propagation

### Verify DNS

```bash
# Check MX record
dig MX yourdomain.com +short
# Expected: 10 mail.yourdomain.com.

# Check A record
dig A mail.yourdomain.com +short
# Expected: YOUR_SERVER_IP

# Test SMTP connectivity
nc -zv mail.yourdomain.com 25
```

### Verify from the Admin Panel

Go to **Admin → Domains**, click the **DNS** button next to your domain. The panel will show ✅ MX Valid and ✅ SPF Valid when everything is set up correctly.

---

## 🔐 Clerk Auth Setup (Optional)

Clerk provides user accounts, login/signup pages, and plan management (Free/Pro).

### 1 — Create a Clerk application

1. Sign up at [clerk.com](https://clerk.com) (free tier available)
2. Create a new application
3. Go to **Configure → API Keys**
4. Copy `Publishable Key` and `Secret Key`

### 2 — Configure the proxy URL

Since AutoMail serves the Clerk JS SDK through its own domain (whitelabel), you must set the proxy URL:

```env
VITE_CLERK_PROXY_URL=https://mail.yourdomain.com/api/__clerk
```

This must match the public URL of your deployment.

### 3 — Build with Clerk keys

The `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_CLERK_PROXY_URL` are baked into the frontend bundle **at build time**. Pass them as Docker build args:

```bash
docker compose build \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_... \
  --build-arg VITE_CLERK_PROXY_URL=https://mail.yourdomain.com/api/__clerk
```

Or set them in your `.env` file if your compose file reads them as build args (see the `web` service in `docker-compose.yml`).

### 4 — Set admin emails

```env
ADMIN_EMAILS=you@example.com,colleague@example.com
```

Any user whose email is in this list will be automatically promoted to `role=admin, plan=pro` on first login.

### Plans

| Plan | How to assign |
|---|---|
| `free` | Default for all new signups |
| `pro` | Admin manually upgrades in **Admin → Users** |
| `admin` | Add email to `ADMIN_EMAILS` env, or promote in **Admin → Users** |

> **Invariant**: `admin` role always implies `pro` plan — enforced in the middleware and on every plan change.

---

## 🛠️ Admin Panel

Access at `/admin`. Authenticate with your `ADMIN_TOKEN`.

### Dashboard
Real-time stats: total emails, inboxes, domains, active users.

### Domains
- Add public or private domains
- DNS verification (checks MX + SPF records)
- Per-domain webhook URL — receive a POST when email arrives
- Download zone file for bulk DNS import (Cloudflare-compatible)

### Emails
- Search and browse all received emails
- Filter by domain, date range, sender
- Bulk delete

### Inboxes
- View all inboxes with owner info
- Delete expired / anonymous inboxes in bulk
- Filter by type (owned / anonymous) and status

### Users *(requires Clerk)*
- View all registered users with plan/role
- Upgrade/downgrade plan (free ↔ pro)
- Promote/demote admin role
- Delete user + all their data

### Ad Campaigns
- Create campaigns: Header, Sidebar, Inbox Top, Email Body placements
- Supports plain text, HTML, and ad network embed codes (AdSense, etc.)
- Toggle active/inactive, view impression count

### Blocklist
- Block by exact sender address or entire domain
- Blocked mail is dropped at SMTP level before being stored

### API Keys
- Create API keys for automation / AI agents
- The plaintext key is shown **once** — save it immediately
- Revoke or delete keys

### Settings
- Configure email retention policy (anonymous inbox TTL, global max age)
- Manual purge (anon emails, old emails)
- Impact preview before purging

### Setup Guide
- Step-by-step DNS configuration with your server's actual IP pre-filled
- Zone file download

---

## 📡 REST API

The public API is available at `/api/v1/` and requires an API key.

### Authentication

Include the API key in any of these headers:
```
X-API-Key: tm_live_your_key_here
# or
Authorization: Bearer tm_live_your_key_here
```

### Quick Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/inboxes` | Create a new inbox |
| `GET` | `/api/v1/inboxes` | List your inboxes |
| `GET` | `/api/v1/inboxes/:address` | Get inbox details |
| `DELETE` | `/api/v1/inboxes/:address` | Delete an inbox |
| `GET` | `/api/v1/inboxes/:address/emails` | List emails in inbox |
| `GET` | `/api/v1/inboxes/:address/emails/:id` | Get email content |
| `DELETE` | `/api/v1/inboxes/:address/emails/:id` | Delete an email |
| `GET` | `/api/v1/inboxes/:address/latest-code` | Extract latest verification code |
| `GET` | `/api/v1/inboxes/:address/wait-for-code` | Long-poll for a code (up to 60s) |
| `GET` | `/api/v1/domains` | List available domains |
| `GET` | `/api/totp?secret=...` | Generate TOTP code |

### Create an inbox

```bash
curl -X POST https://mail.yourdomain.com/api/v1/inboxes \
  -H "X-API-Key: tm_live_..." \
  -H "Content-Type: application/json" \
  -d '{"ttlMinutes": 30}'
```

Response:
```json
{
  "address": "abc123@mail.yourdomain.com",
  "token": "...",
  "createdAt": "2025-01-01T00:00:00Z",
  "expiresAt": "2025-01-01T00:30:00Z"
}
```

### Wait for a verification code

```bash
curl "https://mail.yourdomain.com/api/v1/inboxes/abc123@mail.yourdomain.com/wait-for-code?timeout=30"
  -H "X-API-Key: tm_live_..."
```

Response:
```json
{
  "code": "847291",
  "emailId": 42,
  "subject": "Your verification code",
  "receivedAt": "2025-01-01T00:01:23Z"
}
```

### TOTP generator

```bash
curl "https://mail.yourdomain.com/api/totp?secret=JBSWY3DPEHPK3PXP"
```

Response:
```json
{
  "code": "123456",
  "remainingSeconds": 17,
  "period": 30
}
```

> Full interactive API docs with copy-pastable examples are available in the admin panel at **Admin → API Docs**.

---

## 🚢 Deploy to Production

### Option A — VPS with Docker Compose (Recommended)

#### 1. Provision a server

Any Linux VPS works. Recommended:
- **Ubuntu 22.04 / 24.04** LTS
- **1 vCPU, 1 GB RAM** minimum (2 GB recommended)
- Public IPv4 address
- Ports **22** (SSH), **25** (SMTP), **80** (HTTP), **443** (HTTPS) open

#### 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in
```

#### 3. Deploy

```bash
git clone https://github.com/your-org/automail.git
cd automail
cp .env.example .env
nano .env  # fill in your values
docker compose up -d --build
```

#### 4. Reverse proxy with HTTPS (nginx + Certbot)

```bash
sudo apt install nginx certbot python3-certbot-nginx -y

# Create site config
sudo tee /etc/nginx/sites-available/automail << 'EOF'
server {
    server_name mail.yourdomain.com;
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/automail /etc/nginx/sites-enabled/
sudo certbot --nginx -d mail.yourdomain.com
sudo systemctl reload nginx
```

### Option B — Coolify (One-click self-hosted PaaS)

[Coolify](https://coolify.io) is an open-source Heroku/Netlify alternative you can run on your own VPS.

1. Install Coolify on your VPS (see [coolify.io/docs](https://coolify.io/docs))
2. In Coolify: **New Resource → Docker Compose → From Git**
3. Point to this repository
4. Under **Environment Variables**, add all variables from `.env.example`
5. Add **Build Arguments**: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PROXY_URL`
6. Set **Port Mapping**: `25:25` for SMTP
7. Click **Deploy**

The `docker-compose.yml` includes a `coolify` external network — Coolify will handle routing automatically.

### Option C — Build and run manually (no compose)

```bash
# Build
docker build --target api \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_... \
  --build-arg VITE_CLERK_PROXY_URL=https://mail.yourdomain.com/api/__clerk \
  -t automail-api .

docker build --target web \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_... \
  --build-arg VITE_CLERK_PROXY_URL=https://mail.yourdomain.com/api/__clerk \
  -t automail-web .

# Run API
docker run -d --name automail-api \
  -p 8080:8080 -p 25:25 \
  -e DATABASE_URL=postgres://... \
  -e MAIL_DOMAIN=mail.yourdomain.com \
  -e ADMIN_TOKEN=your_secret \
  -e PORT=8080 \
  automail-api

# Run Web
docker run -d --name automail-web \
  -p 80:80 \
  automail-web
```

---

## 💻 Local Development

### Prerequisites

- Node.js 24+
- pnpm 10+ (`npm install -g pnpm`)
- PostgreSQL 15+ running locally (or via Docker)

### Setup

```bash
# Clone and install
git clone https://github.com/your-org/automail.git
cd automail
pnpm install

# Set up environment
cp .env.example .env
# Edit DATABASE_URL to point to your local Postgres
```

### Start a local Postgres (Docker shortcut)

```bash
docker run -d --name automail-pg \
  -e POSTGRES_USER=tempmail \
  -e POSTGRES_PASSWORD=tempmail \
  -e POSTGRES_DB=tempmail \
  -p 5432:5432 \
  postgres:16-alpine
```

Then in `.env`:
```env
DATABASE_URL=postgres://tempmail:tempmail@localhost:5432/tempmail
```

### Run the development server

```bash
# In terminal 1 — API server (port 3000)
pnpm --filter @workspace/api-server run dev

# In terminal 2 — Frontend (port 5173)
pnpm --filter @workspace/tempmail run dev
```

Open `http://localhost:5173`. The API is proxied via Vite to `http://localhost:3000`.

### Push database schema

```bash
pnpm --filter @workspace/db run push
```

### Regenerate API client

```bash
pnpm --filter @workspace/api-spec run codegen
```

### Useful commands

```bash
pnpm run typecheck          # TypeScript check across all packages
pnpm run build              # Typecheck + build all packages
pnpm run lint               # ESLint
```

---

## 🔧 Troubleshooting

### Emails not arriving

1. **Check DNS**: `dig MX yourdomain.com +short` — should return `mail.yourdomain.com`
2. **Check SMTP port**: `nc -zv mail.yourdomain.com 25` — should connect
3. **Check firewall**: Port 25 must be open inbound. Many cloud providers (AWS, GCP, Azure) block port 25 by default — you need to explicitly request it be unblocked, or use port 2525 and configure your DNS accordingly.
4. **Check logs**: `docker compose logs api --tail=50`
5. **Check blocklist**: The sender might be in the blocklist. Check Admin → Blocklist.

### Port 25 is blocked by my VPS provider

Many hosting providers block outbound/inbound port 25 by default. Options:
- **Option A**: Request unblocking from your provider (AWS, DigitalOcean, etc.)
- **Option B**: Use port 2525 — set `SMTP_HOST_PORT=2525` in `.env`, then create an MX record with a non-standard port (not standard, but works with custom setups)
- **Option C**: Use a VPS that allows port 25 (Hetzner, OVH, Contabo, etc.)

### Admin panel access denied

- Ensure `ADMIN_TOKEN` in `.env` matches exactly what you type in the login form
- No leading/trailing spaces
- Check with: `docker compose exec api env | grep ADMIN_TOKEN`

### Clerk login not working

1. Verify `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` are set correctly
2. Verify `VITE_CLERK_PROXY_URL` matches your public domain exactly (including `https://`)
3. The frontend must be **rebuilt** after changing Clerk keys — they are baked in at build time
4. In Clerk Dashboard → **Domains**: ensure your production domain is whitelisted

### Frontend shows blank page / 404

- The web container serves a SPA — all routes must fall back to `index.html`. The included `nginx.conf` handles this with `try_files $uri $uri/ /index.html`.
- If behind another reverse proxy, make sure it also forwards unknown paths to the web container.

### Database connection errors

```bash
# Test connection
docker compose exec api node -e "
  const { Client } = await import('pg');
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  console.log('OK');
  await c.end();
"
```

### Logs and debugging

```bash
# View all service logs
docker compose logs -f

# API logs only
docker compose logs api -f

# Set verbose logging
# In .env: LOG_LEVEL=debug
docker compose up -d  # restart to apply
```

---

## 🔒 Security Notes

- **Change `ADMIN_TOKEN`** before deploying to production. Never use the default.
- **SMTP is unauthenticated by design** — it's meant to receive email for temporary addresses, not to relay outbound mail. The server rejects mail for domains it doesn't serve.
- **Tenant isolation** — API key–owned inboxes cannot be read via the public unauthenticated API. A 404 is returned for any access attempt (no existence oracle).
- **SSRF protection** — webhook URLs are validated against private/reserved IP ranges at both the DNS and connection level.
- **Blocklist** — add known spam senders/domains to prevent storage of unwanted mail.
- **Rate limiting** — consider adding a reverse proxy rate limiter (nginx `limit_req`, Cloudflare, etc.) in front of the API.

---

## 📁 Project Structure (Detail)

```
artifacts/
  api-server/
    src/
      app.ts                  # Express app factory
      index.ts                # Entry point, starts SMTP + HTTP
      lib/
        smtp.ts               # Embedded SMTP server
        events.ts             # In-process email event bus (SSE)
        domain-cache.ts       # In-memory domain lookup cache
        blocklist-cache.ts    # In-memory blocklist cache
        code-extract.ts       # Verification code heuristic extractor
        totp.ts               # Pure TOTP generator (zero deps)
        webhooks.ts           # SSRF-safe webhook dispatcher
      middlewares/
        clerk-auth.ts         # Clerk session → plan/role resolver
        admin-auth.ts         # ADMIN_TOKEN guard
      routes/
        inbox.ts              # Public inbox endpoints
        account.ts            # Authenticated user endpoints
        admin-*.ts            # Admin-only endpoints
        v1.ts                 # API key–authenticated REST API
  tempmail/
    src/
      pages/
        admin/                # All admin panel pages
        account/              # User account pages
      components/
        layout/               # Admin + account layouts
        ui/                   # shadcn/ui components
      i18n/                   # Locale files (en, vi, zh)
lib/
  db/src/schema/              # Drizzle table definitions
  api-spec/                   # OpenAPI YAML spec
  api-zod/                    # Auto-generated Zod schemas
  api-client-react/           # Auto-generated React Query hooks
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes
4. Run typechecks: `pnpm run typecheck`
5. Commit: `git commit -m "feat: add my feature"`
6. Push and open a Pull Request

---

## 📄 License

MIT — see [LICENSE](./LICENSE) for details.
