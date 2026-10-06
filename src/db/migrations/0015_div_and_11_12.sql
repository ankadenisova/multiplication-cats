-- Per-child switches for division cards and ×11/×12 facts.
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS div_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS ext_enabled boolean NOT NULL DEFAULT false;  -- ×11 and ×12

-- ×11 and ×12 multiplication facts (a <= b): 2..11 × 11 and 2..12 × 12.
INSERT INTO cards (id, kind, a, b, answer)
SELECT 72 + row_number() OVER (ORDER BY b, a), 'mul', a, b, a * b
FROM (SELECT a, 11 AS b FROM generate_series(2, 11) a UNION ALL SELECT a, 12 FROM generate_series(2, 12) a) f
ON CONFLICT (kind, a, b) DO NOTHING;

-- Division cards "p ÷ d = ?", one per multiplication fact (id = 200 + mul id), same active flag.
INSERT INTO cards (id, kind, a, b, answer, active)
SELECT 200 + id, 'div', a, b, a * b, active FROM cards WHERE kind = 'mul'
ON CONFLICT (kind, a, b) DO NOTHING;
