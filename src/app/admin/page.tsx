import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { parentEmails } from "@/lib/parent-auth";
import { GROUP_KEYS, allPolicies, getScreenStats, listDevices, listKids, pendingRequests, todayBuckets, todayGrants } from "@/lib/screen";
import { getProgress } from "@/lib/study";
import { apnsConfigured } from "@/lib/apns";
import ParentControls from "./ParentControls";
import KidTabs from "./KidTabs";

export const dynamic = "force-dynamic";

const h = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m} мин`);

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");
  if (!parentEmails().includes(user.email.toLowerCase())) redirect("/");

  const kids = (await listKids()).filter((k) => !parentEmails().includes(k.email.toLowerCase()));
  const rows = [];
  for (const k of kids) {
    const groups = await allPolicies(k.id);
    const stats = {} as Record<(typeof GROUP_KEYS)[number], Awaited<ReturnType<typeof getScreenStats>>>;
    for (const g of GROUP_KEYS) stats[g] = await getScreenStats(k.id, groups[g]);
    rows.push({
      user: k, groups, stats, devices: await listDevices(k.id), grants: await todayGrants(k.id), requests: await pendingRequests(k.id),
      study: await getProgress(k.id), buckets: await todayBuckets(k.id),
    });
  }
  const pct = (c: number, t: number) => (t ? Math.round((c / t) * 100) : 0);

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-10">
      <header className="flex items-center justify-between py-4">
        <Link href="/" className="rounded-full bg-white px-3 py-1.5 text-sm shadow-sm">← Учить</Link>
        <h1 className="text-lg font-bold">Админка</h1>
      </header>
      {!apnsConfigured() && <p className="mb-3 rounded-2xl bg-amber-50 p-3 text-xs text-amber-800">Пуши APNs не настроены: телефон узнаёт о командах при открытии приложения или по фоновому обновлению.</p>}

      <KidTabs tabs={rows.map((r) => ({ id: r.user.id, label: r.user.name, content: (
        <div className="space-y-3">
          <ParentControls data={{ user: r.user, groups: r.groups, devices: r.devices, grants: r.grants, requests: r.requests }} />

          {GROUP_KEYS.map((g) => { const s = r.stats[g]; const p = r.groups[g]; const maxDay = Math.max(30, ...s.days.map((d) => d.minutes)); return (
            <section key={g} className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold">📱 {p.groupName}{g === "social" ? " · Telegram, WhatsApp" : ""}</h3>
              <div className="grid grid-cols-2 gap-2 text-center text-sm">
                <div className="rounded-xl bg-[var(--bg)] p-2"><div className="text-xl font-bold">{h(s.todayUsedMin)}</div><div className="text-xs text-[var(--muted)]">использовано сегодня</div></div>
                <div className="rounded-xl bg-[var(--bg)] p-2"><div className="text-xl font-bold">{h(s.balanceMin)}</div><div className="text-xs text-[var(--muted)]">осталось на сегодня</div></div>
                <div className="rounded-xl bg-[var(--bg)] p-2"><div className="text-xl font-bold">{s.earnedTodayMin}{p.baseDailyMinutes ? ` + ${p.baseDailyMinutes}` : ""}</div><div className="text-xs text-[var(--muted)]">выдано сегодня{p.baseDailyMinutes ? " + база" : ""}{p.sessionRewards.length ? ` · след. сессия +${p.nextSessionReward}` : ""}</div></div>
                <div className="rounded-xl bg-[var(--bg)] p-2"><div className="text-xl font-bold">{h(s.weekMin)}</div><div className="text-xs text-[var(--muted)]">эта неделя</div></div>
                <div className="rounded-xl bg-[var(--bg)] p-2"><div className="text-xl font-bold">{h(s.monthMin)}</div><div className="text-xs text-[var(--muted)]">этот месяц</div></div>
              </div>
              <div className="mt-3 flex h-16 items-end gap-1">
                {s.days.map((d) => (
                  <div key={d.day} className="flex-1 rounded-t bg-[var(--accent)]" style={{ height: `${Math.max(2, (d.minutes / maxDay) * 100)}%`, opacity: d.minutes ? 1 : 0.15 }} title={`${d.day}: ${d.minutes} мин`} />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-[var(--muted)]"><span>2 недели назад</span><span>сегодня</span></div>
            </section>
          ); })}
          <p className="text-xs text-[var(--muted)]">Использование считает сам телефон поминутно и каждую минуту отправляет на сервер; iOS присылает события с задержкой до пары минут. Сегодня всего на телефоне {h(r.buckets.all)}, из них всегда разрешённые (Сообщения, Телефон…) {h(r.buckets.allowed)}. Разбивки по отдельным приложениям нет: Apple не отдаёт эти данные наружу.</p>

          <section className="rounded-2xl bg-white p-4 shadow-sm text-sm">
            <h3 className="mb-2 text-sm font-semibold">🧮 Учёба</h3>
            <div className="flex justify-between py-0.5"><span>Сегодня</span><span className="font-semibold">{r.study.today.sessions} сес. · {r.study.today.correct} ✅ из {r.study.today.answered} ({pct(r.study.today.correct, r.study.today.answered)}%)</span></div>
            <div className="flex justify-between py-0.5"><span>Неделя</span><span className="font-semibold">{r.study.week.sessions} сес. · {pct(r.study.week.correct, r.study.week.answered)}% верно</span></div>
            <div className="flex justify-between py-0.5"><span>Выучено</span><span className="font-semibold">{r.study.learned} из {r.study.total} · 🔥 {r.study.dayStreak} дн.</span></div>
            <div className="flex justify-between py-0.5"><span>«… × 6 = 36»</span><span className="font-semibold">{r.study.missingEnabled ? `вкл · выучено ${r.study.missingLearned} из 35 · начато ${r.study.missingSeen}` : "выключено"}</span></div>
            {r.study.hardest.length > 0 && <div className="mt-1 text-xs text-[var(--muted)]">Трудные: {r.study.hardest.slice(0, 4).map((x) => `${x.a}×${x.b}`).join(", ")}</div>}
          </section>
        </div>
      ) }))} />
      {rows.length === 0 && <p className="text-[var(--muted)]">Нет детских аккаунтов.</p>}
    </main>
  );
}
