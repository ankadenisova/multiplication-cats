/**
 * "How to remember" hint for a multiplication fact, in Russian.
 * Returns null when the fact should simply be memorised (×2, ×3 and their squares).
 * Priority: ×9 trick first (it also covers 2×9 and 3×9), then squares, ×5, ×4, ×8, ×6, ×7.
 */

const SPECIAL: Record<string, string> = {
  "7x8": "Считай подряд: 5, 6, 7, 8 → 56 = 7 × 8",
  "6x8": "Рифма: шесть на восемь — сорок восемь. Или 5 × 8 = 40, ещё +8 = 48",
  "6x7": "5 × 7 = 35, ещё +7 = 42. Шесть на семь — сорок два",
  "4x7": "Удвой дважды: 7 → 14 → 28",
  "4x8": "Удвой дважды: 8 → 16 → 32",
  "4x6": "Удвой дважды: 6 → 12 → 24",
  "7x7": "Квадрат: семь на семь — сорок девять",
  "8x8": "Квадрат: восемь на восемь — шестьдесят четыре",
  "6x6": "Квадрат: шесть на шесть — тридцать шесть",
};

export function hintFor(x: number, y: number): string | null {
  const [a, b] = x <= y ? [x, y] : [y, x];
  if (b === 11) return a === 11 ? "11 × 10 = 110, плюс ещё 11 = 121" : `${a} × 10 = ${a * 10}, плюс ещё ${a} = ${a * 11}`;
  if (b === 12) return `${a} × 10 = ${a * 10} и ${a} × 2 = ${a * 2}, вместе ${a * 12}`;
  if (b === 9) return `${a} × 10 = ${a * 10}, минус ${a} = ${a * 9}`;
  if (a <= 3) return null; // ×2 и ×3 — просто запомнить

  const special = SPECIAL[`${a}x${b}`];
  if (special) return special;

  if (a === b) return `Квадрат: ${a} × ${a} = ${a * a}, просто запомни`;
  if (a === 5) {
    if (b % 2 === 0) return `×5 — половина от ×10: ${b} × 10 = ${b * 10}, половина = ${b * 5}`;
    return `5 × ${b - 1} = ${5 * (b - 1)}, ещё +5 = ${5 * b}`;
  }
  if (a === 4) return `×4 — удвой дважды: ${b} → ${2 * b} → ${4 * b}`;
  if (b === 8) return `×8 — удвой три раза: ${a} → ${2 * a} → ${4 * a} → ${8 * a}`;
  if (a === 6) return `×6 — это ×5 и ещё раз: 5 × ${b} = ${5 * b}, ${5 * b} + ${b} = ${6 * b}`;
  if (a === 7) return `7 × ${b}: 5 × ${b} = ${5 * b}, 2 × ${b} = ${2 * b}, вместе ${7 * b}`;
  return null;
}

/**
 * A way to work the fact out WITHOUT revealing the result — shown on the first "Не помню" tap,
 * so the child can still compute and type the answer herself.
 */
export function strategyFor(x: number, y: number): string {
  const [a, b] = x <= y ? [x, y] : [y, x];
  if (b === 11) return `${a} × 10 = ${a * 10}, прибавь ещё ${a}`;
  if (b === 12) return `${a} × 10 = ${a * 10} и ${a} × 2 = ${a * 2}, сложи их`;
  if (b === 9) return `${a} × 10 = ${a * 10}, а теперь отними ${a}`;
  if (a === 2) return `Сложи: ${b} + ${b}`;
  if (a === 3) return `Сложи три раза: ${b} + ${b} + ${b}`;
  if (a === 4) return `Удвой два раза: ${b} → ${2 * b} → ?`;
  if (a === 5) {
    if (b % 2 === 0) return `${b} × 10 = ${b * 10}, а теперь раздели пополам`;
    return `5 × ${b - 1} = ${5 * (b - 1)}, прибавь ещё 5`;
  }
  if (a === 6) return `5 × ${b} = ${5 * b}, прибавь ещё ${b}`;
  if (a === 7) return `5 × ${b} = ${5 * b} и 2 × ${b} = ${2 * b}, сложи их`;
  return `Удвой три раза: ${b} → ${2 * b} → ${4 * b} → ?`; // 8 × 8
}

/** Strategy for "… × known = product" without revealing the missing factor. */
export function missingStrategyFor(known: number, product: number): string {
  return `Какое число умножить на ${known}, чтобы получилось ${product}? Считай: ${known}, ${2 * known}, ${3 * known}…`;
}

/** Strategy for "p ÷ d = ?" without the result. */
export function divStrategyFor(divisor: number, product: number): string {
  return `На сколько умножить ${divisor}, чтобы получилось ${product}? Считай: ${divisor}, ${2 * divisor}, ${3 * divisor}…`;
}
