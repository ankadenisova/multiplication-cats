-- App groups with independent budgets: 'default' (everything) and 'social' (messengers).
ALTER TABLE screen_policies ADD COLUMN IF NOT EXISTS group_key text NOT NULL DEFAULT 'default';
ALTER TABLE screen_policies DROP CONSTRAINT IF EXISTS screen_policies_pkey;
ALTER TABLE screen_policies ADD PRIMARY KEY (user_id, group_key);
ALTER TABLE screen_grants   ADD COLUMN IF NOT EXISTS group_key text NOT NULL DEFAULT 'default';
ALTER TABLE screen_windows  ADD COLUMN IF NOT EXISTS group_key text NOT NULL DEFAULT 'default';
ALTER TABLE screen_requests ADD COLUMN IF NOT EXISTS group_key text NOT NULL DEFAULT 'default';
