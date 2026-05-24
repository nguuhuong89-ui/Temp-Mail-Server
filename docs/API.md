# REST API Reference

AutoMail provides a REST API for creating and managing temporary inboxes programmatically. This is useful for:

- QA automation (testing email flows)
- AI agents that need to register on websites
- CI/CD pipelines that test email-based features
- Any script that needs a disposable email address

## Authentication

All `/api/v1/*` endpoints require an API key.

**Get an API key**: Admin Panel → API Keys → Create Key

Include the key in every request using one of these methods:

```
X-API-Key: tm_live_your_key_here
```
or
```
Authorization: Bearer tm_live_your_key_here
```

---

## Base URL

```
https://mail.yourdomain.com
```

---

## Endpoints

### Inboxes

#### `POST /api/v1/inboxes` — Create inbox

Creates a new temporary inbox.

**Request body** (all optional):

```json
{
  "localPart": "myinbox",
  "domainId": 1,
  "ttlMinutes": 60
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `localPart` | string | random | Custom local part (e.g., `myinbox` in `myinbox@domain.com`) |
| `domainId` | number | default domain | Domain to create the inbox on |
| `ttlMinutes` | number | 1440 (24h) | Inbox lifetime in minutes (1–10080 = 1 min to 7 days) |

**Response** `201 Created`:

```json
{
  "address": "myinbox@mail.yourdomain.com",
  "token": "abc123...",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "expiresAt": "2025-01-01T01:00:00.000Z"
}
```

**cURL example:**
```bash
curl -X POST https://mail.yourdomain.com/api/v1/inboxes \
  -H "X-API-Key: tm_live_..." \
  -H "Content-Type: application/json" \
  -d '{"ttlMinutes": 30}'
```

---

#### `GET /api/v1/inboxes` — List inboxes

Returns all inboxes owned by your API key.

**Response** `200 OK`:
```json
[
  {
    "address": "abc123@mail.yourdomain.com",
    "token": "...",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "expiresAt": "2025-01-01T01:00:00.000Z"
  }
]
```

---

#### `GET /api/v1/inboxes/:address` — Get inbox

**Response** `200 OK`:
```json
{
  "address": "abc123@mail.yourdomain.com",
  "token": "...",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "expiresAt": "2025-01-01T01:00:00.000Z"
}
```

---

#### `DELETE /api/v1/inboxes/:address` — Delete inbox

Deletes the inbox and all its emails.

**Response** `204 No Content`

---

### Emails

#### `GET /api/v1/inboxes/:address/emails` — List emails

**Query parameters:**

| Param | Default | Description |
|---|---|---|
| `limit` | `20` | Number of results (1–100) |

**Response** `200 OK`:
```json
[
  {
    "id": 42,
    "fromAddress": "noreply@example.com",
    "toAddress": "abc123@mail.yourdomain.com",
    "subject": "Your verification code",
    "preview": "Your code is 847291...",
    "hasAttachments": false,
    "receivedAt": "2025-01-01T00:01:00.000Z"
  }
]
```

---

#### `GET /api/v1/inboxes/:address/emails/:id` — Get email content

**Response** `200 OK`:
```json
{
  "id": 42,
  "fromAddress": "noreply@example.com",
  "toAddress": "abc123@mail.yourdomain.com",
  "subject": "Your verification code",
  "textBody": "Your code is 847291. It expires in 10 minutes.",
  "htmlBody": "<p>Your code is <b>847291</b>...</p>",
  "preview": "Your code is 847291...",
  "hasAttachments": false,
  "receivedAt": "2025-01-01T00:01:00.000Z"
}
```

---

#### `DELETE /api/v1/inboxes/:address/emails/:id` — Delete email

**Response** `204 No Content`

---

### Code Extraction

These endpoints are designed for automation — they extract verification codes from emails without requiring you to parse the email body yourself.

#### `GET /api/v1/inboxes/:address/latest-code` — Get latest code

Immediately returns the latest verification code found in the inbox.

**Query parameters:**

| Param | Default | Description |
|---|---|---|
| `lookback` | `5` | Number of recent emails to scan (1–50) |
| `pattern` | — | Custom regex pattern for code extraction |

**Response** `200 OK` (code found):
```json
{
  "code": "847291",
  "emailId": 42,
  "subject": "Your verification code",
  "receivedAt": "2025-01-01T00:01:00.000Z"
}
```

**Response** `404 Not Found` (no code found):
```json
{
  "error": "No code found"
}
```

---

#### `GET /api/v1/inboxes/:address/wait-for-code` — Long-poll for code

Waits up to 60 seconds for a new email with a verification code. Returns as soon as a code is found. This is the most efficient way to get a code in automation workflows.

**Query parameters:**

| Param | Default | Description |
|---|---|---|
| `timeout` | `30` | Max wait time in seconds (1–60) |
| `since` | now | ISO timestamp — only look at emails after this time |
| `pattern` | — | Custom regex pattern |

**Response** `200 OK`:
```json
{
  "code": "847291",
  "emailId": 42,
  "subject": "Your verification code",
  "receivedAt": "2025-01-01T00:01:00.000Z"
}
```

**Response** `408 Request Timeout` (no email within timeout):
```json
{
  "error": "Timeout waiting for code"
}
```

**Example — automation workflow:**
```bash
# 1. Create inbox
INBOX=$(curl -sX POST https://mail.yourdomain.com/api/v1/inboxes \
  -H "X-API-Key: tm_live_..." \
  -H "Content-Type: application/json" \
  -d '{"ttlMinutes": 10}')

