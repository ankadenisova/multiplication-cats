import { createHash, randomBytes, randomInt } from "node:crypto";
import { sql, APP_TZ } from "@/db";
import { apnsConfigured, sendSilentPush } from "@/lib/apns";
import { editParentMessage, sendToParent, telegramConfigured } from "@/lib/telegram";

/** App groups with independent budgets. Shield selections live on the phone; budgets live here. */
export type GroupKey = "default" | "social";
export const GROUPS: Record<GroupKey, { name: string; base: number; rewards: number[] }> = {
  default: { name: "Все приложения", base: 0, rewards: [15, 15, 15, 15, 15] },
  social: { name: "Мессенджеры", base: 40, rewards: [] },
};
export const GROUP_KEYS = Object.keys(GROUPS) as GroupKey[];
export function asGroup(v: unknown): GroupKey { return v === "social" ? "social" : "default"; }

/** Usage counters reported by the phone. 'default' group usage = all − allowed − social. */
export type Bucket = "all" | "allowed" | "social";
export function asBucket(v: unknown): Bucket | null { return v === "all" || v === "allowed" || v === "social" ? v : null; }


export type Policy = {
  group: GroupKey;
  groupName: string;
  serverTime: string;
  unlocked: boolean;
  unlockedUntil: string | null;
  lockedOverride: boolean;
  baseDailyMinutes: number;
  sessionRewards: number[];     // minutes credited for the 1st, 2nd, 3rd… finished session of the day
  sessionsRewardedToday: number;
  nextSessionReward: number;    // what the next finished session will bring (0 = nothing more today)
  minutesPerSession: number;    // legacy fields kept for older app builds
  dailyCapMinutes: number;
  earnedTodayMinutes: number;   // credits today (sessions + parent)
  usedTodayMinutes: number;     // elapsed window minutes today
  budgetTodayMinutes: number;   // base + earned: the phone shields the group when local usage reaches this
  balanceMinutes: number;       // budget - used (as reported by the phone)
};

type PolicyRow = { user_id: string; base_daily_minutes: number; session_rewards: number[]; minutes_per_session: number; daily_cap_minutes: number; unlocked_until: string | null; locked_override: boolean };

const DAY = 86_400_000;

function localDay(d: Date | number): string {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: APP_TZ });
}

async function ensurePolicy(userId: string, group: GroupKey): Promise<PolicyRow> {
  const g = GROUPS[group];
  const [row] = await sql`
    INSERT INTO screen_policies (user_id, group_key, base_daily_minutes, session_rewards) VALUES (${userId}, ${group}, ${g.base}, ${g.rewards})
    ON CONFLICT (user_id, group_key) DO UPDATE SET user_id = EXCLUDED.user_id
    RETURNING user_id, base_daily_minutes, session_rewards, minutes_per_session, daily_cap_minutes, unlocked_until, locked_override`;
  return row as PolicyRow;
}

async function sessionCreditsCountToday(userId: string, group: GroupKey): Promise<number> {
  const [r] = (await sql`SELECT count(*)::int AS n FROM screen_grants WHERE user_id = ${userId} AND group_key = ${group} AND source = 'session'
    AND (created_at AT TIME ZONE ${APP_TZ})::date = (now() AT TIME ZONE ${APP_TZ})::date`) as { n: number }[];
  return r?.n ?? 0;
}

async function creditsToday(userId: string, group: GroupKey): Promise<number> {
  const rows = (await sql`SELECT coalesce(sum(minutes), 0)::int AS m FROM screen_grants WHERE user_id = ${userId} AND group_key = ${group}
                AND (created_at AT TIME ZONE ${APP_TZ})::date = (now() AT TIME ZONE ${APP_TZ})::date`) as { m: number }[];
  return rows[0]?.m ?? 0;
}

/** Minutes actually used per local day for a group, derived from the phone's bucket counters. */
async function usagePerDay(userId: string, group: GroupKey): Promise<Map<string, number>> {
  const rows = (await sql`SELECT day::text AS day, group_key AS bucket, used_minutes AS m FROM screen_usage
    WHERE user_id = ${userId} AND day >= (now() AT TIME ZONE ${APP_TZ})::date - 40`) as { day: string; bucket: Bucket; m: number }[];
  const byDay = new Map<string, Record<Bucket, number>>();
  for (const r of rows) {
    const d = byDay.get(r.day) ?? { all: 0, allowed: 0, social: 0 };
    d[r.bucket] = (d[r.bucket] ?? 0) + r.m;
    byDay.set(r.day, d);
  }
  const out = new Map<string, number>();
  for (const [day, d] of byDay) out.set(day, group === "social" ? d.social : Math.max(0, d.all - d.allowed - d.social));
  return out;
}

