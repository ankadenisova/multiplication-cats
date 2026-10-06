-- Reward schedule per day: 1st finished session +30, 2nd +10, 3rd +10, then nothing. Base 0.
ALTER TABLE screen_policies ADD COLUMN IF NOT EXISTS session_rewards integer[] NOT NULL DEFAULT '{30,10,10}';
ALTER TABLE screen_policies ALTER COLUMN base_daily_minutes SET DEFAULT 0;
UPDATE screen_policies SET base_daily_minutes = 0;

-- Kid's "ask for more time" requests and the parent's decision.
CREATE TABLE IF NOT EXISTS screen_requests (
  id          bigserial   PRIMARY KEY,
  user_id     text        NOT NULL,
  device_id   uuid,
  minutes     integer     NOT NULL,
  status      text        NOT NULL DEFAULT 'pending',   -- pending | granted | denied
  granted_min integer,
  tg_message  bigint,
  created_at  timestamptz NOT NULL DEFAULT now(),
  decided_at  timestamptz
);
CREATE INDEX IF NOT EXISTS screen_requests_user_idx ON screen_requests (user_id, created_at DESC);
