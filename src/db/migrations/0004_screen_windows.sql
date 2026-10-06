-- Each grant records the unlock window it produced, so usage can be computed per day.
ALTER TABLE screen_grants ADD COLUMN IF NOT EXISTS window_start timestamptz;
ALTER TABLE screen_grants ADD COLUMN IF NOT EXISTS window_end   timestamptz;
UPDATE screen_grants SET window_start = created_at, window_end = created_at + make_interval(mins => minutes) WHERE window_start IS NULL;