/** Raw bucket counters for today (for the admin page). */
export async function todayBuckets(userId: string): Promise<Record<Bucket, number>> {
  const rows = (await sql`SELECT group_key AS bucket, used_minutes AS m FROM screen_usage WHERE user_id = ${userId} AND day = (now() AT TIME ZONE ${APP_TZ})::date`) as { bucket: Bucket; m: number }[];
  const out: Record<Bucket, number> = { all: 0, allowed: 0, social: 0 };
  for (const r of rows) out[r.bucket] = r.m;
  return out;
}

/** Phone reports usage since midnight for a bucket (absolute minutes; thresholds fire in order, so keep the max). */
export async function setUsage(userId: string, bucket: Bucket, usedMinutes: number): Promise<void> {
  const m = Math.max(0, Math.min(24 * 60, Math.round(usedMinutes)));
  await sql`INSERT INTO screen_usage (user_id, group_key, day, used_minutes) VALUES (${userId}, ${bucket}, (now() AT TIME ZONE ${APP_TZ})::date, ${m})
    ON CONFLICT (user_id, group_key, day) DO UPDATE SET used_minutes = GREATEST(screen_usage.used_minutes, EXCLUDED.used_minutes), updated_at = now()`;
}

export async function getPolicy(userId: string, group: GroupKey = "default"): Promise<Policy> {
  const p = await ensurePolicy(userId, group);
  const now = new Date();
  const earned = await creditsToday(userId, group);
  const usage = await usagePerDay(userId, group);
  const used = Math.round(usage.get(localDay(now)) ?? 0);
  const balance = Math.max(0, p.base_daily_minutes + earned - used);
  const rewarded = await sessionCreditsCountToday(userId, group);
  const rewards = p.session_rewards ?? [];
  return {
    group, groupName: GROUPS[group].name,
    sessionRewards: rewards,
    sessionsRewardedToday: rewarded,
    nextSessionReward: rewards[rewarded] ?? 0,
    serverTime: now.toISOString(),
    unlocked: !p.locked_override && balance > 0,   // apps usable while the daily balance lasts
    unlockedUntil: null,
    lockedOverride: p.locked_override,
    baseDailyMinutes: p.base_daily_minutes,
    minutesPerSession: p.minutes_per_session,
    dailyCapMinutes: p.daily_cap_minutes,
    earnedTodayMinutes: earned,
    usedTodayMinutes: used,
    budgetTodayMinutes: p.base_daily_minutes + earned,
    balanceMinutes: balance,
  };
}

/** Adds minutes to today's balance; the phone lifts the shield on its next policy refresh (push or app open). */
export async function grantMinutes(userId: string, minutes: number, source: "session" | "parent", sessionId?: number, group: GroupKey = "default"): Promise<Policy> {
  await ensurePolicy(userId, group);
  await sql`INSERT INTO screen_grants (user_id, group_key, minutes, source, session_id) VALUES (${userId}, ${group}, ${minutes}, ${source}, ${sessionId ?? null})`;
  await notifyDevices(userId);
  return getPolicy(userId, group);
}

/** Called when a study session finishes: 1st session of the day → rewards[0], 2nd → rewards[1], … then nothing. */
export async function grantSessionReward(userId: string, sessionId: number): Promise<{ minutes: number; policy: Policy | null }> {
  // REWARD_WITHOUT_DEVICE=1: minutes accrue even with no paired phone (the parent grants screen time by hand).
  if (process.env.REWARD_WITHOUT_DEVICE !== "1") {
    const [dev] = await sql`SELECT 1 FROM devices WHERE user_id = ${userId} AND paired_at IS NOT NULL LIMIT 1`;
    if (!dev) return { minutes: 0, policy: null };
  }
  const p = await ensurePolicy(userId, "default");
  const n = await sessionCreditsCountToday(userId, "default");
  const minutes = (p.session_rewards ?? [])[n] ?? 0;
  if (minutes < 1) return { minutes: 0, policy: await getPolicy(userId, "default") };
  return { minutes, policy: await grantMinutes(userId, minutes, "session", sessionId, "default") };
}

