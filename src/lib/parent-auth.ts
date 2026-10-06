import { currentUser } from "@/lib/auth/server";

/** Parent access: either the admin API key header or a signed-in user listed in PARENT_EMAILS. */
export async function isParent(request: Request): Promise<boolean> {
  const key = request.headers.get("x-admin-key");
  if (key && process.env.SCREEN_ADMIN_KEY && key === process.env.SCREEN_ADMIN_KEY) return true;
  const user = await currentUser();
  return !!user && parentEmails().includes(user.email.toLowerCase());
}

export function parentEmails(): string[] {
  return (process.env.PARENT_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}
