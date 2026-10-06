/** Minimal Telegram Bot API client for parent notifications. No-op when TELEGRAM_BOT_TOKEN is missing. */

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_PARENT_CHAT_ID);
}

async function call<T = unknown>(method: string, body: Record<string, unknown>): Promise<T | null> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return null;
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as { ok: boolean; result: T; description?: string } | null;
  if (!json?.ok) { console.error("telegram", method, json?.description); return null; }
  return json.result;
}

export type InlineButton = { text: string; callback_data: string };

export async function sendToParent(text: string, buttons?: InlineButton[][]): Promise<number | null> {
  const r = await call<{ message_id: number }>("sendMessage", {
    chat_id: process.env.TELEGRAM_PARENT_CHAT_ID, text, parse_mode: "HTML",
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
  return r?.message_id ?? null;
}

export async function editParentMessage(messageId: number, text: string) {
  await call("editMessageText", { chat_id: process.env.TELEGRAM_PARENT_CHAT_ID, message_id: messageId, text, parse_mode: "HTML" });
}

export async function answerCallback(id: string, text?: string) {
  await call("answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) });
}

export async function replyTo(chatId: number | string, text: string) {
  await call("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
}
