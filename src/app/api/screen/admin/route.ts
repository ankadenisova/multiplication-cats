import { NextResponse } from "next/server";
import { isParent } from "@/lib/parent-auth";
import { allPolicies, asGroup, decideRequest, grantMinutes, listDevices, listKids, pendingRequests, setLock, setRules, todayGrants, userIdByEmail } from "@/lib/screen";

export const dynamic = "force-dynamic";

async function resolveUser(email: string | null) {
  if (!email) return null;
  return userIdByEmail(email);
}

/**
 * Parent API. Auth: header `x-admin-key: <SCREEN_ADMIN_KEY>` (or a signed-in parent session).
 *   GET  /api/screen/admin?user=<email>         → status; without ?user → all users
 *   POST /api/screen/admin {user, group?: "default"|"social", action, minutes?, …}
 *        action: grant {minutes} — add to today's balance
 *                lock | unlock    — parent override (all groups)
 *                set {baseDailyMinutes, sessionRewards: [30,10,10]}
 *                decide {requestId, minutes}  — answer a kid's "more time" request (0 = deny)
 */
export async function GET(request: Request) {
  if (!(await isParent(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const email = new URL(request.url).searchParams.get("user");
  const kids = email ? (await listKids()).filter((k) => k.email.toLowerCase() === email.toLowerCase()) : await listKids();
  const result = [];
  for (const k of kids) {
    const groups = await allPolicies(k.id);
    result.push({ user: k, policy: groups.default, groups, devices: await listDevices(k.id), grantsToday: await todayGrants(k.id), pendingRequests: await pendingRequests(k.id) });
  }
  return NextResponse.json(email ? result[0] ?? { error: "user not found" } : result, { status: email && !result[0] ? 404 : 200 });
}

export async function POST(request: Request) {
  if (!(await isParent(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (body?.action === "decide") {
    const r = await decideRequest(Number(body.requestId), Number(body.minutes ?? 0), "админка");
    return r ? NextResponse.json(r) : NextResponse.json({ error: "request not found" }, { status: 404 });
  }
  const userId = await resolveUser(body?.user ?? null);
  if (!userId) return NextResponse.json({ error: "user not found (pass email as `user`)" }, { status: 404 });
  const group = asGroup(body.group);
  switch (body.action) {
    case "grant": {
      const minutes = Number(body.minutes ?? 30);
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 24 * 60) return NextResponse.json({ error: "minutes must be 1..1440" }, { status: 400 });
      return NextResponse.json(await grantMinutes(userId, Math.round(minutes), "parent", undefined, group));
    }
    case "lock": return NextResponse.json(await setLock(userId, true));
    case "unlock": return NextResponse.json(await setLock(userId, false));
    case "set": return NextResponse.json(await setRules(userId, {
      baseDailyMinutes: body.baseDailyMinutes !== undefined ? Number(body.baseDailyMinutes) : undefined,
      sessionRewards: Array.isArray(body.sessionRewards) ? body.sessionRewards.map(Number) : undefined,
    }, group));
    default: return NextResponse.json({ error: "action must be grant | lock | unlock | set | decide" }, { status: 400 });
  }
}
