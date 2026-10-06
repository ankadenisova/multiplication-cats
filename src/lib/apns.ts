import http2 from "node:http2";
import { importPKCS8, SignJWT } from "jose";

/** Sends a silent (content-available) push so the iOS app re-reads its policy. No-op when APNs is not configured. */
export function apnsConfigured(): boolean {
  return Boolean(process.env.APNS_TEAM_ID && process.env.APNS_KEY_ID && process.env.APNS_KEY_P8);
}

let cachedJwt: { token: string; issuedAt: number } | null = null;

async function providerToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.issuedAt < 45 * 60) return cachedJwt.token;
  const pem = process.env.APNS_KEY_P8!.includes("BEGIN")
    ? process.env.APNS_KEY_P8!.replace(/\\n/g, "\n")
    : Buffer.from(process.env.APNS_KEY_P8!, "base64").toString("utf8");
  const key = await importPKCS8(pem, "ES256");
  const token = await new SignJWT({}).setProtectedHeader({ alg: "ES256", kid: process.env.APNS_KEY_ID! })
    .setIssuer(process.env.APNS_TEAM_ID!).setIssuedAt(now).sign(key);
  cachedJwt = { token, issuedAt: now };
  return token;
}

export async function sendSilentPush(deviceToken: string, payload: Record<string, unknown> = {}): Promise<{ status: number; body: string }> {
  const host = process.env.APNS_ENV === "production" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";
  const jwt = await providerToken();
  const body = JSON.stringify({ aps: { "content-available": 1 }, ...payload });
  return new Promise((resolve, reject) => {
    const client = http2.connect(host);
    client.on("error", reject);
    const req = client.request({
      ":method": "POST", ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": process.env.APNS_BUNDLE_ID || "com.alexpihq.studyapp",
      "apns-push-type": "background", "apns-priority": "5",
      "content-type": "application/json",
    });
    let status = 0; let data = "";
    req.on("response", (h) => { status = Number(h[":status"]); });
    req.on("data", (c) => { data += c; });
    req.on("end", () => { client.close(); resolve({ status, body: data }); });
    req.on("error", (e) => { client.close(); reject(e); });
    req.end(body);
  });
}
