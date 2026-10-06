/**
 * Stage-based spaced repetition (adapted from the FalasPortugues bot, v2 algorithm).
 *
 * Each card climbs a ladder of stages; every correct answer on a due card moves it
 * one stage up and pushes the next review further away. A wrong answer or
 * "не помню" drops it one stage and brings it back within the same session
 * (relearning). Once the relearned card is answered correctly it is due tomorrow.
 */

export const STAGE_INTERVALS_DAYS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16, 6: 30, 7: 60 };
export const MAX_STAGE = 7;
/** stage >= LEARNED_STAGE counts as "выучено" (interval 8+ days). */
export const LEARNED_STAGE = 4;
/** How soon a failed card comes back within the session. */
export const RELEARN_DELAY_MS = 90_000;
/** New facts introduced per day before the queue is empty; afterwards new and seen cards are mixed 50/50. */
export const NEW_PER_DAY = 10;
/** Cards per session. */
export const SESSION_SIZE = 10;

export type AnswerResult = "correct" | "wrong" | "dontknow";

export type CardState = {
  stage: number;
  relearning: boolean;
  streak: number;
  lapses: number;
  /** true when the card was due (or new) at answer time */
  isDue: boolean;
};

export type NextState = {
  stage: number;
  relearning: boolean;
  streak: number;
  lapses: number;
  nextReview: Date | null; // null = keep the current next_review
};

const DAY = 86_400_000;

export function applyAnswer(s: CardState, result: AnswerResult, now: Date): NextState {
  if (result !== "correct") {
    return {
      stage: Math.max(0, s.stage - 1),
      relearning: true,
      streak: 0,
      lapses: s.stage >= 1 ? s.lapses + 1 : s.lapses,
      nextReview: new Date(now.getTime() + RELEARN_DELAY_MS),
    };
  }
  if (s.relearning) {
    // Remembered after a mistake: keep the reduced stage, see it again tomorrow.
    return { stage: Math.max(1, s.stage), relearning: false, streak: s.streak + 1, lapses: s.lapses, nextReview: new Date(now.getTime() + DAY) };
  }
  if (s.isDue || s.stage === 0) {
    const stage = Math.min(MAX_STAGE, s.stage + 1);
    return { stage, relearning: false, streak: s.streak + 1, lapses: s.lapses, nextReview: new Date(now.getTime() + STAGE_INTERVALS_DAYS[stage] * DAY) };
  }
  // Practice answer on a card that was not due yet: log only, schedule unchanged.
  return { stage: s.stage, relearning: false, streak: s.streak + 1, lapses: s.lapses, nextReview: null };
}

/** overdue_days / stage_interval — higher means more urgently overdue (FalasPortugues heuristic). */
export function overdueRatio(stage: number, nextReview: Date, now: Date): number {
  const interval = STAGE_INTERVALS_DAYS[stage] ?? 1;
  const overdueDays = Math.max(0, (now.getTime() - nextReview.getTime()) / DAY);
  return overdueDays / interval;
}