ADDRESS=$(echo $INBOX | jq -r '.address')
echo "Inbox: $ADDRESS"

# 2. Register on a website using $ADDRESS as the email

# 3. Wait for verification code (long-poll, up to 30 seconds)
CODE=$(curl -s "https://mail.yourdomain.com/api/v1/inboxes/$ADDRESS/wait-for-code?timeout=30" \
  -H "X-API-Key: tm_live_..." | jq -r '.code')

echo "Code: $CODE"

# 4. Use $CODE to complete registration
```

---

### Domains

#### `GET /api/v1/domains` — List available domains

Returns public domains available for creating inboxes.

**Response** `200 OK`:
```json
[
  {
    "id": 1,
    "name": "mail.yourdomain.com"
  }
]
```

---

### TOTP (Unauthenticated)

#### `GET /api/totp` — Generate TOTP code

Generates a time-based one-time password from a secret. Useful for automating 2FA logins.

**Query parameters:**

| Param | Required | Description |
|---|---|---|
| `secret` | ✅ | Base32 secret OR `otpauth://` URI |

**Response** `200 OK`:
```json
{
  "code": "123456",
  "remainingSeconds": 17,
  "period": 30
}
```

**Examples:**
```bash
# With base32 secret
curl "https://mail.yourdomain.com/api/totp?secret=JBSWY3DPEHPK3PXP"

# With otpauth URI
curl "https://mail.yourdomain.com/api/totp?secret=otpauth://totp/Example:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example"
```

---

## Code Examples

### JavaScript / Node.js

```javascript
const API_KEY = 'tm_live_your_key_here';
const BASE_URL = 'https://mail.yourdomain.com';

async function createInbox(ttlMinutes = 30) {
  const res = await fetch(`${BASE_URL}/api/v1/inboxes`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ttlMinutes }),
  });
  return res.json();
}

async function waitForCode(address, timeoutSeconds = 30) {
  const res = await fetch(
    `${BASE_URL}/api/v1/inboxes/${address}/wait-for-code?timeout=${timeoutSeconds}`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  if (!res.ok) throw new Error(`No code received (status ${res.status})`);
  return res.json();
}

// Usage
const inbox = await createInbox(10);
console.log('Email:', inbox.address);

// ... trigger email sending to inbox.address ...

const { code } = await waitForCode(inbox.address);
console.log('Code:', code); // "847291"
```

### Python

```python
import requests

API_KEY = 'tm_live_your_key_here'
BASE_URL = 'https://mail.yourdomain.com'
HEADERS = {'X-API-Key': API_KEY}

def create_inbox(ttl_minutes=30):
    r = requests.post(
        f'{BASE_URL}/api/v1/inboxes',
        headers={**HEADERS, 'Content-Type': 'application/json'},
        json={'ttlMinutes': ttl_minutes}
    )
    r.raise_for_status()
    return r.json()

def wait_for_code(address, timeout=30):
    r = requests.get(
        f'{BASE_URL}/api/v1/inboxes/{address}/wait-for-code',
        headers=HEADERS,
        params={'timeout': timeout}
    )
    r.raise_for_status()
    return r.json()

# Usage
inbox = create_inbox(ttl_minutes=10)
print(f"Email: {inbox['address']}")

# ... register on website using inbox['address'] ...

result = wait_for_code(inbox['address'])
print(f"Code: {result['code']}")
```

### TypeScript (with generated client)

If you're working within the AutoMail monorepo, you can use the generated client:

```typescript
import {
  createInbox,
  waitForCode,
  listInboxEmails,
} from '@workspace/api-client-react';

// All hooks use React Query and require authentication context
```

---

## Error Responses

| HTTP Status | Code | Description |
|---|---|---|
| `400` | — | Bad request — check your input |
| `401` | — | Missing or invalid API key |
| `403` | — | Access denied (inbox owned by a different key) |
| `404` | — | Inbox or email not found |
| `408` | — | Timeout (wait-for-code) |
| `409` | — | Conflict (address already taken) |
| `429` | — | Rate limited |
| `500` | — | Internal server error |

---

## Rate Limits

- **100 inboxes** per API key
- **API key–owned inboxes** are completely isolated from the public unauthenticated API (404 returned, no existence oracle)

---

## Interactive API Docs

The admin panel includes interactive API documentation with copy-pastable examples:

**Admin Panel → API Docs** (`/admin/api-docs`)
