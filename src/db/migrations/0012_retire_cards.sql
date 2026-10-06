-- Retired cards are never shown again (2×2 is too easy). Kept in the table for history.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
UPDATE cards SET active = false WHERE a = 2 AND b = 2;
