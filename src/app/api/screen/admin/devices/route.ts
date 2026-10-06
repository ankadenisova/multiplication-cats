import { NextResponse } from "next/server";
import { isParent } from "@/lib/parent-auth";
import { createDevice, deleteDevice, userIdByEmail } from "@/lib/screen";

/** POST {user: email, name} → {id, pairCode}. DELETE ?id=<device id>. */
export async function POST(request: Request) {
  if (!(await isParent(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const userId = await userIdByEmail(String(body?.user ?? ""));
  if (!userId) return NextResponse.json({ error: "user not found" }, { status: 404 });
  const name = String(body?.name || "iPhone").slice(0, 60);
  return NextResponse.json(await createDevice(userId, name));
}

export async function DELETE(request: Request) {
  if (!(await isParent(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteDevice(id);
  return NextResponse.json({ ok: true });
}
