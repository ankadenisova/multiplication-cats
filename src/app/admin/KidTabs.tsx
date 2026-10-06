"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Tab strip that shows one kid at a time; remembers the last choice in this browser. */
export default function KidTabs({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  useEffect(() => {
    try { const saved = localStorage.getItem("admin.kid"); if (saved && tabs.some((t) => t.id === saved)) setActive(saved); } catch {}
  }, [tabs]);
  const pick = (id: string) => { setActive(id); try { localStorage.setItem("admin.kid", id); } catch {} };
  return (
    <div>
      <div className="mb-4 flex rounded-2xl bg-white p-1 shadow-sm">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => pick(t.id)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${active === t.id ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => <div key={t.id} hidden={active !== t.id}>{t.content}</div>)}
    </div>
  );
}
