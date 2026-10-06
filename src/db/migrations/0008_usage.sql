-- Usage-based limits: the phone reports minutes actually spent in each group (5-minute steps from DeviceActivity).
CREATE TABLE IF NOT EXISTS screen_usage (
  user_id      text    NOT NULL,
  group_key    text    NOT NULL,
  day          date    NOT NULL,          -- local (Europe/Lisbon) day
  used_minutes integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_key, day)
);
