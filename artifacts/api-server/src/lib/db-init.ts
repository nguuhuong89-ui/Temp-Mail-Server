import { pool } from "@workspace/db";

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS domains (
      id         SERIAL PRIMARY KEY,
      user_id    TEXT,
      name       TEXT NOT NULL UNIQUE,
      status     TEXT NOT NULL DEFAULT 'active',
      is_public  BOOLEAN NOT NULL DEFAULT TRUE,
      webhook_url TEXT,
      verification_token TEXT,
      verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS domains_status_idx ON domains (status);
    CREATE INDEX IF NOT EXISTS domains_user_idx   ON domains (user_id);

    CREATE TABLE IF NOT EXISTS inboxes (
      id               SERIAL PRIMARY KEY,
      address          TEXT NOT NULL UNIQUE,
      token            TEXT NOT NULL,
      owner_api_key_id INTEGER,
      owner_user_id    TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at       TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS inboxes_address_idx    ON inboxes (address);
    CREATE INDEX IF NOT EXISTS inboxes_expires_idx    ON inboxes (expires_at);
    CREATE INDEX IF NOT EXISTS inboxes_owner_idx      ON inboxes (owner_api_key_id);
    CREATE INDEX IF NOT EXISTS inboxes_owner_user_idx ON inboxes (owner_user_id);

    CREATE TABLE IF NOT EXISTS emails (
      id              SERIAL PRIMARY KEY,
      to_address      TEXT NOT NULL,
      from_address    TEXT NOT NULL,
      subject         TEXT NOT NULL DEFAULT '',
      text_body       TEXT NOT NULL DEFAULT '',
      html_body       TEXT NOT NULL DEFAULT '',
      preview         TEXT NOT NULL DEFAULT '',
      has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
      domain_id       INTEGER,
      received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS emails_to_received_idx ON emails (to_address, received_at);
    CREATE INDEX IF NOT EXISTS emails_received_idx    ON emails (received_at);
    CREATE INDEX IF NOT EXISTS emails_domain_idx      ON emails (domain_id);

    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      email      TEXT,
      plan       TEXT NOT NULL DEFAULT 'free',
      role       TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS users_plan_idx ON users (plan);

    CREATE TABLE IF NOT EXISTS ads (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      placement   TEXT NOT NULL,
      content     TEXT NOT NULL,
      image_url   TEXT,
      link_url    TEXT,
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      impressions INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id           SERIAL PRIMARY KEY,
      user_id      TEXT,
      name         TEXT NOT NULL,
      prefix       TEXT NOT NULL,
      key_hash     TEXT NOT NULL UNIQUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ,
      revoked_at   TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS api_keys_prefix_idx ON api_keys (prefix);
    CREATE INDEX IF NOT EXISTS api_keys_user_idx   ON api_keys (user_id);

    CREATE TABLE IF NOT EXISTS blocklist (
      id         SERIAL PRIMARY KEY,
      pattern    TEXT NOT NULL UNIQUE,
      type       TEXT NOT NULL DEFAULT 'sender',
      note       TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS blocklist_type_idx ON blocklist (type);
  `);
}
