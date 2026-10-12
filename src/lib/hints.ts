/**
 * "How to remember" hint for a multiplication fact, in the UI language (see src/lib/i18n).
 * Returns null when the fact should simply be memorised (×2, ×3 and their squares).
 * Priority: ×9 trick first (it also covers 2×9 and 3×9), then squares, ×5, ×4, ×8, ×6, ×7.
 */
import { t } from "@/lib/i18n";

export function hintFor(x: number, y: number): string | null {
  const h = t.hints;
  const [a, b] = x <= y ? [x, y] : [y, x];
  if (b === 11) return a === 11 ? h.x11Square : h.x11(a);
  if (b === 12) return h.x12(a);
  if (b === 9) return h.x9(a);
  if (a <= 3) return null; // ×2 and ×3: just memorise

  const special = h.special[`${a}x${b}`];
  if (special) return special;

  if (a === b) return h.square(a);
  if (a === 5) return b % 2 === 0 ? h.x5even(b) : h.x5odd(b);
  if (a === 4) return h.x4(b);
  if (b === 8) return h.x8(a);
  if (a === 6) return h.x6(b);
  if (a === 7) return h.x7(b);
  return null;
}

/**
 * A way to work the fact out WITHOUT revealing the result — shown on the first "I don't remember" tap,
 * so the child can still compute and type the answer.
 */
export function strategyFor(x: number, y: number): string {
  const s = t.hints.strategy;
  const [a, b] = x <= y ? [x, y] : [y, x];
  if (b === 11) return s.x11(a);
  if (b === 12) return s.x12(a);
  if (b === 9) return s.x9(a);
  if (a === 2) return s.x2(b);
  if (a === 3) return s.x3(b);
  if (a === 4) return s.x4(b);
  if (a === 5) return b % 2 === 0 ? s.x5even(b) : s.x5odd(b);
  if (a === 6) return s.x6(b);
  if (a === 7) return s.x7(b);
  return s.x8(b); // 8 × 8
}

/** Strategy for "… × known = product" without revealing the missing factor. */
export function missingStrategyFor(known: number, product: number): string {
  return t.hints.missing(known, product);
}

/** Strategy for "p ÷ d = ?" without the result. */
export function divStrategyFor(divisor: number, product: number): string {
  return t.hints.div(divisor, product);
}
