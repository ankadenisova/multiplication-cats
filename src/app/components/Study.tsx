"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { divStrategyFor, missingStrategyFor, strategyFor } from "@/lib/hints";
import { sticker } from "@/lib/stickers";
import CatSticker from "./CatSticker";

type Card = { id: number; a: number; b: number; kind?: "mul" | "missing" | "div"; blank?: "a" | "b"; product?: number };
type Session = { id: number; size: number; answered: number; correct: number; finished: boolean };
type Home = {
  todaySessions: number; dayStreak: number; learned: number; total: number;
  todayAnswered: number; todayCorrect: number; openSession: Session | null;
  stickersTotal: number; minutesToday: number; rewardSessions: number;
};
type Feedback = { answer: number; hint: string | null; given: number | null };
type Reward = { minutes: number; balance: number };

/** Tells the iOS companion app (WKWebView bridge) that something happened. No-op in a normal browser. */
function notifyNative(event: string, data: Record<string, unknown> = {}) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).webkit?.messageHandlers?.studyapp?.postMessage({ event, ...data });
  } catch { /* not inside the app */ }
}
type Screen = "loading" | "home" | "play" | "done";

export default function Study({ name, userId, isParent = false }: { name: string; userId?: string; isParent?: boolean }) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [home, setHome] = useState<Home | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [reward, setReward] = useState<Reward | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tooManyDontKnow, setTooManyDontKnow] = useState(false);
  const [failReason, setFailReason] = useState<string | null>(null);
  const shownAt = useRef<number>(0);
  // Synchronous guard against double-submit on rapid taps (React state updates are async)
  const submittingRef = useRef(false);
  // Each shown card may be submitted only once; reset when the next card is loaded.
  const answeredCardRef = useRef(false);
  const [wrongPhone, setWrongPhone] = useState<string | null>(null);
  // Inside the iOS app older builds draw the screen-time bar over the page: leave room to scroll past it.
  const [inApp, setInApp] = useState(false);

  // "Не помню" is locked for 5 seconds after each new card to prevent rapid tapping
  const [canDontKnow, setCanDontKnow] = useState(false);
  // Two-step "Не помню": first tap shows how to work it out (not the answer), second tap actually submits
  const [hintPeeked, setHintPeeked] = useState(false);
  // "Всё равно не помню" is locked for 5 seconds after the hint appears
  const [canGiveUp, setCanGiveUp] = useState(false);
  useEffect(() => {
    if (!hintPeeked) return;
    setCanGiveUp(false);
    const t = setTimeout(() => setCanGiveUp(true), 5000);
    return () => clearTimeout(t);
  }, [hintPeeked]);

  // Reset dont-know state whenever a new card appears
  useEffect(() => {
    if (!card || screen !== "play") return;
    setCanDontKnow(false);
    setHintPeeked(false);
    const t = setTimeout(() => setCanDontKnow(true), 5000);
    return () => clearTimeout(t);
  }, [card?.id, screen]);

  const authGuard = (res: Response) => { if (res.status === 401) { window.location.assign("/auth/sign-in"); return true; } return false; };

  const loadHome = useCallback(async () => {
    try {
      const res = await fetch("/api/study/session", { cache: "no-store" });
      if (authGuard(res)) return;
      setError(null);
      setHome(await res.json());
      setScreen("home");
    } catch { setError("Нет связи. Попробуй ещё раз"); }
  }, []);

  const loadCard = useCallback(async (exclude?: number) => {
    setError(null);
    try {
      const q = exclude ? `?exclude=${exclude}` : "";
      const res = await fetch(`/api/study/next${q}`, { cache: "no-store" });
      if (authGuard(res)) return;
      const json = (await res.json()) as { card: Card };
      setCard(json.card);
      setInput("");
      setFeedback(null);
      answeredCardRef.current = false;
      shownAt.current = Date.now();
    } catch { setError("Нет связи. Попробуй ещё раз"); }
  }, []);

  const startSession = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/study/session", { method: "POST" });
      if (authGuard(res)) return;
      setSession(await res.json());
      setReward(null);
      setTooManyDontKnow(false);
      setScreen("play");
      await loadCard();
    } catch { setError("Не получилось начать сессию"); }
    finally { setBusy(false); }
  }, [loadCard]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
  useEffect(() => {
    loadHome();
    // Inside the iOS app: warn when the signed-in account is not the one this phone is paired to.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (userId && w.StudyPairedUserId && w.StudyPairedUserId !== userId) setWrongPhone(w.StudyPairedUserName || "другого ребёнка");
    if (w.StudyNative) setInApp(true);
  }, [loadHome, userId]);

  const submit = useCallback(async (dontKnow: boolean) => {
    if (!card || !session || busy) return;
    if (!dontKnow && input === "") return;
    // Synchronous ref guard prevents double-submit when two taps land before React re-renders
    if (submittingRef.current || answeredCardRef.current) return;
    submittingRef.current = true;
    answeredCardRef.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/study/answer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id, cardId: card.id, shownA: card.a, shownB: card.b, blank: card.blank ?? null,
          answer: dontKnow ? null : Number(input), dontKnow, responseMs: Date.now() - shownAt.current,
        }),
      });
      if (authGuard(res)) return;
      if (res.status === 409) { await loadHome(); return; } // session already finished elsewhere
      if (res.status === 429) return;                        // repeated tap on the same card: ignore
      const r = (await res.json()) as {
        correct: boolean; answer: number; hint: string | null;
        session: Session; home: Home | null; reward: Reward | null;
        tooManyDontKnow?: boolean;
        failReason?: string | null;
      };
      setSession(r.session);
      if (r.home) setHome(r.home);
      if (r.session.finished) {
        setTooManyDontKnow(r.tooManyDontKnow ?? false);
        setFailReason(r.failReason ?? null);
        setReward(r.reward);
        notifyNative("sessionFinished", { correct: r.session.correct, size: r.session.size, rewardMinutes: r.reward?.minutes ?? 0, balance: r.reward?.balance ?? null });
      }
      if (r.correct) {
        setFlash("ok");
        setTimeout(() => {
          setFlash(null);
          if (r.session.finished) setScreen("done"); else loadCard(card.id);
        }, 650);
      } else {
        setFlash("bad");
        setTimeout(() => setFlash(null), 350);
        setFeedback({ answer: r.answer, hint: r.hint, given: dontKnow ? null : Number(input) });
      }
    } catch { answeredCardRef.current = false; setError("Не получилось отправить ответ"); }
    finally { setBusy(false); submittingRef.current = false; }
  }, [card, session, busy, input, loadCard, loadHome]);

  const next = useCallback(() => {
    if (session?.finished) setScreen("done"); else loadCard(card?.id);
  }, [session, card, loadCard]);

  // Physical keyboard support (desktop / iPad with keyboard).
  useEffect(() => {
    if (screen !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      if (feedback) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); next(); } return; }
      if (/^[0-9]$/.test(e.key)) setInput((v) => (v.length < 3 ? v + e.key : v));
      else if (e.key === "Backspace") setInput((v) => v.slice(0, -1));
      else if (e.key === "Enter") { e.preventDefault(); submit(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, feedback, submit, next]);

  const header = (
    <header className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
      {wrongPhone && (
        <div className="absolute inset-x-0 top-0 z-10 bg-[var(--bad-soft)] px-4 py-3 text-center text-sm">
          Это телефон {wrongPhone}, а вход выполнен как {name}. Минуты за сессии уйдут не туда.{" "}
          <Link href="/auth/sign-out" className="font-bold underline">Выйти</Link>
        </div>
      )}
      <div className="text-xl font-black truncate">{name} ♡</div>
      <nav className="flex gap-2">
        <Link href="/album" className="pill">Альбом</Link>
        <Link href="/progress" className="pill">Прогресс</Link>
        {isParent && <Link href="/admin" className="pill">Админка</Link>}
        <Link href="/auth/sign-out" className="pill !text-[var(--muted)]">Выйти</Link>
      </nav>
    </header>
  );

  if (screen === "loading" || (screen === "home" && !home)) {
    return (
      <main className="flex-1 flex flex-col">{header}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--muted)]">
          <CatSticker index={0} size={90} bare />
          {error ?? "Загружаю…"}
        </div>
        {error && <button className="btn-main mx-auto mb-8 !w-auto px-8" onClick={loadHome}>Повторить</button>}
      </main>
    );
  }

  if (screen === "home" && home) {
    const resume = home.openSession;
    const slots = Math.max(home.rewardSessions, Math.min(home.todaySessions, 10));
    const firstToday = home.stickersTotal - home.todaySessions;
    const latest = home.stickersTotal > 0 ? home.stickersTotal - 1 : null;
    return (
      <main className="flex-1 flex flex-col max-w-md w-full mx-auto">{header}
        <div className="flex-1 flex flex-col items-center justify-start gap-6 px-5 pt-8 pb-6 text-center">
          <div className="polaroid w-64 -rotate-2">
            <span className="tape -top-3 left-6 -rotate-6" />
            <span className="tape -top-3 right-6 rotate-6" />
            <div className="flex h-44 items-center justify-center rounded-lg bg-[var(--accent-soft)]">
              {latest !== null ? <CatSticker index={latest} size={150} /> : <CatSticker index={0} size={130} bare className="opacity-90" />}
            </div>
            <div className="mt-3 text-base font-extrabold">
              {latest !== null ? <>В альбоме {home.stickersTotal} {plural(home.stickersTotal, "наклейка", "наклейки", "наклеек")}</> : "Первая наклейка ждёт тебя"}
            </div>
          </div>

          <section className="w-full">
            <div className="mb-2 flex items-baseline justify-between px-1">
              <span className="font-extrabold">Наклейки за сегодня</span>
              <span className="text-sm text-[var(--muted)]">{home.minutesToday} мин заработано</span>
            </div>
            <div className="flex justify-center gap-2">
              {Array.from({ length: slots }, (_, k) => (
                <div key={k} className="slot h-14 w-14">
                  {k < home.todaySessions ? <CatSticker index={firstToday + k} size={56} /> : <span className="text-lg text-[#D6BFF0]">{k + 1}</span>}
                </div>
              ))}
            </div>
          </section>

          <div className="flex w-full justify-center gap-2 text-sm">
            <span className="pill">🔥 {home.dayStreak} {plural(home.dayStreak, "день", "дня", "дней")} подряд</span>
            <span className="pill">выучено {home.learned} из {home.total}</span>
          </div>

          <button className="btn-main" disabled={busy} onClick={startSession}>
            {resume ? `Продолжить (${resume.answered} из ${resume.size})` : "Начать сессию"}
          </button>
          {error && <div className="text-sm text-[var(--bad)]">{error}</div>}
        </div>
      </main>
    );
  }

  if (screen === "done" && session) {
    const all = session.correct === session.size;
    const newSticker = !tooManyDontKnow && home && home.stickersTotal > 0 ? home.stickersTotal - 1 : null;
    return (
      <main className="flex-1 flex flex-col max-w-md w-full mx-auto">{header}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          {newSticker !== null ? (
            <>
              <div className="text-sm font-extrabold uppercase tracking-widest text-[var(--muted)]">Новая наклейка</div>
              <CatSticker index={newSticker} size={190} className="stick drop-shadow-lg" />
              <h1 className="text-2xl font-black">{sticker(newSticker).name}</h1>
              <p className="text-lg">{session.correct} из {session.size} верно{all ? ", без единой ошибки!" : ""}</p>
              {reward && reward.minutes > 0 && <div className="pill !text-base">+{reward.minutes} мин на телефоне</div>}
              {reward && reward.minutes === 0 && <div className="text-sm text-[var(--muted)]">Минуты на сегодня уже все, а наклейки можно собирать дальше</div>}
            </>
          ) : (
            <>
              <CatSticker index={2} size={130} bare className="opacity-80" />
              <h1 className="text-2xl font-black">Сессия не засчитана</h1>
              <p className="text-lg text-[var(--muted)]">
                {failReason === "fewcorrect"
                  ? "Правильных ответов маловато. Попробуй ещё раз, котик в тебя верит"
                  : "Слишком много «не помню». Попробуй ещё раз и постарайся вспомнить сама"}
              </p>
            </>
          )}
          <button className="btn-main mt-3" disabled={busy} onClick={startSession}>Ещё одну сессию</button>
          <button className="font-extrabold text-[var(--accent-deep)] underline underline-offset-4" onClick={loadHome}>На главную</button>
        </div>
      </main>
    );
  }

  if (!card || !session) {
    return <main className="flex-1 flex flex-col">{header}<div className="flex-1 flex items-center justify-center text-[var(--muted)]">{error ?? "Загружаю…"}</div></main>;
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"];
  const cardBg = flash === "ok" ? "var(--ok-soft)" : feedback ? "var(--bad-soft)" : hintPeeked ? "var(--accent-soft)" : "#fff";
  const keypad = (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <button key={k} disabled={busy} aria-label={k === "⌫" ? "стереть" : k === "✓" ? "ответить" : k}
          className={`key ${k === "✓" ? "!bg-[var(--accent)] !text-white !shadow-[0_4px_0_var(--accent-deep)]" : ""} ${k === "⌫" ? "!text-[var(--muted)]" : ""}`}
          onClick={() => {
            if (k === "⌫") setInput((v) => v.slice(0, -1));
            else if (k === "✓") submit(false);
            else setInput((v) => (v.length < 3 ? v + k : v));
          }}>
          {k}
        </button>
      ))}
    </div>
  );

  return (
    <main className="flex-1 flex flex-col max-w-md w-full mx-auto">
      {header}
      <div className="flex items-center justify-between px-5 pb-1">
        <div className="flex gap-1.5" aria-label={`Пример ${Math.min(session.answered + 1, session.size)} из ${session.size}`}>
          {Array.from({ length: session.size }, (_, i) => (
            <span key={i} className="h-3.5 w-3.5 rounded-full border-2"
              style={i < session.answered ? { background: "var(--accent)", borderColor: "var(--accent)" } : i === session.answered ? { borderColor: "var(--accent)", background: "#fff" } : { borderColor: "#E4D3F7", background: "#fff" }} />
          ))}
        </div>
        <span className="text-sm font-extrabold text-[var(--muted)]">{session.correct} верно</span>
      </div>

      <section className={`polaroid mx-5 mt-5 -rotate-1 text-center transition-colors ${flash === "bad" ? "shake" : ""}`} style={{ background: cardBg }}>
        <span className="tape -top-3 left-1/2 -translate-x-1/2 -rotate-3" />
        <CatSticker index={session.id} size={58} className="absolute -right-4 -top-6 rotate-12" />
        <div className="pt-4">
          {card.kind === "div" ? (
            <div className="text-6xl font-black tabular-nums whitespace-nowrap">
              {card.product} ÷ {card.blank === "a" ? card.b : card.a}
            </div>
          ) : card.kind === "missing" ? (
            <div className="text-5xl font-black tabular-nums whitespace-nowrap">
              {card.blank === "a" ? <span className="text-[var(--accent)]">…</span> : card.a} × {card.blank === "b" ? <span className="text-[var(--accent)]">…</span> : card.b} = {card.product}
            </div>
          ) : (
            <div className="text-7xl font-black tabular-nums">{card.a} × {card.b}</div>
          )}
        </div>
        {feedback ? (
          <div className="mt-3 space-y-2" aria-live="polite">
            <div className="text-4xl font-black tabular-nums">{card.kind === "missing" ? `… = ${feedback.answer}` : `= ${feedback.answer}`}</div>
            {feedback.given !== null && <div className="text-base text-[var(--bad)]">Ты написала {feedback.given}</div>}
            {feedback.hint && <div className="mt-2 rounded-2xl bg-white/80 p-3 text-left text-base leading-snug">💡 {feedback.hint}</div>}
          </div>
        ) : hintPeeked ? (
          <div className="mt-3 space-y-2" aria-live="polite">
            <div className="rounded-2xl bg-white/80 p-3 text-left text-lg leading-snug">💡 {card.kind === "div" ? divStrategyFor(card.blank === "a" ? card.b : card.a, card.product ?? card.a * card.b) : card.kind === "missing" ? missingStrategyFor(card.blank === "a" ? card.b : card.a, card.product ?? card.a * card.b) : strategyFor(card.a, card.b)}</div>
            <div className="mx-auto h-14 w-32 rounded-2xl border-[3px] border-dashed border-[var(--pink)] flex items-center justify-center text-4xl font-black tabular-nums">{input || <span className="text-[#D6BFF0]">?</span>}</div>
            <div className="text-sm text-[var(--muted)]">Посчитай и введи ответ</div>
          </div>
        ) : (
          <div className="mx-auto mt-4 mb-1 h-16 w-36 rounded-2xl border-[3px] border-dashed border-[var(--pink)] flex items-center justify-center text-5xl font-black tabular-nums" aria-live="polite">
            {flash === "ok" ? <span className="pop text-[var(--ok)]">{input}</span> : (input || <span className="text-[#D6BFF0]">?</span>)}
          </div>
        )}
      </section>

      {error && <div className="mx-4 mt-2 text-center text-sm text-[var(--bad)]">{error}</div>}

      <div className="flex-1 min-h-5" />

      {feedback ? (
        <section className="px-4 pt-5 pb-6">
          <button className="btn-main" onClick={next}>{session.finished ? "Итоги сессии →" : "Понятно, дальше →"}</button>
        </section>
      ) : hintPeeked ? (
        <section className="px-4 pt-5 pb-6">
          <button className="mb-3 w-full rounded-2xl bg-white py-3 text-lg font-extrabold text-[var(--bad)] shadow-[0_3px_0_var(--bad-soft)] disabled:opacity-60"
            disabled={busy || !canGiveUp} onClick={() => submit(true)}>
            {canGiveUp ? "Всё равно не помню" : "подумай…"}
          </button>
          {keypad}
        </section>
      ) : (
        <section className="px-4 pt-5 pb-6">
          <button
            className="mb-3 w-full rounded-2xl bg-white py-3 text-lg font-extrabold text-[var(--muted)] shadow-[0_3px_0_#E4D3F7] active:bg-[var(--accent-soft)] disabled:opacity-50"
            disabled={busy || !canDontKnow}
            onClick={() => setHintPeeked(true)}>
            {canDontKnow ? "Не помню" : "Не помню (подожди…)"}
          </button>
          {keypad}
        </section>
      )}
      {inApp && <div className="h-28 shrink-0" aria-hidden />}
    </main>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
