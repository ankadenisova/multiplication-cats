import { sql, APP_TZ } from "@/db";
import { hintFor } from "@/lib/hints";
import { applyAnswer, overdueRatio, LEARNED_STAGE, NEW_PER_DAY, RELEARN_DELAY_MS, SESSION_SIZE, type AnswerResult } from "@/lib/srs";
import { getPolicy, grantSessionReward, notifySessionFinished } from "@/lib/screen";

type Row = {
  id: number; kind: string; a: number; b: number; answer: number;
  stage: number | null; relearning: boolean | null; next_review: string | null;
  lapses: number | null; streak: number | null; first_seen_at: string | null;
};

/** kind 'mul': a × b = ?   ·   'missing': a × … = p (factor named by `blank` hidden)   ·   'div': p ÷ (the other factor) = blank factor. */
export type ShownCard = { id: number; a: number; b: number; kind?: "mul" | "missing" | "div"; blank?: "a" | "b"; product?: number };

/** A division card unlocks once its multiplication fact was answered right at least once. */
const DIV_UNLOCK_STAGE = 1;

/** Share of a session given to extra card types (missing factor, division) when some are available. */
const MISSING_SHARE = 0.3;
/** A missing-factor card unlocks once its plain fact reached this stage (answered right on two different days). */
const MISSING_UNLOCK_STAGE = 2;
export type SessionInfo = { id: number; size: number; answered: number; correct: number; finished: boolean };
export type HomeInfo = {
  todaySessions: number; dayStreak: number; learned: number; total: number;
  todayAnswered: number; todayCorrect: number; openSession: SessionInfo | null;
  /** Album: all counted sessions ever (one cat sticker each). */
  stickersTotal: number;
  /** Screen-time minutes earned today and how many sessions per day give minutes. */
  minutesToday: number; rewardSessions: number;
};

const DAY = 86_400_000;
/** A session is counted only with at least this many correct answers… */
export const MIN_CORRECT = 4;
/** …and fewer than this many "не помню". */
export const MAX_DONT_KNOW = 7;

function localDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: APP_TZ }); // YYYY-MM-DD
}

function shuffle(card: Row): ShownCard {
  const [a, b] = Math.random() < 0.5 ? [card.a, card.b] : [card.b, card.a];
  if (card.kind === "missing" || card.kind === "div") {
    return { id: card.id, a, b, kind: card.kind, blank: Math.random() < 0.5 ? "a" : "b", product: card.a * card.b };
  }
  return { id: card.id, a, b, kind: "mul" };
}

