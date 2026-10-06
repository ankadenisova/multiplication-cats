-- A finished session counts (reward, streak, "sessions today") only if the child really tried.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS counted boolean NOT NULL DEFAULT true;
UPDATE sessions s SET counted = false
WHERE s.finished_at IS NOT NULL AND (
  s.correct < 4 OR (SELECT count(*) FROM reviews r WHERE r.session_id = s.id AND r.dont_know) >= 7
);
