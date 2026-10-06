import { NextResponse } from "next/server";
import { Resend } from "resend";
import { verifyNeonWebhook } from "@/lib/neon-webhook";

/**
 * Neon Auth webhook: when registered for `send.magic_link` / `send.otp`, Neon stops
 * sending its own emails and we deliver them through Resend instead.
 * Register with scripts/register-neon-webhook.sh once RESEND_API_KEY is set.
 */
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const payload = await verifyNeonWebhook(raw, request.headers);
    const { event_type, event_data, user } = payload as {
      event_type: string; event_data: Record<string, string>; user: { email: string; name?: string };
    };
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.EMAIL_FROM || "StudyApp <onboarding@resend.dev>";

    if (event_type === "send.magic_link") {
      // link_type: "sign-in" | "email-verification" | "forget-password"
      const kind = event_data.link_type === "forget-password" ? "сброса пароля"
        : event_data.link_type === "email-verification" ? "подтверждения почты" : "входа";
      await resend.emails.send({
        from, to: user.email, subject: `Ссылка для ${kind} — Таблица умножения`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
          <h2>Привет${user.name ? ", " + user.name : ""}!</h2>
          <p>Нажми на кнопку, чтобы ${kind === "сброса пароля" ? "придумать новый пароль" : kind === "подтверждения почты" ? "подтвердить почту" : "войти"}:</p>
          <p style="text-align:center;margin:24px 0"><a href="${event_data.link_url}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:16px">Открыть</a></p>
          <p style="color:#6b7280;font-size:13px">Если ты этого не просил(а), просто не обращай внимания на письмо.</p></div>`,
      });
      return NextResponse.json({ success: true });
    }
    if (event_type === "send.otp") {
      await resend.emails.send({
        from, to: user.email, subject: `Код ${event_data.otp_code} — Таблица умножения`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
          <p>Твой код:</p><h1 style="background:#ede9fe;padding:16px;letter-spacing:6px;text-align:center;border-radius:10px">${event_data.otp_code}</h1>
          <p style="color:#6b7280;font-size:13px">Код действует 15 минут.</p></div>`,
      });
      return NextResponse.json({ success: true });
    }
    if (event_type === "user.before_create") return NextResponse.json({ allowed: false, error_message: "Регистрация закрыта", error_code: "SIGNUP_DISABLED" });
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("neon webhook error:", msg);
    return NextResponse.json({ error: msg }, { status: msg.includes("signature") ? 400 : 500 });
  }
}
