-- Screen-time control for the iOS companion app.

-- Per-user rules and current lock state. Effective "unlocked" = NOT locked_override AND unlocked_until > now().
CREATE TABLE IF NOT EXISTS screen_policies (
  user_id             text        PRIMARY KEY,
  minutes_per_session integer     NOT NULL DEFAULT 30,   -- screen minutes earned per finished session
  daily_cap_minutes   integer     NOT NULL DEFAULT 90,   -- max minutes earned from sessions per day
  unlocked_until      timestamptz,
  locked_override     boolean     NOT NULL DEFAULT false, -- parent forced lock
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Paired phones. token_hash = sha256 of the bearer token the app keeps in Keychain.
CREATE TABLE IF NOT EXISTS devices (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      text        NOT NULL,
  name         text        NOT NULL,
  pair_code    text        UNIQUE,         -- 6 digits, single use
  token_hash   text        UNIQUE,
  paired_at    timestamptz,
  apns_token   text,
  app_version  text,
  last_seen_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS devices_user_idx ON devices (user_id);

-- Every grant of screen minutes (from sessions or the parent), for the daily cap and history.
CREATE TABLE IF NOT EXISTS screen_grants (
  id         bigserial   PRIMARY KEY,
  user_id    text        NOT NULL,
  minutes    integer     NOT NULL,
  source     text        NOT NULL,   -- 'session' | 'parent'
  session_id bigint      REFERENCES sessions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS screen_grants_user_idx ON screen_grants (user_id, created_at DESC);
