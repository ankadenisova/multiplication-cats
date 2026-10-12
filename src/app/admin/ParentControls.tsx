"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Policy, DeviceRow, ScreenRequest, GroupKey } from "@/lib/screen";
import { t } from "@/lib/i18n";

type Data = {
  user: { id: string; name: string; email: string };
  groups: Record<GroupKey, Policy>;
  devices: DeviceRow[];
  grants: { minutes: number; source: string; group: GroupKey; at: string }[];
  requests: ScreenRequest[];
};


export default function ParentControls({ data }: { data: Data }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const p = data.groups.default;
  const anyLocked = p.lockedOverride;

  const call = async (body: Record<string, unknown>) => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/screen/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user: data.user.email, ...body }) });
      if (!res.ok) setErr((await res.json()).error ?? t.parent.error);
      router.refresh();
    } finally { setBusy(false); }
  };

  const addDevice = async () => {
    setBusy(true); setErr(null);
    try {
      const name = prompt(t.parent.phoneNamePrompt, t.parent.defaultPhone(data.user.name)) || "iPhone";
      const res = await fetch("/api/screen/admin/devices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user: data.user.email, name }) });
      const j = await res.json();
      if (!res.ok) setErr(j.error); else setPairCode(j.pairCode);
      router.refresh();
    } finally { setBusy(false); }
  };

  const removeDevice = async (id: string) => {
    if (!confirm(t.parent.unpairConfirm)) return;
    await fetch(`/api/screen/admin/devices?id=${id}`, { method: "DELETE" });
    router.refresh();
  };

  const stateOf = (g: Policy) => g.lockedOverride ? t.parent.locked : g.balanceMinutes > 0 ? t.parent.available(g.balanceMinutes) : t.parent.limitReached;
  const groupKeys = Object.keys(data.groups) as GroupKey[];

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">{data.user.name}</h2>
        {anyLocked && <span className="text-sm">{t.parent.forced}</span>}
      </div>

      {data.requests.length > 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">
          {data.requests.map((q) => (
            <div key={q.id} className="flex items-center justify-between gap-2">
              <span>{t.parent.asksMore(q.minutes, q.group_key === "social", new Date(q.created_at).toLocaleTimeString(t.dateLocale, { hour: "2-digit", minute: "2-digit" }))}</span>
              <span className="flex gap-1">
                <button disabled={busy} className="rounded-lg bg-[var(--ok-soft)] px-2 py-1" onClick={() => call({ action: "decide", requestId: q.id, minutes: q.minutes })}>+{q.minutes}</button>
                <button disabled={busy} className="rounded-lg bg-[var(--ok-soft)] px-2 py-1" onClick={() => call({ action: "decide", requestId: q.id, minutes: 30 })}>+30</button>
                <button disabled={busy} className="rounded-lg bg-[var(--bad-soft)] px-2 py-1" onClick={() => call({ action: "decide", requestId: q.id, minutes: 0 })}>{t.parent.deny}</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {groupKeys.map((g) => { const gp = data.groups[g]; return (
        <div key={g} className="mt-3 rounded-xl border border-gray-100 p-3 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">{gp.groupName}</span>
            <span>{stateOf(gp)}</span>
          </div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            {t.parent.rulesLine(gp.baseDailyMinutes, gp.sessionRewards, gp.sessionsRewardedToday, gp.nextSessionReward, gp.earnedTodayMinutes, gp.usedTodayMinutes, gp.balanceMinutes)}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <button disabled={busy} className="rounded-xl bg-[var(--ok-soft)] py-2 font-semibold" onClick={() => call({ group: g, action: "grant", minutes: 15 })}>{t.parent.grant(15)}</button>
            <button disabled={busy} className="rounded-xl bg-[var(--ok-soft)] py-2 font-semibold" onClick={() => call({ group: g, action: "grant", minutes: 30 })}>{t.parent.grant(30)}</button>
            <button disabled={busy} className="rounded-xl bg-[var(--ok-soft)] py-2 font-semibold" onClick={() => call({ group: g, action: "grant", minutes: 60 })}>{t.parent.grant(60)}</button>
          </div>
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-[var(--muted)]">{t.parent.rules}</summary>
            <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); call({ group: g, action: "set", baseDailyMinutes: Number(f.get("base")), sessionRewards: String(f.get("rewards")).split(/[,\s]+/).filter(Boolean).map(Number) }); }}>
              <label>{t.parent.baseLabel}<br /><input name="base" type="number" min={0} max={1440} defaultValue={gp.baseDailyMinutes} className="w-24 rounded-lg border border-gray-200 px-2 py-1" /></label>
              <label>{t.parent.rewardsLabel}<br /><input name="rewards" defaultValue={gp.sessionRewards.join(", ")} className="w-28 rounded-lg border border-gray-200 px-2 py-1" /></label>
              <button disabled={busy} className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-white">{t.parent.save}</button>
            </form>
          </details>
        </div>
      ); })}

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {anyLocked
          ? <button disabled={busy} className="col-span-2 rounded-xl bg-[var(--accent-soft)] py-2 font-semibold" onClick={() => call({ action: "unlock" })}>{t.parent.unlockAll}</button>
          : <button disabled={busy} className="col-span-2 rounded-xl bg-[var(--bad-soft)] py-2 font-semibold" onClick={() => call({ action: "lock" })}>{t.parent.lockAll}</button>}
      </div>

      <div className="mt-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-[var(--muted)]">{t.parent.phones}</span>
          <button disabled={busy} className="text-[var(--accent)] underline" onClick={addDevice}>{t.parent.pair}</button>
        </div>
        {pairCode && <div className="mt-2 rounded-xl bg-[var(--accent-soft)] p-3 text-center">{t.parent.pairCode}<b className="text-2xl tracking-widest">{pairCode}</b><div className="text-xs text-[var(--muted)]">{t.parent.pairCodeNote}</div></div>}
        <ul className="mt-1">
          {data.devices.map((d) => (
            <li key={d.id} className="flex items-center justify-between border-b border-gray-100 py-1 last:border-0">
              <span>{d.name} {d.paired_at ? (d.apns_token ? "📡" : "") : <span className="text-xs text-[var(--muted)]">{t.parent.notPaired(d.pair_code ?? "")}</span>}
                {d.last_seen_at && <span className="text-xs text-[var(--muted)]">{t.parent.lastSeen(new Date(d.last_seen_at).toLocaleString(t.dateLocale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }))}</span>}</span>
              <button className="text-xs text-[var(--bad)]" onClick={() => removeDevice(d.id)}>{t.parent.remove}</button>
            </li>
          ))}
        </ul>
      </div>

      {data.grants.length > 0 && (
        <div className="mt-3 text-xs text-[var(--muted)]">{t.parent.grantedToday(data.grants.map((g) => `${g.at} +${g.minutes}${g.group === "social" ? t.parent.socialShort : ""} (${g.source === "session" ? t.parent.sourceSession : t.parent.sourceParent})`).join(" · "))}</div>
      )}
      {err && <div className="mt-2 text-sm text-[var(--bad)]">{err}</div>}
    </section>
  );
}
