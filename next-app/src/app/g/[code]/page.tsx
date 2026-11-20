"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Footer } from "@/components/Footer";
import { Podium } from "@/components/Podium";
import { Snow } from "@/components/Snow";
import { api, ensureGuestToken } from "@/lib/client";
import type { EventPublic } from "@/lib/types";

function GuestInner() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const code = (params.code || "").toUpperCase();
  const [guestKey, setGuestKey] = useState("");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [state, setState] = useState<EventPublic | null>(null);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fromUrl = search.get("k") || "";
    const stored = sessionStorage.getItem(`guess-digit-guestkey:${code}`) || "";
    const key = fromUrl || stored;
    if (fromUrl) sessionStorage.setItem(`guess-digit-guestkey:${code}`, fromUrl);
    setGuestKey(key);
    const savedName = sessionStorage.getItem(`guess-digit-name:${code}`) || "";
    if (savedName) setName(savedName);
  }, [code, search]);

  const refresh = useCallback(async () => {
    try {
      const data = await api<EventPublic>(`/api/events/${code}`);
      setState(data);
    } catch {
      setErr("Раунд не найден");
    }
  }, [code]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 1500);
    return () => clearInterval(id);
  }, [refresh]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const guestToken = ensureGuestToken(code);
      sessionStorage.setItem(`guess-digit-name:${code}`, name.trim());
      const data = await api<EventPublic>(`/api/events/${code}`, {
        method: "POST",
        body: {
          action: "guess",
          ...(guestKey ? { guestKey } : {}),
          guestToken,
          name: name.trim(),
          value: Number(value),
        },
      });
      setState(data);
      setSent(true);
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : "fail";
      const map: Record<string, string> = {
        closed: "Приём ответов закрыт",
        time_up: "Время вышло",
        forbidden: "Неверный ключ гостя — откройте QR ведущего",
        bad_name: "Введите имя",
        bad_value: "Введите целое число",
        no_fact: "Ведущий ещё не запустил факт",
      };
      setErr(map[msg] || msg);
    } finally {
      setBusy(false);
    }
  }

  const phase = state?.phase;

  return (
    <div className="shell">
      <div className="atmosphere" aria-hidden />
      <div className="garland" />
      <Snow count={12} />
      <main className="main stack" style={{ maxWidth: 520 }}>
        <div className="reveal">
          <p className="eyebrow">
            {state?.companyName || "Гость"} · {code}
          </p>
          <h1 className="display display-md">Угадай цифру</h1>
        </div>

        {state?.coverPhoto && <img className="cover" src={state.coverPhoto} alt="" />}

        {phase === "setup" && (
          <div className="panel">
            <p className="muted">Ведущий собирает факты. Держите телефон рядом.</p>
          </div>
        )}

        {(phase === "lobby" || phase === "guessing") && (
          <form className="panel stack reveal" onSubmit={(e) => void submit(e)}>
            <h2 className="display" style={{ fontSize: "clamp(1.8rem, 7vw, 2.6rem)", color: "var(--gold)" }}>
              {state?.question?.trim() || "Ожидаем вопрос…"}
            </h2>
            {phase === "guessing" && (
              <div className="timer" key={state?.secondsLeft ?? 0} style={{ fontSize: "4.2rem" }}>
                {state?.secondsLeft ?? 0}
              </div>
            )}
            <div className="field">
              <label>Ваше имя</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Аня" required maxLength={40} />
            </div>
            <div className="field">
              <label>Ваша цифра</label>
              <input
                inputMode="numeric"
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/[^\d-]/g, ""))}
                placeholder="42"
                required
              />
            </div>
            <button className="btn btn-gold" disabled={busy || !state?.question?.trim()} type="submit">
              {sent ? "Обновить ответ" : "Отправить"}
            </button>
            {sent && <p className="ok" style={{ margin: 0 }}>Принято! Можно исправить до финала.</p>}
            {err && <p className="error">{err}</p>}
          </form>
        )}

        {phase === "finale" && state && (
          <div className="panel">
            <Podium top3={state.top3 || []} answer={state.answer} />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function GuestPage() {
  return (
    <Suspense fallback={<div className="main muted">Загрузка…</div>}>
      <GuestInner />
    </Suspense>
  );
}
