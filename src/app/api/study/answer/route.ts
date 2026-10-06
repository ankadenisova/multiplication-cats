import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { recordAnswer } from "@/lib/study";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.cardId !== "number" || typeof body.sessionId !== "number") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const answer = body.answer === null || body.answer === undefined || body.answer === "" ? null : Number(body.answer);
  try {
    const result = await recordAnswer(user.id, {
      sessionId: body.sessionId, cardId: body.cardId,
      shownA: Number(body.shownA), shownB: Number(body.shownB),
      answer: Number.isFinite(answer as number) ? answer : null,
      dontKnow: Boolean(body.dontKnow),
      blank: body.blank === "a" || body.blank === "b" ? body.blank : null,
      responseMs: Number.isFinite(body.responseMs) ? Math.min(Math.round(body.responseMs), 600_000) : null,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "duplicate answer") return NextResponse.json({ error: msg }, { status: 429 });
    return NextResponse.json({ error: msg }, { status: msg.includes("session") ? 409 : 500 });
  }
}
