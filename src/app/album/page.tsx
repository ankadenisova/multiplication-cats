import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { sql } from "@/db";
import { STICKER_COUNT, sticker } from "@/lib/stickers";
import CatSticker from "../components/CatSticker";

export const dynamic = "force-dynamic";

export default async function AlbumPage() {
  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");
  const [row] = await sql`SELECT count(*)::int AS n FROM sessions WHERE user_id = ${user.id} AND finished_at IS NOT NULL AND counted`;
  const total: number = row?.n ?? 0;
  // Sticker i is earned by counted sessions i, i + 24, i + 48…
  const copies = (i: number) => (total > i ? Math.floor((total - 1 - i) / STICKER_COUNT) + 1 : 0);
  const unique = Math.min(total, STICKER_COUNT);

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-10">
      <header className="flex items-center justify-between py-4">
        <Link href="/" className="pill">← Учить</Link>
        <h1 className="text-xl font-black">Альбом {user.name}</h1>
      </header>

      <p className="mb-5 text-center text-[var(--muted)]">
        Собрано {unique} из {STICKER_COUNT}. За каждую засчитанную сессию новый котик
      </p>

      <section className="polaroid grid grid-cols-3 gap-x-2 gap-y-5 rotate-[0.6deg]">
        <span className="tape -top-3 left-8 -rotate-6" />
        <span className="tape -top-3 right-8 rotate-6" />
        {Array.from({ length: STICKER_COUNT }, (_, i) => {
          const n = copies(i);
          const s = sticker(i);
          return (
            <div key={i} className="flex flex-col items-center gap-1 text-center">
              {n > 0 ? (
                <div className="relative" style={{ transform: `rotate(${((i * 37) % 17) - 8}deg)` }}>
                  <CatSticker index={i} size={84} className="drop-shadow" />
                  {n > 1 && <span className="absolute -right-1 -top-1 rounded-full bg-[var(--accent)] px-1.5 text-xs font-black text-white">×{n}</span>}
                </div>
              ) : (
                <div className="slot h-[84px] w-[84px] text-2xl font-black text-[#D6BFF0]">?</div>
              )}
              <div className="text-xs font-bold leading-tight text-[var(--muted)]">{n > 0 ? s.name : "ещё не найден"}</div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
