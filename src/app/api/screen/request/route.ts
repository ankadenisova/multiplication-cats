import { NextResponse } from "next/server";
import { asGroup, deviceFromBearer, latestDecision, pendingRequests, requestMoreTime } from "@/lib/screen";

export const dynamic = "force-dynamic";

/** iOS app: POST {minutes} → asks the parent (Telegram). GET → pending request / latest decision. */
export async function POST(request: Request) {
  const device = await deviceFromBearer(request.headers.get("authorization"));
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const minutes = Math.min(120, Math.max(5, Math.round(Number(body?.minutes) || 15)));
  const r = await requestMoreTime(device.user_id, device.id, minutes, asGroup(body?.group));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 429 });
  return NextResponse.json({ ok: true, request: r.request });
}

export async function GET(request: Request) {
  const device = await deviceFromBearer(request.headers.get("authorization"));
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const pending = await pendingRequests(device.user_id);
  return NextResponse.json({ pending: pending[0] ?? null, latest: await latestDecision(device.user_id) });
}
