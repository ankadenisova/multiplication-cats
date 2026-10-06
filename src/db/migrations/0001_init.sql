-- StudyApp initial schema. Applied via: npm run db:migrate

CREATE TABLE IF NOT EXISTS cards (
  id      integer PRIMARY KEY,
  kind    text    NOT NULL DEFAULT 'mul',   -- 'mul' now; later 'div', 'missing' (… x 3 = 18)
  a       integer NOT NULL,
  b       integer NOT NULL,                 -- for 'mul': a <= b, shown in random order
  answer  integer NOT NULL,
  UNIQUE (kind, a, b)
);

INSERT INTO cards (id, kind, a, b, answer) VALUES
  (1, 'mul', 2, 2, 4),
  (2, 'mul', 2, 3, 6),
  (3, 'mul', 2, 4, 8),
  (4, 'mul', 2, 5, 10),
  (5, 'mul', 2, 6, 12),
  (6, 'mul', 2, 7, 14),
  (7, 'mul', 2, 8, 16),
  (8, 'mul', 2, 9, 18),
  (9, 'mul', 3, 3, 9),
  (10, 'mul', 3, 4, 12),
  (11, 'mul', 3, 5, 15),
  (12, 'mul', 3, 6, 18),
  (13, 'mul', 3, 7, 21),
  (14, 'mul', 3, 8, 24),
  (15, 'mul', 3, 9, 27),
  (16, 'mul', 4, 4, 16),
  (17, 'mul', 4, 5, 20),
  (18, 'mul', 4, 6, 24),
  (19, 'mul', 4, 7, 28),
  (20, 'mul', 4, 8, 32),
  (21, 'mul', 4, 9, 36),
  (22, 'mul', 5, 5, 25),
  (23, 'mul', 5, 6, 30),
  (24, 'mul', 5, 7, 35),
  (25, 'mul', 5, 8, 40),
  (26, 'mul', 5, 9, 45),
  (27, 'mul', 6, 6, 36),
  (28, 'mul', 6, 7, 42),
  (29, 'mul', 6, 8, 48),
  (30, 'mul', 6, 9, 54),
  (31, 'mul', 7, 7, 49),
  (32, 'mul', 7, 8, 56),
  (33, 'mul', 7, 9, 63),
  (34, 'mul', 8, 8, 64),
  (35, 'mul', 8, 9, 72),
  (36, 'mul', 9, 9, 81)
ON CONFLICT (id) DO NOTHING;

-- Per-user spaced-repetition state, one row per card the user has seen.
CREATE TABLE IF NOT EXISTS user_cards (
  user_id         text        NOT NULL,          -- neon_auth."user".id
  card_id         integer     NOT NULL REFERENCES cards(id),
  stage           integer     NOT NULL DEFAULT 0, -- 0 new … 7 mastered (interval ladder)
  relearning      boolean     NOT NULL DEFAULT false, -- failed this session, comes back in a minute
  next_review     timestamptz NOT NULL DEFAULT now(),
  last_review     timestamptz,
  correct_count   integer     NOT NULL DEFAULT 0,
  wrong_count     integer     NOT NULL DEFAULT 0,
  dont_know_count integer     NOT NULL DEFAULT 0,
  lapses          integer     NOT NULL DEFAULT 0, -- times a known card was forgotten
  streak          integer     NOT NULL DEFAULT 0, -- consecutive correct answers
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_id)
);
CREATE INDEX IF NOT EXISTS user_cards_due_idx ON user_cards (user_id, next_review);

-- Every single answer, for analytics.
CREATE TABLE IF NOT EXISTS reviews (
  id            bigserial   PRIMARY KEY,
  user_id       text        NOT NULL,
  card_id       integer     NOT NULL REFERENCES cards(id),
  shown_a       integer     NOT NULL,   -- order as displayed (3 x 7 vs 7 x 3)
  shown_b       integer     NOT NULL,
  answer_given  integer,                -- NULL when "не помню"
  is_correct    boolean     NOT NULL,
  dont_know     boolean     NOT NULL DEFAULT false,
  response_ms   integer,
  mode          text        NOT NULL DEFAULT 'learn', -- 'learn' | 'practice'
  stage_before  integer     NOT NULL,
  stage_after   integer     NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_user_time_idx ON reviews (user_id, created_at DESC);

-- Quick per-user overview for psql: select * from user_progress;
CREATE OR REPLACE VIEW user_progress AS
SELECT
  u.id                                                        AS user_id,
  u.email,
  u.name,
  count(uc.card_id) FILTER (WHERE uc.stage >= 4)              AS learned,
  count(uc.card_id) FILTER (WHERE uc.stage BETWEEN 1 AND 3)   AS learning,
  count(uc.card_id) FILTER (WHERE uc.stage = 0)               AS struggling,
  (SELECT count(*) FROM cards WHERE kind = 'mul') - count(uc.card_id) AS not_started,
  coalesce(sum(uc.correct_count), 0)                          AS correct_total,
  coalesce(sum(uc.wrong_count + uc.dont_know_count), 0)       AS wrong_total,
  max(uc.last_review)                                         AS last_activity
FROM neon_auth."user" u
LEFT JOIN user_cards uc ON uc.user_id = u.id::text
GROUP BY u.id, u.email, u.name;
