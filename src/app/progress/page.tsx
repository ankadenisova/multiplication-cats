import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { getProgress } from "@/lib/study";
import { LEARNED_STAGE, MAX_STAGE } from "@/lib/srs";
import { MIN_FACTOR, MAX_FACTOR } from "@/lib/facts";

export const dynamic = "force-dynamic";

const STAGE_BG = ["#fecaca", "#fde68a", "#fef08a", "#d9f99d", "#bbf7d0", "#86efac", "#4ade80", "#22c55e"];

function stageLabel(stage: number | null) {
  if (stage === null) return "ещё не было";
  if (stage === 0) return "путается";
  if (stage < LEARNED_STAGE) return "учит";
  if (stage < MAX_STAGE) return "знает";
  return "выучено навсегда";
}

export default async function ProgressPage() {
  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");
  const p = await getProgress(user.id);
  const byPair = new Map(p.grid.map((g) => [`${g.a}x${g.b}`, g]));
  const factors = Array.from({ length: MAX_FACTOR - MIN_FACTOR + 1 }, (_, i) => MIN_FACTOR + i);
  const pct = (c: number, t: number) => (t ? Math.round((c / t) * 100) : 0);
  const maxDay = Math.max(1, ...p.lastDays.map((d) => d.answered));

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-10">
      <header className="flex items-center justify-between py-4">
        <Link href="/" className="rounded-full bg-white px-3 py-1.5 text-sm shadow-sm">← Учить</Link>
        <h1 className="text-lg font-bold">Прогресс: {user.name}</h1>
      </header>

      <section className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-white p-3 shadow-sm"><div className="text-2xl font-bold text-[var(--ok)]">{p.learned}</div><div className="text-xs text-[var(--muted)]">выучено из {p.total}</div></div>
        <div className="rounded-2xl bg-white p-3 shadow-sm"><div className="text-2xl font-bold text-amber-500">{p.learning + p.struggling}</div><div className="text-xs text-[var(--muted)]">в процессе</div></div>
        <div className="rounded-2xl bg-white p-3 shadow-sm"><div className="text-2xl font-bold text-[var(--muted)]">{p.notStarted}</div><div className="text-xs text-[var(--muted)]">ещё не было</div></div>
      </section>

      <section className="mt-3 rounded-2xl bg-white p-3 shadow-sm text-sm">
        {p.missingEnabled && <div className="flex justify-between py-1"><span>Примеры «… × 6 = 36»</span><span className="font-semibold">выучено {p.missingLearned} из 35 · начато {p.missingSeen}</span></div>}
        <div className="flex justify-between py-1"><span>Дней подряд (≥1 сессия в день)</span><span className="font-semibold">🔥 {p.dayStreak}</span></div>
        <div className="flex justify-between py-1"><span>Сегодня</span><span className="font-semibold">{p.today.sessions} сес. · {p.today.correct} ✅ из {p.today.answered} ({pct(p.today.correct, p.today.answered)}%)</span></div>
        <div className="flex justify-between py-1"><span>За 7 дней</span><span className="font-semibold">{p.week.sessions} сес. · {p.week.correct} из {p.week.answered} ({pct(p.week.correct, p.week.answered)}%)</span></div>
        <div className="flex justify-between py-1"><span>Всего</span><span className="font-semibold">{p.allTime.sessions} сес. · {p.allTime.answered} отв. ({pct(p.allTime.correct, p.allTime.answered)}% верно)</span></div>
      </section>

      <section className="mt-3 rounded-2xl bg-white p-3 shadow-sm">
        <div className="mb-2 text-sm font-semibold">Ответов по дням</div>
        <div className="flex h-20 items-end gap-1">
          {p.lastDays.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col justify-end" title={`${d.day}: ${d.sessions} сес., ${d.correct}/${d.answered}`}>
              <div className="w-full rounded-t bg-[#ddd6fe]" style={{ height: `${(d.answered / maxDay) * 100}%` }}>
                <div className="w-full rounded-t bg-[var(--accent)]" style={{ height: d.answered ? `${(d.correct / d.answered) * 100}%` : 0 }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-[var(--muted)]"><span>2 недели назад</span><span>сегодня</span></div>
      </section>

      <section className="mt-3 rounded-2xl bg-white p-3 shadow-sm">
        <div className="mb-2 text-sm font-semibold">Таблица</div>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-center text-xs tabular-nums">
            <thead><tr><th></th>{factors.map((f) => <th key={f} className="text-[var(--muted)]">{f}</th>)}</tr></thead>
            <tbody>
              {factors.map((a) => (
                <tr key={a}>
                  <th className="text-[var(--muted)]">{a}</th>
                  {factors.map((b) => {
                    const g = byPair.get(a <= b ? `${a}x${b}` : `${b}x${a}`)!;
                    const bg = g.stage === null ? "#f3f4f6" : STAGE_BG[Math.min(g.stage, 7)];
                    return (
                      <td key={b} className="rounded-md py-1.5 font-semibold" style={{ background: bg }} title={`${a}×${b}=${g.answer}: ${stageLabel(g.stage)}`}>
                        {g.answer}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--muted)]">
          <span><i className="inline-block h-3 w-3 rounded-sm align-middle" style={{ background: "#f3f4f6" }} /> ещё не было</span>
          <span><i className="inline-block h-3 w-3 rounded-sm align-middle" style={{ background: STAGE_BG[0] }} /> путается</span>
          <span><i className="inline-block h-3 w-3 rounded-sm align-middle" style={{ background: STAGE_BG[2] }} /> учит</span>
          <span><i className="inline-block h-3 w-3 rounded-sm align-middle" style={{ background: STAGE_BG[5] }} /> знает</span>
          <span><i className="inline-block h-3 w-3 rounded-sm align-middle" style={{ background: STAGE_BG[7] }} /> навсегда</span>
        </div>
      </section>

      {p.hardest.length > 0 && (
        <section className="mt-3 rounded-2xl bg-white p-3 shadow-sm">
          <div className="mb-2 text-sm font-semibold">Самые трудные</div>
          <ul className="text-sm">
            {p.hardest.map((h) => (
              <li key={`${h.a}x${h.b}`} className="flex justify-between py-1 border-b border-gray-100 last:border-0">
                <span className="font-semibold tabular-nums">{h.a} × {h.b} = {h.answer}</span>
                <span className="text-[var(--muted)]">❌ {h.wrong} · ✅ {h.correct}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
