"use client";

import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Footer } from "@/components/Footer";
import { GuessViz } from "@/components/GuessViz";
import { Podium } from "@/components/Podium";
import { Snow } from "@/components/Snow";
import { api, compressImage } from "@/lib/client";
import type { EventPublic, Phase } from "@/lib/types";

type HostState = EventPublic & {
  guestKey?: string;
  screenToken?: string;
  answer?: number | null;
};

export default function HostPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code || "").toUpperCase();
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<HostState | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [durationSec, setDurationSec] = useState(45);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    const t = sessionStorage.getItem(`guess-digit-host:${code}`);
    setToken(t);
  }, [code]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api<HostState>(`/api/events/${code}`, { token });
      setState(data);
      setCompanyName(data.companyName || "");
      setQuestion(data.question || "");
      if (data.answer != null) setAnswer(String(data.answer));
      setDurationSec(data.durationSec || 45);
      setCoverPhoto(data.coverPhoto);
      if (data.guestKey) sessionStorage.setItem(`guess-digit-guestkey:${code}`, data.guestKey);
      if (data.screenToken) sessionStorage.setItem(`guess-digit-screen:${code}`, data.screenToken);
    } catch {
      setErr("Нет доступа к раунду. Создайте новый с главной.");
    }
  }, [code, token]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 1200);
    return () => clearInterval(id);
  }, [refresh]);

  const guestUrl = useMemo(() => {
    if (!origin || !state?.guestKey) return "";
    return `${origin}/g/${code}?k=${encodeURIComponent(state.guestKey)}`;
  }, [origin, code, state?.guestKey]);

  const screenUrl = useMemo(() => {
    if (!origin || !state?.screenToken) return "";
    return `${origin}/screen/${code}#s=${encodeURIComponent(state.screenToken)}`;
  }, [origin, code, state?.screenToken]);

  async function save() {
    if (!token) return;
    setBusy(true);
    setErr("");
    try {
      const data = await api<HostState>(`/api/events/${code}`, {
        method: "PATCH",
        token,
        body: {
          action: "save",
          companyName,
          question,
          answer: Number(answer),
          durationSec,
          coverPhoto,
        },
      });
      setState(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "save_failed");
    } finally {
      setBusy(false);
    }
  }

  async function act(action: "lobby" | "start" | "finale" | "reset") {
    if (!token) return;
    setBusy(true);
    setErr("");
    try {
      if (action === "lobby" || action === "start") await save();
      const data = await api<HostState>(`/api/events/${code}`, {
        method: "PATCH",
        token,
        body: { action },
      });
      setState(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "action_failed");
    } finally {
      setBusy(false);
    }
  }

  async function onPhoto(file: File | null) {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setCoverPhoto(dataUrl);
    } catch {
      setErr("Не удалось обработать фото");
    }
  }

  const phase: Phase = state?.phase || "setup";

  if (!token) {
    return (
      <div className="shell">
        <main className="main panel">
          <h1 className="display" style={{ fontSize: "2.5rem" }}>
            Ведущий
          </h1>
          <p className="error">Токен ведущего не найден на этом устройстве. Создайте раунд с главной.</p>
          <Link className="btn btn-ice" href="/">
            На главную
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="garland" />
      <Snow count={18} />
      <main className="main stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <p className="muted" style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Ведущий · код {code}
            </p>
            <h1 className="display" style={{ fontSize: "clamp(2.4rem, 8vw, 4rem)" }}>
              {companyName || "Угадай цифру"}
            </h1>
          </div>
          <div className="row">
            <a className="btn btn-ice" href={screenUrl || "#"} target="_blank" rel="noreferrer">
              Экран зала
            </a>
            <Link className="btn btn-ghost" href="/">
              Выход
            </Link>
          </div>
        </div>

        {(phase === "setup" || phase === "lobby") && (
          <div className="panel stack">
            <h2 className="display" style={{ fontSize: "2rem", color: "var(--lime)" }}>
              Настройка раунда
            </h2>
            <div className="field">
              <label>Компания / ивент</label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme NY Party" />
            </div>
            <div className="field">
              <label>Вопрос</label>
              <textarea
                rows={2}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Сколько ёлок в офисе?"
              />
            </div>
            <div className="row">
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label>Правильный ответ</label>
                <input
                  inputMode="numeric"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value.replace(/[^\d-]/g, ""))}
                  placeholder="12"
                />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label>Таймер, сек</label>
                <input
                  type="number"
                  min={10}
                  max={180}
                  value={durationSec}
                  onChange={(e) => setDurationSec(Number(e.target.value) || 45)}
                />
              </div>
            </div>
            <div className="field">
              <label>Обложка / фото приза (опционально)</label>
              <input type="file" accept="image/*" onChange={(e) => void onPhoto(e.target.files?.[0] || null)} />
              {coverPhoto && <img className="cover" src={coverPhoto} alt="Обложка" />}
            </div>
            <div className="row">
              <button className="btn btn-ghost" disabled={busy} onClick={() => void save()}>
                Сохранить
              </button>
              <button className="btn btn-lime" disabled={busy} onClick={() => void act("lobby")}>
                В лобби
              </button>
              <button className="btn btn-coral" disabled={busy} onClick={() => void act("start")}>
                Старт!
              </button>
            </div>
          </div>
        )}

        {guestUrl && (
          <div className="panel" style={{ display: "grid", gap: "1rem", gridTemplateColumns: "auto 1fr" }}>
            <div className="qr-wrap">
              <QRCodeSVG value={guestUrl} size={148} />
            </div>
            <div className="stack">
              <strong>Гости сканируют QR</strong>
              <p className="muted" style={{ margin: 0, wordBreak: "break-all" }}>
                {guestUrl}
              </p>
              <button
                className="btn btn-ice"
                type="button"
                onClick={() => void navigator.clipboard.writeText(guestUrl)}
              >
                Копировать ссылку гостя
              </button>
            </div>
          </div>
        )}

        {(phase === "guessing" || phase === "lobby" || phase === "finale") && state && (
          <div className="panel stack">
            <div className="screen-meta">
              <div>
                <p className="muted" style={{ margin: 0 }}>
                  Фаза: {phase} · ответов: {state.guessCount}
                </p>
                <h2 className="display screen-q" style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)" }}>
                  {state.question}
                </h2>
              </div>
              {phase === "guessing" && (
                <div className="timer" key={state.secondsLeft ?? 0}>
                  {state.secondsLeft ?? 0}
                </div>
              )}
            </div>
            {phase !== "finale" ? (
              <GuessViz guesses={state.guesses} />
            ) : (
              <Podium top3={state.top3 || []} answer={state.answer ?? null} />
            )}
            <div className="row">
              {phase === "lobby" && (
                <button className="btn btn-coral" disabled={busy} onClick={() => void act("start")}>
                  Запустить таймер
                </button>
              )}
              {phase === "guessing" && (
                <button className="btn btn-lime" disabled={busy} onClick={() => void act("finale")}>
                  Финал сейчас
                </button>
              )}
              <button className="btn btn-ghost" disabled={busy} onClick={() => void act("reset")}>
                Новый раунд
              </button>
            </div>
          </div>
        )}

        {err && <p className="error">{err}</p>}
      </main>
      <Footer />
    </div>
  );
}
