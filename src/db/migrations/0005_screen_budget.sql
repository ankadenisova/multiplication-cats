-- Daily budget model: base minutes every day + credits (sessions, parent); the kid spends them in windows.
ALTER TABLE screen_policies ADD COLUMN IF NOT EXISTS base_daily_minutes integer NOT NULL DEFAULT 50;

-- Unlock windows actually opened on the phone (usage). Superseded window_* columns on screen_grants.
CREATE TABLE IF NOT EXISTS screen_windows (
  id         bigserial   PRIMARY KEY,
  user_id    text        NOT NULL,
  device_id  uuid,
  source     text        NOT NULL,     -- 'kid' | 'session' | 'parent'
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at    timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS screen_windows_user_idx ON screen_windows (user_id, started_at DESC);
ALTER TABLE screen_grants DROP COLUMN IF EXISTS window_start;
ALTER TABLE screen_grants DROP COLUMN IF EXISTS window_end;
