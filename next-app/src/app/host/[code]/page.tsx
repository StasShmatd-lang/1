"use client";

import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Footer } from "@/components/Footer";
import { GuessViz } from "@/components/GuessViz";
import { Podium } from "@/components/Podium";
import { Snow } from "@/components/Snow";
import { api, compressImage } from "@/lib/client";
import type { EventPublic, Fact, Phase } from "@/lib/types";

type HostState = EventPublic & {
  guestKey?: string;
  screenToken?: string;
  answer?: number | null;
  facts?: Fact[];
};

const ERR_MAP: Record<string, string> = {
  incomplete: "Сначала добавьте факт: вопрос и число",
  bad_answer: "Ответ должен быть целым числом",
  bad_fact: "Не удалось добавить факт",
  fact_not_found: "Факт не найден в банке",
  bad_duration: "Таймер: от 10 до 180 секунд",
  bad_photo: "Некорректное фото",
  photo_too_big: "Фото слишком большое",
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
  const [facts, setFacts] = useState<Fact[]>([]);
  const [paste, setPaste] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const seeded = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    const t = sessionStorage.getItem(`guess-digit-host:${code}`);
    setToken(t);
    seeded.current = false;
    dirty.current = false;
  }, [code]);

  const markDirty = () => {
    dirty.current = true;
  };

  const applyRemote = useCallback((data: HostState, force = false) => {
    setState(data);
    if (data.guestKey) sessionStorage.setItem(`guess-digit-guestkey:${code}`, data.guestKey);
    if (data.screenToken) sessionStorage.setItem(`guess-digit-screen:${code}`, data.screenToken);
    setFacts(data.facts || []);
    if (!force && dirty.current && seeded.current) return;
    setCompanyName(data.companyName || "");
    setQuestion(data.question || "");
    setAnswer(data.answer != null ? String(data.answer) : "");
    setDurationSec(data.durationSec || 45);
    setCoverPhoto(data.coverPhoto);
    seeded.current = true;
    dirty.current = false;
  }, [code]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api<HostState>(`/api/events/${code}`, { token });
      applyRemote(data);
    } catch {
      setErr("Нет доступа к раунду. Создайте новый с главной.");
    }
  }, [code, token, applyRemote]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 1500);
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

  function mapErr(e: unknown) {
    const msg = e instanceof Error ? e.message : "fail";
    return ERR_MAP[msg] || msg;
  }

  async function patch(body: Record<string, unknown>) {
    if (!token) throw new Error("no_token");
    const data = await api<HostState>(`/api/events/${code}`, {
      method: "PATCH",
      token,
      body,
    });
    applyRemote(data, true);
    return data;
  }

  async function addFact() {
    if (!question.trim() || answer === "" || Number.isNaN(Number(answer))) {
      setErr("Введите вопрос и целое число");
      return;
    }
    setBusy(true);
    setErr("");
    setOkMsg("");
    try {
      await patch({
        action: "save",
        companyName,
        durationSec,
        coverPhoto,
        addFact: { question: question.trim(), answer: Number(answer) },
      });
      setQuestion("");
      setAnswer("");
      dirty.current = false;
      setOkMsg("Факт сохранён в банке");
    } catch (e) {
      setErr(mapErr(e));
    } finally {
      setBusy(false);
    }
  }

  async function importPaste() {
    if (!paste.trim()) {
      setErr("Вставьте строки: вопрос | число");
      return;
    }
    setBusy(true);
    setErr("");
    setOkMsg("");
    try {
      await patch({
        action: "save",
        companyName,
        durationSec,
        coverPhoto,
        factsPaste: paste,
      });
      setPaste("");
      dirty.current = false;
      setOkMsg("Факты загружены в банк");
    } catch (e) {
      setErr(mapErr(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeFact(id: string) {
    setBusy(true);
    setErr("");
    try {
      await patch({
        action: "save",
        companyName,
        durationSec,
        coverPhoto,
        facts: facts.filter((f) => f.id !== id),
        removeFactId: id,
      });
    } catch (e) {
      setErr(mapErr(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveMeta() {
    setBusy(true);
    setErr("");
    try {
      await patch({
        action: "save",
        companyName,
        durationSec,
        coverPhoto,
        facts,
      });
      setOkMsg("Настройки сохранены");
    } catch (e) {
      setErr(mapErr(e));
    } finally {
      setBusy(false);
    }
  }

  async function runFact(fact: Fact, mode: "lobby" | "start") {
    setBusy(true);
    setErr("");
    setOkMsg("");
    try {
      await patch({
        action: mode,
        companyName,
        durationSec,
        coverPhoto,
        facts,
        activateFactId: fact.id,
        question: fact.question,
        answer: fact.answer,
      });
      setQuestion(fact.question);
      setAnswer(String(fact.answer));
      dirty.current = false;
    } catch (e) {
      setErr(mapErr(e));
    } finally {
      setBusy(false);
    }
  }

  async function act(action: "finale" | "reset") {
    setBusy(true);
    setErr("");
    try {
      await patch({ action });
      if (action === "reset") {
        setQuestion("");
        setAnswer("");
        dirty.current = false;
      }
    } catch (e) {
      setErr(mapErr(e));
    } finally {
      setBusy(false);
    }
  }

  async function onPhoto(file: File | null) {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setCoverPhoto(dataUrl);
      markDirty();
    } catch {
      setErr("Не удалось обработать фото");
    }
  }

  const phase: Phase = state?.phase || "setup";
  const setupOpen = phase === "setup" || phase === "lobby";

  if (!token) {
    return (
      <div className="shell">
        <div className="atmosphere" aria-hidden />
        <main className="main panel stack">
          <h1 className="display display-md">Ведущий</h1>
          <p className="error">Токен ведущего не найден на этом устройстве. Создайте раунд с главной.</p>
          <Link className="btn btn-gold" href="/">
            На главную
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="atmosphere" aria-hidden />
      <div className="garland" />
      <Snow count={14} />
      <main className="main stack host-main">
        <header className="host-top reveal">
          <div>
            <p className="eyebrow">Ведущий · код {code}</p>
            <h1 className="display display-md">{companyName || "Угадай цифру"}</h1>
          </div>
          <div className="row">
            <a className="btn btn-ice" href={screenUrl || "#"} target="_blank" rel="noreferrer">
              Экран зала
            </a>
            <Link className="btn btn-ghost" href="/">
              Выход
            </Link>
          </div>
        </header>

        {setupOpen && (
          <section className="panel stack reveal" style={{ animationDelay: "0.05s" }}>
            <h2 className="display display-sm accent-gold">Банк фактов</h2>
            <p className="muted" style={{ margin: 0 }}>
              Соберите вопросы до шоу. Каждый факт: вопрос + правильное число. Потом запускайте по одному.
            </p>

            <div className="field">
              <label>Компания / ивент</label>
              <input
                value={companyName}
                onChange={(e) => {
                  markDirty();
                  setCompanyName(e.target.value);
                }}
                placeholder="Снежный CORP"
              />
            </div>

            <div className="fact-compose">
              <div className="field" style={{ flex: 2, minWidth: 180 }}>
                <label>Новый факт — вопрос</label>
                <textarea
                  rows={2}
                  value={question}
                  onChange={(e) => {
                    markDirty();
                    setQuestion(e.target.value);
                  }}
                  placeholder="Сколько ёлок в офисе?"
                />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 120 }}>
                <label>Ответ</label>
                <input
                  inputMode="numeric"
                  value={answer}
                  onChange={(e) => {
                    markDirty();
                    setAnswer(e.target.value.replace(/[^\d-]/g, ""));
                  }}
                  placeholder="12"
                />
              </div>
            </div>
            <div className="row">
              <button className="btn btn-gold" disabled={busy} type="button" onClick={() => void addFact()}>
                В банк
              </button>
              <div className="field" style={{ width: 120 }}>
                <label>Таймер, сек</label>
                <input
                  type="number"
                  min={10}
                  max={180}
                  value={durationSec}
                  onChange={(e) => {
                    markDirty();
                    setDurationSec(Number(e.target.value) || 45);
                  }}
                />
              </div>
              <button className="btn btn-ghost" disabled={busy} type="button" onClick={() => void saveMeta()}>
                Сохранить настройки
              </button>
            </div>

            <div className="field">
              <label>Массовый ввод (вопрос | число)</label>
              <textarea
                rows={3}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={"Сколько ёлок в офисе? | 12\nДней до отпуска у CEO | 18"}
              />
            </div>
            <button className="btn btn-ice" disabled={busy} type="button" onClick={() => void importPaste()}>
              Загрузить список
            </button>

            <div className="field">
              <label>Обложка / фото приза</label>
              <input type="file" accept="image/*" onChange={(e) => void onPhoto(e.target.files?.[0] || null)} />
              {coverPhoto && <img className="cover" src={coverPhoto} alt="Обложка" />}
            </div>

            {facts.length === 0 ? (
              <p className="error" style={{ margin: 0 }}>
                Банк пуст — добавьте хотя бы один факт, иначе раунд без вопроса.
              </p>
            ) : (
              <ul className="fact-list">
                {facts.map((f, i) => (
                  <li key={f.id} className="fact-row" style={{ animationDelay: `${0.04 * i}s` }}>
                    <div>
                      <strong>{f.question}</strong>
                      <span className="fact-answer">{f.answer}</span>
                    </div>
                    <div className="row">
                      <button
                        className="btn btn-ghost"
                        disabled={busy}
                        type="button"
                        onClick={() => void runFact(f, "lobby")}
                      >
                        В лобби
                      </button>
                      <button
                        className="btn btn-gold"
                        disabled={busy}
                        type="button"
                        onClick={() => void runFact(f, "start")}
                      >
                        Старт
                      </button>
                      <button
                        className="btn btn-ghost"
                        disabled={busy}
                        type="button"
                        onClick={() => void removeFact(f.id)}
                      >
                        Удалить
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {guestUrl && (
          <section className="panel qr-panel reveal" style={{ animationDelay: "0.1s" }}>
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
          </section>
        )}

        {(phase === "guessing" || phase === "lobby" || phase === "finale") && state && (
          <section className="panel stack reveal" style={{ animationDelay: "0.12s" }}>
            <div className="screen-meta">
              <div>
                <p className="eyebrow">
                  Фаза: {phase} · ответов: {state.guessCount} · фактов в банке: {facts.length}
                </p>
                <h2 className="display screen-q">{state.question || "— нет активного факта —"}</h2>
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
              {phase === "lobby" && state.question && state.answer != null && (
                <button
                  className="btn btn-gold"
                  disabled={busy}
                  onClick={() => {
                    void (async () => {
                      setBusy(true);
                      setErr("");
                      try {
                        await patch({
                          action: "start",
                          companyName,
                          durationSec,
                          coverPhoto,
                          facts,
                          question: state.question,
                          answer: state.answer,
                        });
                      } catch (e) {
                        setErr(mapErr(e));
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  Запустить таймер
                </button>
              )}
              {phase === "guessing" && (
                <button className="btn btn-gold" disabled={busy} onClick={() => void act("finale")}>
                  Финал сейчас
                </button>
              )}
              <button className="btn btn-ghost" disabled={busy} onClick={() => void act("reset")}>
                Новый раунд
              </button>
            </div>
          </section>
        )}

        {okMsg && <p className="ok">{okMsg}</p>}
        {err && <p className="error">{err}</p>}
      </main>
      <Footer />
    </div>
  );
}
