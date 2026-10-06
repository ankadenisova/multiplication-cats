import crypto from "node:crypto";

/** Verifies the Ed25519 detached-JWS signature Neon Auth puts on webhook calls. */
export async function verifyNeonWebhook(rawBody: string, headers: Headers) {
  const signature = headers.get("x-neon-signature");
  const kid = headers.get("x-neon-signature-kid");
  const timestamp = headers.get("x-neon-timestamp");
  if (!signature || !kid || !timestamp) throw new Error("Missing Neon webhook signature headers");

  const res = await fetch(`${process.env.NEON_AUTH_BASE_URL}/.well-known/jwks.json`);
  const jwks = (await res.json()) as { keys: (crypto.JsonWebKey & { kid: string })[] };
  const jwk = jwks.keys.find((k) => k.kid === kid);
  if (!jwk) throw new Error(`Key ${kid} not found in JWKS`);
  const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });

  const [headerB64, emptyPayload, signatureB64] = signature.split(".");
  if (emptyPayload !== "") throw new Error("Expected detached JWS signature");
  const payloadB64 = Buffer.from(rawBody, "utf8").toString("base64url");
  const signingPayloadB64 = Buffer.from(`${timestamp}.${payloadB64}`, "utf8").toString("base64url");
  const ok = crypto.verify(null, Buffer.from(`${headerB64}.${signingPayloadB64}`), publicKey, Buffer.from(signatureB64, "base64url"));
  if (!ok) throw new Error("Invalid webhook signature");
  if (Date.now() - parseInt(timestamp, 10) > 5 * 60 * 1000) throw new Error("Webhook timestamp too old");
  return JSON.parse(rawBody);
}
