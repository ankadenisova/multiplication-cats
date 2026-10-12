import { NextResponse } from "next/server";
import { Resend } from "resend";
import { verifyNeonWebhook } from "@/lib/neon-webhook";
import { t } from "@/lib/i18n";

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
      const link = t.email.link[event_data.link_type === "forget-password" ? "reset" : event_data.link_type === "email-verification" ? "verify" : "signIn"];
      await resend.emails.send({
        from, to: user.email, subject: t.email.linkSubject(link.kind),
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
          <h2>${t.email.greeting(user.name)}</h2>
          <p>${t.email.linkBody(link.action)}</p>
          <p style="text-align:center;margin:24px 0"><a href="${event_data.link_url}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:16px">${t.email.open}</a></p>
          <p style="color:#6b7280;font-size:13px">${t.email.linkFooter}</p></div>`,
      });
      return NextResponse.json({ success: true });
    }
    if (event_type === "send.otp") {
      await resend.emails.send({
        from, to: user.email, subject: t.email.otpSubject(event_data.otp_code),
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
          <p>${t.email.otpBody}</p><h1 style="background:#ede9fe;padding:16px;letter-spacing:6px;text-align:center;border-radius:10px">${event_data.otp_code}</h1>
          <p style="color:#6b7280;font-size:13px">${t.email.otpExpires}</p></div>`,
      });
      return NextResponse.json({ success: true });
    }
    if (event_type === "user.before_create") return NextResponse.json({ allowed: false, error_message: t.email.signupClosed, error_code: "SIGNUP_DISABLED" });
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("neon webhook error:", msg);
    return NextResponse.json({ error: msg }, { status: msg.includes("signature") ? 400 : 500 });
  }
}
