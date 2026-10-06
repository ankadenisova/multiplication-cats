import { NextResponse } from "next/server";
import { sql } from "@/db";
import { deviceFromBearer } from "@/lib/screen";

/** iOS app / extension: POST {source, lines: [string]} — debug trace, read with psql (device_log). */
export async function POST(request: Request) {
  const device = await deviceFromBearer(request.headers.get("authorization"));
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const lines: string[] = Array.isArray(body?.lines) ? body.lines.map(String).slice(0, 50) : [];
  const source = String(body?.source ?? "app").slice(0, 20);
  for (const line of lines) await sql`INSERT INTO device_log (device_id, source, line) VALUES (${device.id}, ${source}, ${line.slice(0, 500)})`;
  return NextResponse.json({ ok: true, stored: lines.length });
}
