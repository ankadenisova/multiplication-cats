import { NextResponse } from "next/server";
import { allPolicies, asBucket, deviceFromBearer, setUsage } from "@/lib/screen";

export const dynamic = "force-dynamic";

/** iOS monitor extension: POST {bucket: all|allowed|social, used} — minutes used since midnight (absolute). */
export async function POST(request: Request) {
  const device = await deviceFromBearer(request.headers.get("authorization"));
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const used = Number(body?.used ?? body?.minutes);
  if (!Number.isFinite(used) || used < 0) return NextResponse.json({ error: "used required" }, { status: 400 });
  const bucket = asBucket(body?.bucket ?? body?.group);
  if (!bucket) return NextResponse.json({ error: "bucket must be all | allowed | social" }, { status: 400 });
  await setUsage(device.user_id, bucket, used);
  const groups = await allPolicies(device.user_id);
  return NextResponse.json({ ...groups.default, groups, parentCode: process.env.PARENT_PIN || null });
}