/** Parent lock applies to every group. */
export async function setLock(userId: string, locked: boolean): Promise<Policy> {
  for (const g of GROUP_KEYS) await ensurePolicy(userId, g);
  if (locked) {
    await sql`UPDATE screen_policies SET locked_override = true, unlocked_until = NULL, updated_at = now() WHERE user_id = ${userId}`;
  } else {
    await sql`UPDATE screen_policies SET locked_override = false, updated_at = now() WHERE user_id = ${userId}`;
  }
  await notifyDevices(userId);
  return getPolicy(userId, "default");
}

export async function setRules(userId: string, rules: { baseDailyMinutes?: number; sessionRewards?: number[] }, group: GroupKey = "default"): Promise<Policy> {
  const p = await ensurePolicy(userId, group);
  const base = rules.baseDailyMinutes ?? p.base_daily_minutes;
  const rewards = (rules.sessionRewards ?? p.session_rewards ?? []).map((n) => Math.max(0, Math.round(n))).filter((n) => Number.isFinite(n));
  await sql`UPDATE screen_policies SET base_daily_minutes = ${base}, session_rewards = ${rewards}, minutes_per_session = ${rewards[0] ?? 0}, daily_cap_minutes = ${rewards.reduce((a, b) => a + b, 0)}, updated_at = now() WHERE user_id = ${userId} AND group_key = ${group}`;
  await notifyDevices(userId);
  return getPolicy(userId, group);
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export type DeviceRow = { id: string; user_id: string; name: string; pair_code: string | null; paired_at: string | null; apns_token: string | null; app_version: string | null; last_seen_at: string | null };

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createDevice(userId: string, name: string): Promise<{ id: string; pairCode: string }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = String(randomInt(100000, 999999));
    try {
      const [d] = await sql`INSERT INTO devices (user_id, name, pair_code) VALUES (${userId}, ${name}, ${code}) RETURNING id`;
      return { id: d.id, pairCode: code };
    } catch { /* code collision, retry */ }
  }
  throw new Error("could not allocate pair code");
}

export async function pairDevice(code: string, appVersion?: string): Promise<{ token: string; device: { id: string; name: string }; user: { id: string; name: string } } | null> {
  const [d] = await sql`SELECT id, user_id, name FROM devices WHERE pair_code = ${code} AND paired_at IS NULL`;
  if (!d) return null;
  const token = randomBytes(32).toString("hex");
  await sql`UPDATE devices SET token_hash = ${hash(token)}, paired_at = now(), pair_code = NULL, app_version = ${appVersion ?? null}, last_seen_at = now() WHERE id = ${d.id}`;
  const [u] = await sql`SELECT name FROM neon_auth."user" WHERE id::text = ${d.user_id}`;
  return { token, device: { id: d.id, name: d.name }, user: { id: d.user_id, name: u?.name ?? "" } };
}

export async function deviceFromBearer(header: string | null): Promise<DeviceRow | null> {
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return null;
  const [d] = await sql`SELECT id, user_id, name, pair_code, paired_at, apns_token, app_version, last_seen_at FROM devices WHERE token_hash = ${hash(token)}`;
  if (!d) return null;
  await sql`UPDATE devices SET last_seen_at = now() WHERE id = ${d.id}`;
  return d as DeviceRow;
}

export async function setApnsToken(deviceId: string, apnsToken: string, appVersion?: string) {
  await sql`UPDATE devices SET apns_token = ${apnsToken}, app_version = coalesce(${appVersion ?? null}, app_version) WHERE id = ${deviceId}`;
}

export async function listDevices(userId: string): Promise<DeviceRow[]> {
  return (await sql`SELECT id, user_id, name, pair_code, paired_at, apns_token, app_version, last_seen_at FROM devices WHERE user_id = ${userId} ORDER BY created_at`) as DeviceRow[];
}

export async function deleteDevice(id: string) {
  await sql`DELETE FROM devices WHERE id = ${id}`;
}

async function notifyDevices(userId: string) {
  if (!apnsConfigured()) return;
  const rows = (await sql`SELECT apns_token FROM devices WHERE user_id = ${userId} AND apns_token IS NOT NULL`) as { apns_token: string }[];
  await Promise.all(rows.map((r) => sendSilentPush(r.apns_token, { reason: "policy" }).catch((e) => console.error("apns:", e))));
}

