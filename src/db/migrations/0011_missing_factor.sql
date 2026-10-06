-- Missing-factor cards ("… × 6 = 36"): one per unordered pair, own SRS state. answer = product.
INSERT INTO cards (id, kind, a, b, answer) VALUES
  (37, 'missing', 2, 2, 4),
  (38, 'missing', 2, 3, 6),
  (39, 'missing', 2, 4, 8),
  (40, 'missing', 2, 5, 10),
  (41, 'missing', 2, 6, 12),
  (42, 'missing', 2, 7, 14),
  (43, 'missing', 2, 8, 16),
  (44, 'missing', 2, 9, 18),
  (45, 'missing', 3, 3, 9),
  (46, 'missing', 3, 4, 12),
  (47, 'missing', 3, 5, 15),
  (48, 'missing', 3, 6, 18),
  (49, 'missing', 3, 7, 21),
  (50, 'missing', 3, 8, 24),
  (51, 'missing', 3, 9, 27),
  (52, 'missing', 4, 4, 16),
  (53, 'missing', 4, 5, 20),
  (54, 'missing', 4, 6, 24),
  (55, 'missing', 4, 7, 28),
  (56, 'missing', 4, 8, 32),
  (57, 'missing', 4, 9, 36),
  (58, 'missing', 5, 5, 25),
  (59, 'missing', 5, 6, 30),
  (60, 'missing', 5, 7, 35),
  (61, 'missing', 5, 8, 40),
  (62, 'missing', 5, 9, 45),
  (63, 'missing', 6, 6, 36),
  (64, 'missing', 6, 7, 42),
  (65, 'missing', 6, 8, 48),
  (66, 'missing', 6, 9, 54),
  (67, 'missing', 7, 7, 49),
  (68, 'missing', 7, 8, 56),
  (69, 'missing', 7, 9, 63),
  (70, 'missing', 8, 8, 64),
  (71, 'missing', 8, 9, 72),
  (72, 'missing', 9, 9, 81)
ON CONFLICT (id) DO NOTHING;

-- Which factor was hidden ('a' = first shown factor, 'b' = second); NULL for plain multiplication.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS blank text;

-- Overview counts plain multiplication facts only.
DROP VIEW IF EXISTS user_progress;
CREATE VIEW user_progress AS
SELECT
  u.id AS user_id, u.email, u.name,
  count(uc.card_id) FILTER (WHERE c.kind = 'mul' AND uc.stage >= 4)            AS learned,
  count(uc.card_id) FILTER (WHERE c.kind = 'mul' AND uc.stage BETWEEN 1 AND 3) AS learning,
  count(uc.card_id) FILTER (WHERE c.kind = 'mul' AND uc.stage = 0)             AS struggling,
  (SELECT count(*) FROM cards WHERE kind = 'mul') - count(uc.card_id) FILTER (WHERE c.kind = 'mul') AS not_started,
  count(uc.card_id) FILTER (WHERE c.kind = 'missing' AND uc.stage >= 4)        AS missing_learned,
  count(uc.card_id) FILTER (WHERE c.kind = 'missing')                          AS missing_seen,
  coalesce(sum(uc.correct_count), 0)                                           AS correct_total,
  coalesce(sum(uc.wrong_count + uc.dont_know_count), 0)                        AS wrong_total,
  (SELECT count(*) FROM sessions s WHERE s.user_id = u.id::text AND s.finished_at IS NOT NULL AND s.counted) AS sessions_finished,
  max(uc.last_review)                                                          AS last_activity
FROM neon_auth."user" u
LEFT JOIN user_cards uc ON uc.user_id = u.id::text
LEFT JOIN cards c ON c.id = uc.card_id
GROUP BY u.id, u.email, u.name;
