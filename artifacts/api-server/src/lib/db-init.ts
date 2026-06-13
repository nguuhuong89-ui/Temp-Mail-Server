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
    CREATE INDEX IF NOT EXISTS emails_from_idx        ON emails (from_address);

    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      email        TEXT,
      display_name TEXT,
      avatar_url   TEXT,
      plan         TEXT NOT NULL DEFAULT 'free',
      role         TEXT NOT NULL DEFAULT 'user',
      last_login_at TIMESTAMPTZ,
      deleted_at   TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS users_plan_idx ON users (plan);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url   TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at   TIMESTAMPTZ;

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

    CREATE TABLE IF NOT EXISTS audit_logs (
      id          SERIAL PRIMARY KEY,
      action      TEXT NOT NULL,
      actor_id    TEXT NOT NULL,
      target_type TEXT,
      target_id   TEXT,
      metadata    JSONB,
      ip_address  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS audit_logs_action_idx  ON audit_logs (action);
    CREATE INDEX IF NOT EXISTS audit_logs_actor_idx   ON audit_logs (actor_id);
    CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at);

    CREATE TABLE IF NOT EXISTS webhooks (
      id                SERIAL PRIMARY KEY,
      user_id           TEXT NOT NULL,
      url               TEXT NOT NULL,
      events            TEXT NOT NULL DEFAULT 'new_email',
      secret            TEXT NOT NULL,
      is_active         BOOLEAN NOT NULL DEFAULT TRUE,
      last_triggered_at TIMESTAMPTZ,
      fail_count        TEXT NOT NULL DEFAULT '0',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS webhooks_user_idx ON webhooks (user_id);

    CREATE TABLE IF NOT EXISTS saved_inboxes (
      id         SERIAL PRIMARY KEY,
      user_id    TEXT NOT NULL,
      address    TEXT NOT NULL,
      label      TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, address)
    );
    CREATE INDEX IF NOT EXISTS saved_inboxes_user_idx ON saved_inboxes (user_id);

    ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_code TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS users_auth_code_idx ON users (auth_code);

    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS sessions_user_idx    ON sessions (user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

    -- Add is_shared column to inboxes
    ALTER TABLE inboxes ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT FALSE;

    -- Add TOTP columns to users
    ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;

    -- Banned IPs table
    CREATE TABLE IF NOT EXISTS banned_ips (
      id         SERIAL PRIMARY KEY,
      ip         TEXT NOT NULL UNIQUE,
      reason     TEXT,
      banned_by  TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS banned_ips_ip_idx ON banned_ips (ip);

    -- Domain shares table
    CREATE TABLE IF NOT EXISTS domain_shares (
      id                  SERIAL PRIMARY KEY,
      domain_id           INTEGER NOT NULL,
      shared_with_user_id TEXT NOT NULL,
      shared_by_user_id   TEXT NOT NULL,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(domain_id, shared_with_user_id)
    );
    CREATE INDEX IF NOT EXISTS domain_shares_domain_idx ON domain_shares (domain_id);
    CREATE INDEX IF NOT EXISTS domain_shares_user_idx   ON domain_shares (shared_with_user_id);

    -- Add password_hash and email columns for email+password auth
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
  `);
}
