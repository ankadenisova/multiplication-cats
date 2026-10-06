import { redirect } from "next/navigation";
import { AuthView } from "@neondatabase/auth/react/ui";
import { auth } from "@/lib/auth/server";
import { ruAuth } from "@/lib/auth/localization";
import CatSticker from "../../components/CatSticker";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["sign-in", "sign-up", "forgot-password", "reset-password", "sign-out", "callback", "email-otp", "magic-link"]);

export default async function AuthPage({ params }: { params: Promise<{ pathname: string }> }) {
  const { pathname } = await params;
  if (!ALLOWED.has(pathname)) redirect("/auth/sign-in");

  if (pathname !== "sign-out" && pathname !== "callback") {
    const { data: session } = await auth.getSession();
    if (session?.user) redirect("/");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex flex-col items-center text-center">
        <CatSticker index={8} size={120} className="-rotate-6 drop-shadow-md" />
        <h1 className="mt-2 text-3xl font-black">Котики и умножение</h1>
        <p className="text-[var(--muted)]">Решай примеры и собирай наклейки</p>
      </div>
      <div className="polaroid w-full max-w-sm rotate-[0.5deg] !p-2">
        <span className="tape -top-3 left-1/2 -translate-x-1/2 -rotate-2" />
        <AuthView path={pathname} redirectTo="/" localization={ruAuth} className="w-full border-0 shadow-none" />
      </div>
    </main>
  );
}
