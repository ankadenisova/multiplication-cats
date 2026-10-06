-- Sessions: one session = SESSION_SIZE cards in a row. Day streak counts days with >= 1 finished session.
CREATE TABLE IF NOT EXISTS sessions (
  id          bigserial   PRIMARY KEY,
  user_id     text        NOT NULL,
  size        integer     NOT NULL DEFAULT 10,
  answered    integer     NOT NULL DEFAULT 0,
  correct     integer     NOT NULL DEFAULT 0,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id, started_at DESC);

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS session_id bigint REFERENCES sessions(id);

DROP VIEW IF EXISTS user_progress;
CREATE VIEW user_progress AS
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
  (SELECT count(*) FROM sessions s WHERE s.user_id = u.id::text AND s.finished_at IS NOT NULL) AS sessions_finished,
  max(uc.last_review)                                         AS last_activity
FROM neon_auth."user" u
LEFT JOIN user_cards uc ON uc.user_id = u.id::text
GROUP BY u.id, u.email, u.name;
