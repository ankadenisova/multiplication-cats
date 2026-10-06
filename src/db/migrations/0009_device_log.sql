-- Debug log lines posted by the iOS app / monitor extension (so the phone need not be plugged into a Mac).
CREATE TABLE IF NOT EXISTS device_log (
  id         bigserial   PRIMARY KEY,
  device_id  uuid        NOT NULL,
  at         timestamptz NOT NULL DEFAULT now(),
  source     text        NOT NULL,   -- 'app' | 'monitor'
  line       text        NOT NULL
);
CREATE INDEX IF NOT EXISTS device_log_device_idx ON device_log (device_id, at DESC);
