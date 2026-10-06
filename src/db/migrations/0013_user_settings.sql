-- Per-child learning settings.
CREATE TABLE IF NOT EXISTS user_settings (
  user_id         text    PRIMARY KEY,
  missing_enabled boolean NOT NULL DEFAULT false,   -- show "… × 6 = 36" cards
  updated_at      timestamptz NOT NULL DEFAULT now()
);
-- Missing-factor cards are active again; who sees them is decided per child.
UPDATE cards SET active = true WHERE kind = 'missing';
-- Enable per child with: INSERT INTO user_settings (user_id, missing_enabled) VALUES ('<user id>', true)
--   ON CONFLICT (user_id) DO UPDATE SET missing_enabled = EXCLUDED.missing_enabled;
