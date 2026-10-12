import { NextResponse } from "next/server";
import { decideRequest } from "@/lib/screen";
import { answerCallback, replyTo } from "@/lib/telegram";
import { t } from "@/lib/i18n";

/** Telegram webhook: inline-button decisions on "ask for more time" messages. */
export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const update = await request.json().catch(() => null);
  const parentChat = String(process.env.TELEGRAM_PARENT_CHAT_ID);

  const cb = update?.callback_query;
  if (cb) {
    if (String(cb.from?.id) !== parentChat) { await answerCallback(cb.id, t.telegram.notForYou); return NextResponse.json({ ok: true }); }
    const m = /^req:(\d+):(\d+)$/.exec(String(cb.data ?? ""));
    if (m) {
      const result = await decideRequest(Number(m[1]), Number(m[2]), "Telegram");
      await answerCallback(cb.id, !result ? t.telegram.requestNotFound : Number(m[2]) > 0 ? t.telegram.granted(m[2]) : t.telegram.denied);
    } else {
      await answerCallback(cb.id);
    }
    return NextResponse.json({ ok: true });
  }

  const msg = update?.message;
  if (msg?.text && String(msg.chat?.id) === parentChat) {
    if (msg.text.startsWith("/start")) await replyTo(msg.chat.id, t.telegram.start);
  }
  return NextResponse.json({ ok: true });
}
