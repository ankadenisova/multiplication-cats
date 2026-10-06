import { createNeonAuth } from "@neondatabase/auth/next/server";

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
});

/** Returns the signed-in user's id or null. */
export async function currentUser(): Promise<{ id: string; name: string; email: string } | null> {
  const { data: session } = await auth.getSession();
  const u = session?.user;
  if (!u) return null;
  return { id: u.id, name: u.name ?? "", email: u.email ?? "" };
}