// ---------------------------------------------------------------------------
// Admin helpers & statistics
// ---------------------------------------------------------------------------

export async function userIdByEmail(email: string): Promise<string | null> {
  const [u] = await sql`SELECT id::text AS id FROM neon_auth."user" WHERE lower(email) = lower(${email})`;
  return u?.id ?? null;
}

export async function listKids(): Promise<{ id: string; name: string; email: string }[]> {
  return (await sql`SELECT id::text AS id, name, email FROM neon_auth."user" ORDER BY "createdAt"`) as { id: string; name: string; email: string }[];
}

export async function allPolicies(userId: string): Promise<Record<GroupKey, Policy>> {
  const out = {} as Record<GroupKey, Policy>;
  for (const g of GROUP_KEYS) out[g] = await getPolicy(userId, g);
  return out;
}

export async function todayGrants(userId: string) {
  return (await sql`SELECT minutes, source, group_key AS "group", to_char(created_at AT TIME ZONE ${APP_TZ}, 'HH24:MI') AS at FROM screen_grants WHERE user_id = ${userId}
    AND (created_at AT TIME ZONE ${APP_TZ})::date = (now() AT TIME ZONE ${APP_TZ})::date ORDER BY created_at DESC`) as { minutes: number; source: string; group: GroupKey; at: string }[];
}

export type ScreenStats = {
  todayUsedMin: number;
  balanceMin: number;        // still available today
  earnedTodayMin: number;
  weekMin: number;           // Mon..today
  monthMin: number;          // 1st..today
  days: { day: string; minutes: number }[]; // last 14 days
};

export async function getScreenStats(userId: string, policy: Policy): Promise<ScreenStats> {
  const perDay = await usagePerDay(userId, policy.group);
  const now = Date.now();
  const today = localDay(now);
  const monday = (() => { const d = new Date(new Date().toLocaleString("en-US", { timeZone: APP_TZ })); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toLocaleDateString("en-CA"); })();
  const monthStart = today.slice(0, 8) + "01";
  const sum = (from: string) => Array.from(perDay.entries()).filter(([d]) => d >= from && d <= today).reduce((a, [, m]) => a + m, 0);
  const days: ScreenStats["days"] = [];
  for (let i = 13; i >= 0; i--) { const d = localDay(now - i * DAY); days.push({ day: d, minutes: perDay.get(d) ?? 0 }); }
  return {
    todayUsedMin: policy.usedTodayMinutes, balanceMin: policy.balanceMinutes, earnedTodayMin: policy.earnedTodayMinutes,
    weekMin: sum(monday), monthMin: sum(monthStart), days,
  };
}

// ---------------------------------------------------------------------------
// Finished session → Telegram to the parent
// ---------------------------------------------------------------------------

/** Tells the parent that a session is over: score, minutes earned for it and in total today. */
export async function notifySessionFinished(userId: string, s: { correct: number; size: number; failReason: "dontknow" | "fewcorrect" | null; rewardMinutes: number }) {
  if (!telegramConfigured()) return;
  const [u] = await sql`SELECT name FROM neon_auth."user" WHERE id::text = ${userId}`;
  const name = u?.name ?? "Ребёнок";
  const p = await getPolicy(userId, "default");
  const head = s.failReason
    ? `⚠️ <b>${name}</b> закончила сессию, но она не засчитана (${s.failReason === "dontknow" ? "слишком много «не помню»" : "мало правильных ответов"}): ${s.correct} из ${s.size}.`
    : `✅ <b>${name}</b> решила сессию: ${s.correct} из ${s.size} верно.${s.rewardMinutes > 0 ? ` +${s.rewardMinutes} мин.` : " Минут за неё уже не положено: дневной лимит наград исчерпан."}`;
  await sendToParent(`${head}\nСегодня засчитано сессий: ${p.sessionsRewardedToday}, заработано ${p.earnedTodayMinutes} мин.`);
}

// ---------------------------------------------------------------------------
// "Ask for more time" → Telegram to the parent
// ---------------------------------------------------------------------------

export type ScreenRequest = { id: number; user_id: string; group_key: GroupKey; minutes: number; status: string; granted_min: number | null; tg_message: number | null; created_at: string };

