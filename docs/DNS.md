# DNS Setup Guide

This guide explains how to configure DNS so your server can receive email.

## Overview

To receive email on your domain, you need three DNS records:

| Record | Purpose |
|---|---|
| **A** | Map your mail subdomain to your server's IP |
| **MX** | Tell the world to deliver email to your server |
| **TXT (SPF)** | Authorize your server to send/receive email (reduces spam filtering) |

---

## Prerequisites

- A domain you control (e.g., `yourdomain.com`)
- Your server's public IPv4 address
- Access to your domain's DNS settings (Cloudflare, Namecheap, Route53, etc.)
- Port 25 open on your server

---

## Records to Create

Replace the placeholders:
- `YOUR_SERVER_IP` → Your server's public IPv4 (e.g., `123.45.67.89`)
- `yourdomain.com` → Your domain

| Type | Name / Host | Value | Priority | TTL |
|---|---|---|---|---|
| **A** | `mail` | `YOUR_SERVER_IP` | — | 300 |
| **MX** | `@` | `mail.yourdomain.com` | `10` | 300 |
| **TXT** | `@` | `v=spf1 mx -all` | — | 300 |

> **Note**: The `@` symbol means the root domain (`yourdomain.com`). Some providers use the domain name itself or leave it blank — check your provider's documentation.

---

## Step-by-Step Instructions

### Cloudflare

1. Log in at [dash.cloudflare.com](https://dash.cloudflare.com)
2. Select your domain
3. Go to **DNS** → **Records** → **Add record**

**Add A record:**
- Type: `A`
- Name: `mail`
- IPv4 address: `YOUR_SERVER_IP`
- Proxy status: **DNS only** (grey cloud) ← **Critical: do NOT proxy SMTP through Cloudflare**
- TTL: `Auto` (300)
- Click **Save**

**Add MX record:**
- Type: `MX`
- Name: `@`
- Mail server: `mail.yourdomain.com`
- Priority: `10`
- TTL: `Auto`
- Click **Save**

**Add TXT record (SPF):**
- Type: `TXT`
- Name: `@`
- Content: `v=spf1 mx -all`
- TTL: `Auto`
- Click **Save**

---

### Namecheap

1. Log in → **Domain List** → **Manage** next to your domain
2. Go to **Advanced DNS**

**Add A record:**
- Type: `A Record`
- Host: `mail`
- Value: `YOUR_SERVER_IP`
- TTL: `300`

**Add MX record:**
- Type: `MX Record`
- Host: `@`
- Value: `mail.yourdomain.com`
- Priority: `10`
- TTL: `300`

**Add TXT record (SPF):**
- Type: `TXT Record`
- Host: `@`
- Value: `v=spf1 mx -all`
- TTL: `300`

---

### AWS Route 53

1. Log in to AWS Console → **Route 53** → **Hosted zones**
2. Select your domain → **Create record**

**A record:**
- Record name: `mail`
- Record type: `A`
- Value: `YOUR_SERVER_IP`
- TTL: `300`

**MX record:**
- Record name: (leave blank for root)
- Record type: `MX`
- Value: `10 mail.yourdomain.com`
- TTL: `300`

**TXT record (SPF):**
- Record name: (leave blank for root)
- Record type: `TXT`
- Value: `"v=spf1 mx -all"`
- TTL: `300`

---

## Verify DNS Setup

### Using command line

```bash
# Check your A record
dig A mail.yourdomain.com +short
# Expected: YOUR_SERVER_IP

# Check your MX record
dig MX yourdomain.com +short
# Expected: 10 mail.yourdomain.com.

# Check your SPF TXT record
dig TXT yourdomain.com +short
# Expected: "v=spf1 mx -all"

# Test SMTP connectivity
nc -zv mail.yourdomain.com 25
# Expected: Connection to mail.yourdomain.com 25 port [tcp/smtp] succeeded!

# Alternative SMTP test
telnet mail.yourdomain.com 25
# Type: QUIT
```

### Using online tools

- [MXToolbox](https://mxtoolbox.com/MXLookup.aspx) — check MX records
- [DMARC Analyzer](https://www.dmarcanalyzer.com/spf/checker/) — check SPF
- [Google Admin Toolbox](https://toolbox.googleapps.com/apps/dig/) — general DNS lookup

### From the Admin Panel

1. Go to **Admin → Domains**
2. Find your domain → click the **DNS** button
3. You should see:
   - ✅ **MX Valid** — MX record points to your server
   - ✅ **SPF Valid** — SPF record includes `mx`

---

## DNS Propagation

DNS changes take time to propagate across the internet:

| Scenario | Time |
|---|---|
| Typical | 5–30 minutes |
| Worst case | Up to 48 hours |
| Cloudflare | Usually 1–5 minutes |

To check propagation status worldwide: [whatsmydns.net](https://www.whatsmydns.net)

---

## Multiple Domains

AutoMail supports multiple receiving domains. For each additional domain:

1. Add the DNS records above pointing to the same server IP
2. Go to **Admin → Domains** → **Add Domain**
3. Add the domain and click **Verify DNS**

---

## Troubleshooting DNS

### MX record not recognized

- Ensure the MX value ends with a dot if required by your provider: `mail.yourdomain.com.`
- The MX record must point to a hostname (not an IP). The hostname then needs an A record.
- Wait for propagation — check with `dig MX yourdomain.com @8.8.8.8 +short`

### Email not arriving

1. Test SMTP connectivity: `nc -zv mail.yourdomain.com 25`
2. If connection refused: check your server firewall (`ufw status` or cloud security group)
3. If connection times out: port 25 may be blocked by your ISP/provider
4. Check server logs: `docker compose logs api --tail=100 | grep -i smtp`

### Port 25 blocked

Many ISPs and cloud providers block port 25 by default:

| Provider | Solution |
|---|---|
| AWS EC2 | Submit a request at [aws.amazon.com/forms/ec2-email-limit-rdns-request](https://aws.amazon.com/forms/ec2-email-limit-rdns-request) |
| Google Cloud | Submit a request in Cloud Console |
| Azure | Submit a support ticket |
| DigitalOcean | Automatically available on new accounts |
| Hetzner | Available by default |
| Contabo | Available by default |
| Vultr | Available by default |

If you cannot get port 25 unblocked, consider using port 2525:
1. Set `SMTP_HOST_PORT=2525` in your `.env`
2. Note: Standard MX email delivery uses port 25. Port 2525 is not standard for MX delivery, so this option is primarily useful for testing or custom setups.

### Emails going to spam

This is usually an SPF or reputation issue:

1. Verify your SPF record: `dig TXT yourdomain.com +short`
2. Consider adding a DKIM record (see below)
3. Ensure your server IP doesn't appear on blacklists: [mxtoolbox.com/blacklists](https://mxtoolbox.com/blacklists.aspx)

### DKIM setup (recommended for better deliverability)

DKIM signing requires additional setup. Future versions of AutoMail will automate this. For now, you can manually configure DKIM using your server's mail transfer agent (Postfix, etc.) or a service like Mailgun as a relay.

---

## Zone File Format

You can also export a zone file from **Admin → Domains → Download Zone File** and import it directly into Cloudflare:

1. Cloudflare → DNS → **Import DNS Records**
2. Upload the `.zone` file
3. Review and confirm
