import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { parentEmails } from "@/lib/parent-auth";
import { GROUP_KEYS, allPolicies, getScreenStats, listDevices, listKids, pendingRequests, todayBuckets, todayGrants } from "@/lib/screen";
import { getProgress } from "@/lib/study";
import { apnsConfigured } from "@/lib/apns";
import ParentControls from "./ParentControls";
import KidTabs from "./KidTabs";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const h = t.admin.duration;

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
        <Link href="/" className="rounded-full bg-white px-3 py-1.5 text-sm shadow-sm">{t.nav.back}</Link>
        <h1 className="text-lg font-bold">{t.admin.title}</h1>
      </header>
      {!apnsConfigured() && <p className="mb-3 rounded-2xl bg-amber-50 p-3 text-xs text-amber-800">{t.admin.noPush}</p>}

      <KidTabs tabs={rows.map((r) => ({ id: r.user.id, label: r.user.name, content: (
        <div className="space-y-3">
          <ParentControls data={{ user: r.user, groups: r.groups, devices: r.devices, grants: r.grants, requests: r.requests }} />

          {GROUP_KEYS.map((g) => { const s = r.stats[g]; const p = r.groups[g]; const maxDay = Math.max(30, ...s.days.map((d) => d.minutes)); return (
            <section key={g} className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold">📱 {p.groupName}{g === "social" ? t.admin.socialApps : ""}</h3>
              <div className="grid grid-cols-2 gap-2 text-center text-sm">
                <div className="rounded-xl bg-[var(--bg)] p-2"><div className="text-xl font-bold">{h(s.todayUsedMin)}</div><div className="text-xs text-[var(--muted)]">{t.admin.usedToday}</div></div>
                <div className="rounded-xl bg-[var(--bg)] p-2"><div className="text-xl font-bold">{h(s.balanceMin)}</div><div className="text-xs text-[var(--muted)]">{t.admin.leftToday}</div></div>
                <div className="rounded-xl bg-[var(--bg)] p-2"><div className="text-xl font-bold">{s.earnedTodayMin}{p.baseDailyMinutes ? ` + ${p.baseDailyMinutes}` : ""}</div><div className="text-xs text-[var(--muted)]">{t.admin.grantedToday}{p.baseDailyMinutes ? t.admin.plusBase : ""}{p.sessionRewards.length ? t.admin.nextSession(p.nextSessionReward) : ""}</div></div>
                <div className="rounded-xl bg-[var(--bg)] p-2"><div className="text-xl font-bold">{h(s.weekMin)}</div><div className="text-xs text-[var(--muted)]">{t.admin.thisWeek}</div></div>
                <div className="rounded-xl bg-[var(--bg)] p-2"><div className="text-xl font-bold">{h(s.monthMin)}</div><div className="text-xs text-[var(--muted)]">{t.admin.thisMonth}</div></div>
              </div>
              <div className="mt-3 flex h-16 items-end gap-1">
                {s.days.map((d) => (
                  <div key={d.day} className="flex-1 rounded-t bg-[var(--accent)]" style={{ height: `${Math.max(2, (d.minutes / maxDay) * 100)}%`, opacity: d.minutes ? 1 : 0.15 }} title={t.admin.dayMinutes(d.day, d.minutes)} />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-[var(--muted)]"><span>{t.progress.twoWeeksAgo}</span><span>{t.progress.todayShort}</span></div>
            </section>
          ); })}
          <p className="text-xs text-[var(--muted)]">{t.admin.usageNote(h(r.buckets.all), h(r.buckets.allowed))}</p>

          <section className="rounded-2xl bg-white p-4 shadow-sm text-sm">
            <h3 className="mb-2 text-sm font-semibold">{t.admin.study}</h3>
            <div className="flex justify-between py-0.5"><span>{t.admin.today}</span><span className="font-semibold">{t.admin.todayStats(r.study.today.sessions, r.study.today.correct, r.study.today.answered, pct(r.study.today.correct, r.study.today.answered))}</span></div>
            <div className="flex justify-between py-0.5"><span>{t.admin.week}</span><span className="font-semibold">{t.admin.weekStats(r.study.week.sessions, pct(r.study.week.correct, r.study.week.answered))}</span></div>
            <div className="flex justify-between py-0.5"><span>{t.admin.learned}</span><span className="font-semibold">{t.admin.learnedLine(r.study.learned, r.study.total, r.study.dayStreak)}</span></div>
            <div className="flex justify-between py-0.5"><span>{t.admin.missingLabel}</span><span className="font-semibold">{r.study.missingEnabled ? t.admin.missingOn(r.study.missingLearned, r.study.missingSeen) : t.admin.missingOff}</span></div>
            {r.study.hardest.length > 0 && <div className="mt-1 text-xs text-[var(--muted)]">{t.admin.hardest(r.study.hardest.slice(0, 4).map((x) => `${x.a}×${x.b}`).join(", "))}</div>}
          </section>
        </div>
      ) }))} />
      {rows.length === 0 && <p className="text-[var(--muted)]">{t.admin.noKids}</p>}
    </main>
  );
}
