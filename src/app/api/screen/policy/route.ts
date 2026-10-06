import { NextResponse } from "next/server";
import { allPolicies, deviceFromBearer, listKids } from "@/lib/screen";

export const dynamic = "force-dynamic";

/** iOS app: current lock state for the paired device's user. */
export async function GET(request: Request) {
  const device = await deviceFromBearer(request.headers.get("authorization"));
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const groups = await allPolicies(device.user_id);
  // Top-level fields = 'default' group (older app builds); `groups` carries every group.
  return NextResponse.json({ ...groups.default, groups, device: { id: device.id, name: device.name }, user: { id: device.user_id, name: (await listKids()).find((k) => k.id === device.user_id)?.name ?? "" }, parentCode: process.env.PARENT_PIN || null });
}