/** Consecutive days (ending today or yesterday) with at least one finished session. */
async function sessionDayStreak(userId: string): Promise<number> {
  const days = (await sql`
    SELECT DISTINCT (finished_at AT TIME ZONE ${APP_TZ})::date::text AS day
    FROM sessions WHERE user_id = ${userId} AND finished_at IS NOT NULL AND counted`) as { day: string }[];
  const set = new Set(days.map((d) => d.day));
  let cursor = new Date();
  if (!set.has(localDate(cursor))) cursor = new Date(cursor.getTime() - DAY);
  let streak = 0;
  while (set.has(localDate(cursor))) { streak++; cursor = new Date(cursor.getTime() - DAY); }
  return streak;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSessionInfo(s: Record<string, any>): SessionInfo {
  return { id: Number(s.id), size: s.size, answered: s.answered, correct: s.correct, finished: s.finished_at !== null };
}

export async function getHome(userId: string): Promise<HomeInfo> {
  const [today] = await sql`
    SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND counted)::int AS sessions,
           coalesce(sum(answered), 0)::int AS answered, coalesce(sum(correct), 0)::int AS correct
    FROM sessions WHERE user_id = ${userId}
      AND (started_at AT TIME ZONE ${APP_TZ})::date = (now() AT TIME ZONE ${APP_TZ})::date`;
  const [open] = await sql`
    SELECT id, size, answered, correct, finished_at FROM sessions
    WHERE user_id = ${userId} AND finished_at IS NULL
      AND (started_at AT TIME ZONE ${APP_TZ})::date = (now() AT TIME ZONE ${APP_TZ})::date
    ORDER BY started_at DESC LIMIT 1`;
  const [learned] = await sql`
    SELECT count(*) FILTER (WHERE uc.stage >= ${LEARNED_STAGE})::int AS learned FROM user_cards uc JOIN cards c ON c.id = uc.card_id
    WHERE uc.user_id = ${userId} AND c.kind = 'mul' AND c.active
      AND (c.b <= 9 OR (SELECT ext_enabled FROM user_settings WHERE user_id = ${userId}))`;
  const [total] = await sql`SELECT count(*)::int AS total FROM cards WHERE kind = 'mul' AND active
    AND (b <= 9 OR coalesce((SELECT ext_enabled FROM user_settings WHERE user_id = ${userId}), false))`;
  const [stickers] = await sql`SELECT count(*)::int AS n FROM sessions WHERE user_id = ${userId} AND finished_at IS NOT NULL AND counted`;
  const policy = await getPolicy(userId, "default");
  return {
    stickersTotal: stickers?.n ?? 0,
    minutesToday: policy.earnedTodayMinutes, rewardSessions: policy.sessionRewards.length,
    todaySessions: today?.sessions ?? 0, dayStreak: await sessionDayStreak(userId),
    learned: learned?.learned ?? 0, total: total?.total ?? 0,
    todayAnswered: today?.answered ?? 0, todayCorrect: today?.correct ?? 0,
    openSession: open ? toSessionInfo(open) : null,
  };
}

/** Resume today's unfinished session or start a new one. */
export async function startSession(userId: string): Promise<SessionInfo> {
  const home = await getHome(userId);
  if (home.openSession) return home.openSession;
  const [s] = await sql`INSERT INTO sessions (user_id, size) VALUES (${userId}, ${SESSION_SIZE}) RETURNING id, size, answered, correct, finished_at`;
  return toSessionInfo(s);
}

/**
 * Pick the next card. Order: failed cards ready to retry → due reviews (most overdue first)
 * → new cards (daily limit) → failed cards still cooling down → random seen cards weighted to weak ones.
 * A session always gets a card.
 */
export type ChildSettings = { missing: boolean; div: boolean; ext: boolean };

export async function getSettings(userId: string): Promise<ChildSettings> {
  const [r] = await sql`SELECT missing_enabled, div_enabled, ext_enabled FROM user_settings WHERE user_id = ${userId}`;
  return { missing: Boolean(r?.missing_enabled), div: Boolean(r?.div_enabled), ext: Boolean(r?.ext_enabled) };
}

export async function getNextCard(userId: string, excludeCardId?: number): Promise<ShownCard> {
  const all = (await sql`
    SELECT c.id, c.kind, c.a, c.b, c.answer, uc.stage, uc.relearning, uc.next_review, uc.lapses, uc.streak, uc.first_seen_at
    FROM cards c LEFT JOIN user_cards uc ON uc.card_id = c.id AND uc.user_id = ${userId}
    WHERE c.kind IN ('mul', 'missing', 'div') AND c.active`) as Row[];
  const now = new Date();
  const today = localDate(now);
  const notSame = (list: Row[]) => list.filter((r) => r.id !== excludeCardId);
  const pick = (list: Row[]) => list[Math.floor(Math.random() * list.length)];

  const st = await getSettings(userId);
  const missingEnabled = st.missing;
  // ×11 / ×12 facts only for children who have them switched on.
  const inScope = (r: Row) => st.ext || r.b <= 9;
  const mul = all.filter((r) => r.kind === "mul" && inScope(r));
  // Missing-factor cards: available once seen, or once their plain fact is known well enough.
  const mulStage = new Map(mul.map((r) => [`${r.a}x${r.b}`, r.stage ?? -1]));
  const missing = !missingEnabled ? [] : all.filter((r) => r.kind === "missing" && inScope(r) && (r.stage !== null || (mulStage.get(`${r.a}x${r.b}`) ?? -1) >= MISSING_UNLOCK_STAGE));
  const div = !st.div ? [] : all.filter((r) => r.kind === "div" && inScope(r) && (r.stage !== null || (mulStage.get(`${r.a}x${r.b}`) ?? -1) >= DIV_UNLOCK_STAGE));

  const analyse = (rows: Row[]) => {
    const seen = rows.filter((r) => r.stage !== null);
    const due = seen.filter((r) => new Date(r.next_review!).getTime() <= now.getTime());
    return {
      rows, seen,
      unseen: rows.filter((r) => r.stage === null),
      newToday: seen.filter((r) => r.first_seen_at && localDate(r.first_seen_at) === today).length,
      dueRelearn: due.filter((r) => r.relearning).sort((x, y) => +new Date(x.next_review!) - +new Date(y.next_review!)),
      dueReview: due.filter((r) => !r.relearning)
        .sort((x, y) => overdueRatio(y.stage!, new Date(y.next_review!), now) - overdueRatio(x.stage!, new Date(x.next_review!), now)),
      pendingRelearn: seen.filter((r) => r.relearning && new Date(r.next_review!).getTime() > now.getTime())
        .sort((x, y) => +new Date(x.next_review!) - +new Date(y.next_review!)),
    };
  };

  /** Due/new selection within one kind; null when this kind has nothing scheduled right now. */
  const scheduled = (q: ReturnType<typeof analyse>): Row | null => {
    if (notSame(q.dueRelearn).length) return notSame(q.dueRelearn)[0];
    if (notSame(q.dueReview).length) return notSame(q.dueReview)[0];
    if (q.unseen.length && q.newToday < NEW_PER_DAY) return pick(q.unseen);
    return null;
  };

  /** Filler when nothing is scheduled: new cards (50%) or seen ones weighted towards weak. */
  const filler = (q: ReturnType<typeof analyse>): Row | null => {
    const pool = notSame(q.seen.filter((r) => !r.relearning));
    if (q.unseen.length && (!pool.length || Math.random() < 0.5)) return pick(q.unseen);
    if (pool.length) {
      const weights = pool.map((r) => 1 + Math.max(0, 5 - (r.stage ?? 0)));
      let t = Math.random() * weights.reduce((s, w) => s + w, 0);
      for (let i = 0; i < pool.length; i++) { t -= weights[i]; if (t <= 0) return pool[i]; }
      return pool[pool.length - 1];
    }
    if (notSame(q.pendingRelearn).length) return notSame(q.pendingRelearn)[0];
    return null;
  };

  const qm = analyse(mul);
  // Each extra type keeps its own daily new-card limit; within the extras slice pick a type at random.
  const extraQs = [analyse(missing), analyse(div)].filter((q) => q.rows.length > 0).sort(() => Math.random() - 0.5);
  const allRelearn = [qm, ...extraQs].flatMap((q) => notSame(q.dueRelearn));
  // Failed cards waiting for a retry come first, whatever their kind.
  let card: Row | null | undefined = allRelearn.sort((x, y) => +new Date(x.next_review!) - +new Date(y.next_review!))[0];
  if (!card) {
    const preferExtra = extraQs.length > 0 && Math.random() < MISSING_SHARE;
    const order = preferExtra ? [...extraQs, qm] : [qm, ...extraQs];
    for (const q of order) { card = scheduled(q); if (card) break; }
    if (!card) for (const q of order) { card = filler(q); if (card) break; }
    if (!card) card = pick(mul);
  }
  return shuffle(card);
}

export type AnswerInput = {
  sessionId: number; cardId: number; shownA: number; shownB: number;
  answer: number | null; dontKnow: boolean; responseMs: number | null;
  blank?: "a" | "b" | null; // missing-factor cards: which shown factor was hidden
};

export async function recordAnswer(userId: string, input: AnswerInput) {
  const [session] = await sql`SELECT id, size, answered, correct, finished_at FROM sessions WHERE id = ${input.sessionId} AND user_id = ${userId}`;
  if (!session) throw new Error("session not found");
  if (session.finished_at) throw new Error("session finished");
  const [card] = await sql`SELECT id, kind, a, b, answer FROM cards WHERE id = ${input.cardId}`;
  if (!card) throw new Error("card not found");
  const isMissing = card.kind === "missing";
  const isDiv = card.kind === "div";
  const blank = isMissing || isDiv ? (input.blank === "b" ? "b" : "a") : null;
  // The shown factors must be this card's pair (in either order).
  const pairOk = (input.shownA === card.a && input.shownB === card.b) || (input.shownA === card.b && input.shownB === card.a);
  if (!pairOk) throw new Error("card mismatch");
  const expected: number = isMissing || isDiv ? (blank === "a" ? input.shownA : input.shownB) : card.answer;
  const divisor = blank === "a" ? input.shownB : input.shownA;
  const [uc] = await sql`SELECT stage, relearning, next_review, streak, lapses FROM user_cards WHERE user_id = ${userId} AND card_id = ${input.cardId}`;
  const now = new Date();
  const stageBefore: number = uc?.stage ?? 0;
  const isDue = !uc || new Date(uc.next_review).getTime() <= now.getTime();
  const correct = !input.dontKnow && input.answer === expected;
  const result: AnswerResult = correct ? "correct" : input.dontKnow ? "dontknow" : "wrong";
  const next = applyAnswer(
    { stage: stageBefore, relearning: uc?.relearning ?? false, streak: uc?.streak ?? 0, lapses: uc?.lapses ?? 0, isDue },
    result, now,
  );
  const nextReview = next.nextReview ?? new Date(uc?.next_review ?? now);
  const mode = isDue ? "learn" : "practice";
  const answered = session.answered + 1;
  const correctTotal = session.correct + (correct ? 1 : 0);
  const finished = answered >= session.size;

  // Duplicate guard: the same card answered twice in a row within a few seconds is a repeated tap.
  const [last] = await sql`SELECT card_id, created_at FROM reviews WHERE session_id = ${input.sessionId} ORDER BY id DESC LIMIT 1`;
  if (last && last.card_id === input.cardId && now.getTime() - new Date(last.created_at).getTime() < 10_000) {
    throw new Error("duplicate answer");
  }
  // Claim this answer slot atomically: concurrent taps race here and only one wins.
  const claimed = await sql`UPDATE sessions SET answered = ${answered}, correct = ${correctTotal}, finished_at = ${finished ? now.toISOString() : null}
    WHERE id = ${input.sessionId} AND answered = ${session.answered} AND finished_at IS NULL RETURNING id`;
  if (claimed.length === 0) throw new Error("duplicate answer");

  await sql.transaction([
    sql`INSERT INTO user_cards (user_id, card_id, stage, relearning, next_review, last_review, correct_count, wrong_count, dont_know_count, lapses, streak, first_seen_at, updated_at)
        VALUES (${userId}, ${input.cardId}, ${next.stage}, ${next.relearning}, ${nextReview.toISOString()}, ${now.toISOString()},
                ${correct ? 1 : 0}, ${result === "wrong" ? 1 : 0}, ${result === "dontknow" ? 1 : 0}, ${next.lapses}, ${next.streak}, ${now.toISOString()}, ${now.toISOString()})
        ON CONFLICT (user_id, card_id) DO UPDATE SET
          stage = EXCLUDED.stage, relearning = EXCLUDED.relearning, next_review = EXCLUDED.next_review, last_review = EXCLUDED.last_review,
          correct_count = user_cards.correct_count + EXCLUDED.correct_count,
          wrong_count = user_cards.wrong_count + EXCLUDED.wrong_count,
          dont_know_count = user_cards.dont_know_count + EXCLUDED.dont_know_count,
          lapses = EXCLUDED.lapses, streak = EXCLUDED.streak, updated_at = EXCLUDED.updated_at`,
    sql`INSERT INTO reviews (user_id, card_id, session_id, shown_a, shown_b, answer_given, is_correct, dont_know, response_ms, mode, stage_before, stage_after, blank)
        VALUES (${userId}, ${input.cardId}, ${input.sessionId}, ${input.shownA}, ${input.shownB}, ${input.answer}, ${correct}, ${input.dontKnow}, ${input.responseMs}, ${mode}, ${stageBefore}, ${next.stage}, ${blank})`,
  ]);

  const sessionInfo: SessionInfo = { id: Number(session.id), size: session.size, answered, correct: correctTotal, finished };

  // A finished session counts only if the child really tried:
  // at least MIN_CORRECT correct answers and fewer than MAX_DONT_KNOW "не помню".
  let failReason: "dontknow" | "fewcorrect" | null = null;
  if (finished) {
    const [{ cnt }] = (await sql`
      SELECT COUNT(*)::int AS cnt FROM reviews
      WHERE session_id = ${input.sessionId} AND dont_know = true
    `) as [{ cnt: number }];
    if (cnt >= MAX_DONT_KNOW) failReason = "dontknow";
    else if (correctTotal < MIN_CORRECT) failReason = "fewcorrect";
    if (failReason) await sql`UPDATE sessions SET counted = false WHERE id = ${input.sessionId}`;
  }
  const tooManyDontKnow = failReason !== null;

  // Screen-time reward for the iOS companion app (0 minutes when no phone is paired or the daily cap is reached).
  const reward = finished && !tooManyDontKnow ? await grantSessionReward(userId, Number(session.id)) : null;
  if (finished) {
    await notifySessionFinished(userId, { correct: correctTotal, size: session.size, failReason, rewardMinutes: reward?.minutes ?? 0 })
      .catch((e) => console.error("notifySessionFinished", e));
  }
  return {
    reward: reward && reward.policy ? { minutes: reward.minutes, balance: reward.policy.balanceMinutes } : null,
    correct,
    answer: expected,
    hint: correct ? null
      : isDiv ? `${input.shownA * input.shownB} ÷ ${divisor} = ${expected}, потому что ${divisor} × ${expected} = ${input.shownA * input.shownB}`
      : isMissing ? `${input.shownA} × ${input.shownB} = ${input.shownA * input.shownB}` : hintFor(input.shownA, input.shownB),
    stage: next.stage,
    comeBackInSec: correct ? null : Math.round(RELEARN_DELAY_MS / 1000),
    session: sessionInfo,
    home: finished ? await getHome(userId) : null,
    tooManyDontKnow: tooManyDontKnow || undefined, // legacy name: session not counted
    failReason,
  };
}

export type ProgressData = {
  grid: { a: number; b: number; answer: number; stage: number | null; lapses: number; nextReview: string | null }[];
  learned: number; learning: number; struggling: number; notStarted: number; total: number;
  missingLearned: number; missingSeen: number; missingEnabled: boolean;
  today: { answered: number; correct: number; sessions: number };
  week: { answered: number; correct: number; sessions: number };
  allTime: { answered: number; correct: number; sessions: number };
  dayStreak: number;
  hardest: { a: number; b: number; answer: number; wrong: number; correct: number }[];
  lastDays: { day: string; answered: number; correct: number; sessions: number }[];
};

export async function getProgress(userId: string): Promise<ProgressData> {
  const rows = (await sql`
    SELECT c.a, c.b, c.answer, c.active, uc.stage, uc.lapses, uc.next_review, uc.correct_count, uc.wrong_count, uc.dont_know_count
    FROM cards c LEFT JOIN user_cards uc ON uc.card_id = c.id AND uc.user_id = ${userId}
    WHERE c.kind = 'mul' ORDER BY c.a, c.b`) as {
      a: number; b: number; answer: number; active: boolean; stage: number | null; lapses: number | null; next_review: string | null;
      correct_count: number | null; wrong_count: number | null; dont_know_count: number | null;
    }[];
  // Retired cards (e.g. 2×2) show as known forever in the grid and are left out of the counts.
  const grid = rows.map((r) => ({ a: r.a, b: r.b, answer: r.answer, stage: r.active ? r.stage : 7, lapses: r.lapses ?? 0, nextReview: r.next_review }));
  const settings = await getSettings(userId);
  const activeRows = rows.filter((r) => r.active && (settings.ext || r.b <= 9));
  const seen = activeRows.filter((r) => r.stage !== null);
  const learned = seen.filter((r) => r.stage! >= LEARNED_STAGE).length;
  const learning = seen.filter((r) => r.stage! >= 1 && r.stage! < LEARNED_STAGE).length;
  const struggling = seen.filter((r) => r.stage === 0).length;

  const days = (await sql`
    SELECT (created_at AT TIME ZONE ${APP_TZ})::date::text AS day, count(*)::int AS answered, count(*) FILTER (WHERE is_correct)::int AS correct
    FROM reviews WHERE user_id = ${userId} GROUP BY 1 ORDER BY 1 DESC`) as { day: string; answered: number; correct: number }[];
  const sessDays = (await sql`
    SELECT (finished_at AT TIME ZONE ${APP_TZ})::date::text AS day, count(*)::int AS sessions
    FROM sessions WHERE user_id = ${userId} AND finished_at IS NOT NULL AND counted GROUP BY 1`) as { day: string; sessions: number }[];
  const sessByDay = new Map(sessDays.map((d) => [d.day, d.sessions]));
  const [mx] = (await sql`SELECT count(*) FILTER (WHERE uc.stage >= ${LEARNED_STAGE})::int AS learned, count(*)::int AS seen
    FROM user_cards uc JOIN cards c ON c.id = uc.card_id WHERE uc.user_id = ${userId} AND c.kind = 'missing' AND c.active`) as { learned: number; seen: number }[];
  const todayStr = localDate(new Date());
  const weekAgo = localDate(new Date(Date.now() - 6 * DAY));
  const agg = (filter: (day: string) => boolean) => {
    const r = days.filter((d) => filter(d.day)).reduce((s, d) => ({ answered: s.answered + d.answered, correct: s.correct + d.correct }), { answered: 0, correct: 0 });
    const sessions = sessDays.filter((d) => filter(d.day)).reduce((s, d) => s + d.sessions, 0);
    return { ...r, sessions };
  };

  const hardest = activeRows
    .filter((r) => (r.wrong_count ?? 0) + (r.dont_know_count ?? 0) > 0)
    .map((r) => ({ a: r.a, b: r.b, answer: r.answer, wrong: (r.wrong_count ?? 0) + (r.dont_know_count ?? 0), correct: r.correct_count ?? 0 }))
    .sort((x, y) => y.wrong - x.wrong || x.correct - y.correct)
    .slice(0, 6);

  const lastDays: ProgressData["lastDays"] = [];
  for (let i = 13; i >= 0; i--) {
    const day = localDate(new Date(Date.now() - i * DAY));
    const d = days.find((x) => x.day === day);
    lastDays.push({ day, answered: d?.answered ?? 0, correct: d?.correct ?? 0, sessions: sessByDay.get(day) ?? 0 });
  }

  return {
    grid, learned, learning, struggling, notStarted: activeRows.length - seen.length, total: activeRows.length,
    missingLearned: mx?.learned ?? 0, missingSeen: mx?.seen ?? 0,
    missingEnabled: Boolean((await sql`SELECT missing_enabled FROM user_settings WHERE user_id = ${userId}`)[0]?.missing_enabled),
    today: agg((d) => d === todayStr), week: agg((d) => d >= weekAgo), allTime: agg(() => true),
    dayStreak: await sessionDayStreak(userId), hardest, lastDays,
  };
}
