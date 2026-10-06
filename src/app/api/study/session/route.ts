import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { getHome, startSession } from "@/lib/study";

export const dynamic = "force-dynamic";

/** Home screen data: today's sessions, streak, unfinished session to resume. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ ...(await getHome(user.id)), user: { name: user.name } });
}

/** Start (or resume today's unfinished) session. */
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await startSession(user.id));
}
