# Deployment Guide

This guide covers deploying AutoMail to a production server.

## Table of Contents

- [Option A — VPS with Docker Compose](#option-a--vps-with-docker-compose)
- [Option B — Coolify](#option-b--coolify)
- [Option C — Bare Docker (no Compose)](#option-c--bare-docker-no-compose)
- [Reverse Proxy & HTTPS](#reverse-proxy--https)
- [Updating / Redeploying](#updating--redeploying)
- [Backups](#backups)

---

## Option A — VPS with Docker Compose

### Recommended server specs

| Spec | Minimum | Recommended |
|---|---|---|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| Disk | 10 GB | 20 GB |
| OS | Ubuntu 22.04 | Ubuntu 24.04 LTS |
| IP | Static IPv4 | Static IPv4 |

### Ports to open

| Port | Protocol | Purpose |
|---|---|---|
| 22 | TCP | SSH |
| 25 | TCP | SMTP (email receiving) |
| 80 | TCP | HTTP |
| 443 | TCP | HTTPS (after SSL setup) |

> ⚠️ **AWS / GCP / Azure**: These providers block port 25 by default. You must submit a support request to have port 25 unblocked for your instance.

### Step 1 — Install Docker

```bash
# Install Docker Engine
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

### Step 2 — Clone and configure

```bash
git clone https://github.com/your-org/automail.git
cd automail
cp .env.example .env
nano .env
```

Minimum required values in `.env`:

```env
DATABASE_URL=postgres://tempmail:STRONG_PASSWORD@postgres:5432/tempmail
POSTGRES_PASSWORD=STRONG_PASSWORD

MAIL_DOMAIN=mail.yourdomain.com
ADMIN_TOKEN=<output of: openssl rand -hex 32>
```

### Step 3 — Build and start

```bash
# If using Clerk, pass keys as build args:
docker compose build \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_... \
  --build-arg VITE_CLERK_PROXY_URL=https://mail.yourdomain.com/api/__clerk

# Start everything
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### Step 4 — Verify

```bash
# Check all containers are running
docker compose ps

# Test HTTP
curl -I http://localhost

# Test SMTP
nc -zv localhost 25
```

---

## Option B — Coolify

[Coolify](https://coolify.io) is an open-source PaaS that makes it easy to deploy Docker Compose apps with a web UI.

### Install Coolify on your VPS

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Then access Coolify at `http://your-server-ip:8000`.

### Deploy AutoMail via Coolify

1. **New Project** → **New Resource** → **Docker Compose**
2. **Source**: Git → connect your repository
3. **Branch**: `main`
4. **Docker Compose File**: `docker-compose.yml`

#### Environment Variables

In Coolify's **Environment Variables** panel, add:

```
DATABASE_URL=postgres://tempmail:PASSWORD@postgres:5432/tempmail
POSTGRES_USER=tempmail
POSTGRES_PASSWORD=PASSWORD
POSTGRES_DB=tempmail
MAIL_DOMAIN=mail.yourdomain.com
ADMIN_TOKEN=your_secret_here
SMTP_PORT=25
SMTP_HOST_PORT=25
HTTP_PORT=80
LOG_LEVEL=info
# Optional Clerk:
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_CLERK_PROXY_URL=https://mail.yourdomain.com/api/__clerk
ADMIN_EMAILS=you@yourdomain.com
```

#### Build Arguments

In Coolify's **Build Arguments** panel:

```
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_CLERK_PROXY_URL=https://mail.yourdomain.com/api/__clerk
```

#### Port Mappings

Add a port mapping for SMTP:
- `25:25` (or `2525:25` if host port 25 is taken)

#### Domain Routing

- Set your **web** service to use your domain (e.g., `mail.yourdomain.com`)
- Coolify will handle Nginx + Let's Encrypt automatically

---

## Option C — Bare Docker (no Compose)

If you want to run individual containers manually:

```bash
# 1. Create a network
docker network create automail

# 2. Start PostgreSQL
docker run -d --name automail-postgres \
  --network automail \
  -e POSTGRES_USER=tempmail \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=tempmail \
  -v automail-pgdata:/var/lib/postgresql/data \
  postgres:16-alpine

# 3. Build images
docker build --target api \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_... \
  --build-arg VITE_CLERK_PROXY_URL=https://mail.yourdomain.com/api/__clerk \
  -t automail-api .

docker build --target web \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_... \
  --build-arg VITE_CLERK_PROXY_URL=https://mail.yourdomain.com/api/__clerk \
  -t automail-web .

# 4. Start API
docker run -d --name automail-api \
  --network automail \
  -p 8080:8080 \
  -p 25:25 \
  -e DATABASE_URL=postgres://tempmail:yourpassword@automail-postgres:5432/tempmail \
  -e PORT=8080 \
  -e SMTP_PORT=25 \
  -e MAIL_DOMAIN=mail.yourdomain.com \
  -e ADMIN_TOKEN=your_secret \
  -e NODE_ENV=production \
  automail-api

# 5. Start Web
docker run -d --name automail-web \
  --network automail \
  -p 80:80 \
  automail-web
```

---

## Reverse Proxy & HTTPS

### nginx + Certbot (standard setup)

```bash
sudo apt install nginx certbot python3-certbot-nginx -y

# Create Nginx config
sudo tee /etc/nginx/sites-available/automail << 'EOF'
server {
    listen 80;
    server_name mail.yourdomain.com;

    # Redirect to HTTPS (certbot will add this automatically)
    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;

        # Increase timeout for SSE connections
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/automail /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d mail.yourdomain.com
```

> ⚠️ Note: The AutoMail Docker web container already runs Nginx internally. The host-level Nginx above proxies to it. Make sure port 80 in `docker-compose.yml` is mapped to a different host port (e.g., 8090) to avoid conflict.

Updated `docker-compose.yml` approach when running with host Nginx:

```yaml
web:
  ports:
    - "8090:80"  # Internal port 80 → host port 8090
```

Then in your host Nginx config, proxy to `127.0.0.1:8090`.

### Cloudflare Proxy (easier HTTPS)

1. Add your domain to Cloudflare
2. Set the A record with **Proxied** (orange cloud) ✅
3. Set SSL/TLS mode to **Full (strict)**
4. **Important**: The SMTP A record (`mail.yourdomain.com`) must be **DNS only** (grey cloud) — Cloudflare cannot proxy SMTP traffic

---

## Updating / Redeploying

```bash
cd automail

# Pull latest code
git pull origin main

# Rebuild and restart (zero-downtime approach)
docker compose build
docker compose up -d --force-recreate
```

To update only one service:
```bash
docker compose build api
docker compose up -d --force-recreate api
```

---

## Backups

### PostgreSQL backup

```bash
# Create a backup
docker compose exec postgres pg_dump \
  -U tempmail tempmail > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
docker compose exec -T postgres psql \
  -U tempmail tempmail < backup_20250101_120000.sql
```

### Automated daily backup (cron)

```bash
# Add to crontab: crontab -e
0 2 * * * cd /path/to/automail && docker compose exec -T postgres pg_dump -U tempmail tempmail | gzip > /backups/automail_$(date +\%Y\%m\%d).sql.gz && find /backups -name "automail_*.sql.gz" -mtime +30 -delete
```

This runs a backup at 2:00 AM daily and keeps the last 30 days.
