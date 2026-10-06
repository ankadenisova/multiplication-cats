import { NextResponse } from "next/server";
import { allPolicies, asGroup, deviceFromBearer, grantMinutes } from "@/lib/screen";

export const dynamic = "force-dynamic";

/** iOS parent mode: POST {pin, group, minutes} — adds minutes to today's balance of the paired kid. */
export async function POST(request: Request) {
  const device = await deviceFromBearer(request.headers.get("authorization"));
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!process.env.PARENT_PIN || String(body?.pin ?? "") !== process.env.PARENT_PIN) {
    return NextResponse.json({ error: "wrong parent code" }, { status: 403 });
  }
  const minutes = Math.round(Number(body?.minutes));
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240) return NextResponse.json({ error: "minutes must be 1..240" }, { status: 400 });
  await grantMinutes(device.user_id, minutes, "parent", undefined, asGroup(body?.group));
  const groups = await allPolicies(device.user_id);
  return NextResponse.json({ ...groups.default, groups, parentCode: process.env.PARENT_PIN || null });
}
