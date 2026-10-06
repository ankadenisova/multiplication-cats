import { NextResponse } from "next/server";
import { pairDevice } from "@/lib/screen";

/** iOS app: exchange a 6-digit pairing code for a device token. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const code = String(body?.code ?? "").trim();
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "bad code" }, { status: 400 });
  const result = await pairDevice(code, body?.appVersion);
  if (!result) return NextResponse.json({ error: "code not found or already used" }, { status: 404 });
  return NextResponse.json(result);
}
