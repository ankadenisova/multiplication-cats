import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { getNextCard } from "@/lib/study";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const exclude = Number(new URL(request.url).searchParams.get("exclude")) || undefined;
  return NextResponse.json({ card: await getNextCard(user.id, exclude) });
}
