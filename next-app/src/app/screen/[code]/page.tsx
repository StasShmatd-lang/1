"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Footer } from "@/components/Footer";
import { GuessViz } from "@/components/GuessViz";
import { Podium } from "@/components/Podium";
import { Snow } from "@/components/Snow";
import { api } from "@/lib/client";
import type { EventPublic } from "@/lib/types";

export default function ScreenPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code || "").toUpperCase();
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<EventPublic | null>(null);
  const [err, setErr] = useState("");
  const [viz, setViz] = useState<"bars" | "cloud">("bars");

  useEffect(() => {
    const hash = window.location.hash || "";
    const m = hash.match(/[#&]s=([^&]+)/);
    const fromHash = m ? decodeURIComponent(m[1]!) : "";
    const stored = sessionStorage.getItem(`guess-digit-screen:${code}`) || "";
    const t = fromHash || stored;
    if (fromHash) sessionStorage.setItem(`guess-digit-screen:${code}`, fromHash);
    setToken(t || null);
  }, [code]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api<EventPublic>(`/api/events/${code}`, { token });
      setState(data);
      setErr("");
    } catch {
      setErr("Нет доступа к экрану");
    }
  }, [code, token]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 1000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(() => setViz((v) => (v === "bars" ? "cloud" : "bars")), 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="shell screen-shell">
      <div className="atmosphere" aria-hidden />
      <div className="garland" />
      <Snow count={28} />
      <main className="main">
        <div className="screen-stage">
          <div className="screen-meta reveal">
            <div>
              <p className="eyebrow">
                {state?.companyName || "Новогодний зал"} · код {code}
              </p>
              <h1 className="display screen-q">
                {state?.question?.trim()
                  ? state.question
                  : state?.phase === "setup"
                    ? "Ждём факт от ведущего"
                    : "Угадай цифру"}
              </h1>
            </div>
            {state?.phase === "guessing" && (
              <div className="timer screen-timer" key={state.secondsLeft ?? 0}>
                {state.secondsLeft ?? 0}
              </div>
            )}
            {state?.phase === "lobby" && <div className="lobby-pulse">Готовы?</div>}
          </div>

          {state?.coverPhoto && state.phase !== "finale" && (
            <img className="cover" src={state.coverPhoto} alt="" style={{ maxHeight: 160 }} />
          )}

          <div className="screen-viz reveal" style={{ animationDelay: "0.1s" }}>
            {!token && <p className="error">Откройте экран по ссылке ведущего (токен в #s=…).</p>}
            {err && <p className="error">{err}</p>}
            {state?.phase === "setup" && (
              <p className="muted" style={{ fontSize: "1.2rem" }}>
                Ведущий собирает факты…
              </p>
            )}
            {state && (state.phase === "lobby" || state.phase === "guessing") && (
              <div className="stack" style={{ height: "100%" }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="screen-count">Ответов: {state.guessCount}</span>
                  <span className="muted">{viz === "bars" ? "гистограмма" : "облако"}</span>
                </div>
                <GuessViz guesses={state.guesses} mode={viz} hall />
              </div>
            )}
            {state?.phase === "finale" && <Podium top3={state.top3 || []} answer={state.answer} hall />}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
