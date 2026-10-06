/** Multiplication facts in scope: 2..9 × 2..9, stored once per unordered pair (a <= b). */
export const MIN_FACTOR = 2;
export const MAX_FACTOR = 9;

export type Fact = { id: number; a: number; b: number; answer: number };

export const FACTS: Fact[] = (() => {
  const out: Fact[] = [];
  let id = 1;
  for (let a = MIN_FACTOR; a <= MAX_FACTOR; a++) {
    for (let b = a; b <= MAX_FACTOR; b++) out.push({ id: id++, a, b, answer: a * b });
  }
  return out;
})();

export const FACT_COUNT = FACTS.length; // 36

export function factById(id: number): Fact | undefined {
  return FACTS[id - 1];
}

export function factFor(x: number, y: number): Fact | undefined {
  const [a, b] = x <= y ? [x, y] : [y, x];
  return FACTS.find((f) => f.a === a && f.b === b);
}
