import { NextResponse } from "next/server";
import { deviceFromBearer, setApnsToken } from "@/lib/screen";

/** iOS app: register the APNs device token for silent pushes. */
export async function POST(request: Request) {
  const device = await deviceFromBearer(request.headers.get("authorization"));
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body?.token) return NextResponse.json({ error: "token required" }, { status: 400 });
  await setApnsToken(device.id, String(body.token), body.appVersion);
  return NextResponse.json({ ok: true });
}