export async function requestMoreTime(userId: string, deviceId: string | null, minutes: number, group: GroupKey = "default"): Promise<{ ok: true; request: ScreenRequest } | { ok: false; error: string }> {
  const [pending] = (await sql`SELECT id, created_at FROM screen_requests WHERE user_id = ${userId} AND group_key = ${group} AND status = 'pending' AND created_at > now() - interval '15 minutes' ORDER BY created_at DESC LIMIT 1`) as { id: number }[];
  if (pending) return { ok: false, error: "Запрос уже отправлен, подожди ответа" };
  const [u] = await sql`SELECT name FROM neon_auth."user" WHERE id::text = ${userId}`;
  const name = u?.name ?? "Ребёнок";
  const p = await getPolicy(userId, group);
  const [req] = (await sql`INSERT INTO screen_requests (user_id, group_key, device_id, minutes) VALUES (${userId}, ${group}, ${deviceId}, ${minutes}) RETURNING id, user_id, group_key, minutes, status, granted_min, tg_message, created_at`) as ScreenRequest[];
  if (telegramConfigured()) {
    const what = group === "social" ? "на мессенджеры (Telegram, WhatsApp)" : "экранного времени";
    const text = `📱 <b>${name}</b> просит ещё <b>${minutes} мин</b> ${what}.\nСегодня в этой группе: использовано ${p.usedTodayMinutes} мин, осталось ${p.balanceMinutes} мин${group === "default" ? `, сессий сделано ${p.sessionsRewardedToday}` : ""}.`;
    const msgId = await sendToParent(text, [[
      { text: `✅ +${minutes}`, callback_data: `req:${req.id}:${minutes}` },
      { text: "✅ +30", callback_data: `req:${req.id}:30` },
      { text: "❌ Нет", callback_data: `req:${req.id}:0` },
    ]]);
    if (msgId) await sql`UPDATE screen_requests SET tg_message = ${msgId} WHERE id = ${req.id}`;
  }
  return { ok: true, request: req };
}

/** Parent decision (from the Telegram button or the admin page). minutes = 0 → denied. */
export async function decideRequest(requestId: number, minutes: number, via: string): Promise<{ request: ScreenRequest; name: string } | null> {
  const [req] = (await sql`SELECT id, user_id, group_key, minutes, status, granted_min, tg_message, created_at FROM screen_requests WHERE id = ${requestId}`) as ScreenRequest[];
  if (!req) return null;
  const [u] = await sql`SELECT name FROM neon_auth."user" WHERE id::text = ${req.user_id}`;
  const name = u?.name ?? "";
  if (req.status !== "pending") return { request: req, name };
  const granted = Math.max(0, Math.round(minutes));
  await sql`UPDATE screen_requests SET status = ${granted > 0 ? "granted" : "denied"}, granted_min = ${granted}, decided_at = now() WHERE id = ${requestId}`;
  let p: Policy | null = null;
  if (granted > 0) p = await grantMinutes(req.user_id, granted, "parent", undefined, req.group_key); else await notifyDevices(req.user_id);
  if (req.tg_message) {
    await editParentMessage(req.tg_message, granted > 0
      ? `✅ ${name}: выдано <b>+${granted} мин</b> ${req.group_key === "social" ? "на мессенджеры " : ""}(${via}). Осталось на сегодня: ${p?.balanceMinutes ?? "?"} мин.`
      : `❌ ${name}: запрос на ${req.minutes} мин отклонён (${via}).`);
  }
  const [fresh] = (await sql`SELECT id, user_id, group_key, minutes, status, granted_min, tg_message, created_at FROM screen_requests WHERE id = ${requestId}`) as ScreenRequest[];
  return { request: fresh, name };
}

export async function pendingRequests(userId: string): Promise<ScreenRequest[]> {
  return (await sql`SELECT id, user_id, group_key, minutes, status, granted_min, tg_message, created_at FROM screen_requests WHERE user_id = ${userId} AND status = 'pending' ORDER BY created_at DESC`) as ScreenRequest[];
}

/** Latest decided request within the last hour — so the phone can show "папа выдал 30 минут". */
export async function latestDecision(userId: string): Promise<ScreenRequest | null> {
  const [r] = (await sql`SELECT id, user_id, group_key, minutes, status, granted_min, tg_message, created_at FROM screen_requests WHERE user_id = ${userId} AND status <> 'pending' AND decided_at > now() - interval '1 hour' ORDER BY decided_at DESC LIMIT 1`) as ScreenRequest[];
  return r ?? null;
}
