"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Footer } from "@/components/Footer";
import { Snow } from "@/components/Snow";
import { api } from "@/lib/client";

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function createHost() {
    setBusy(true);
    setErr("");
    try {
      const data = await api<{
        code: string;
        hostToken: string;
        screenToken: string;
        guestKey: string;
      }>("/api/events", { method: "POST" });
      sessionStorage.setItem(`guess-digit-host:${data.code}`, data.hostToken);
      sessionStorage.setItem(`guess-digit-screen:${data.code}`, data.screenToken);
      sessionStorage.setItem(`guess-digit-guestkey:${data.code}`, data.guestKey);
      router.push(`/host/${data.code}`);
    } catch {
      setErr("Не удалось создать раунд. Попробуйте ещё раз.");
      setBusy(false);
    }
  }

  function joinGuest(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      setErr("Введите код из 4 символов");
      return;
    }
    router.push(`/g/${c}`);
  }

  return (
    <div className="shell">
      <div className="atmosphere" aria-hidden />
      <div className="garland" />
      <Snow />
      <main className="main">
        <div className="hero-home">
          <div className="hero-digit" aria-hidden>
            ?
          </div>
          <div className="hero-copy reveal">
            <img className="hero-mark" src="/brand/logo.png" alt="St. Shmidt" width={88} height={88} />
            <h1 className="display display-xl">Угадай цифру</h1>
            <p className="muted" style={{ fontSize: "1.15rem", maxWidth: 440, margin: 0 }}>
              Новогодний зал против загадки ведущего. Ближайший к ответу — чемпион вечера.
            </p>
            <div className="row" style={{ marginTop: "0.35rem" }}>
              <button className="btn btn-gold" disabled={busy} onClick={createHost}>
                {busy ? "Создаём…" : "Ведущий: создать раунд"}
              </button>
            </div>
            <form className="panel stack hero-join reveal" onSubmit={joinGuest} style={{ animationDelay: "0.12s" }}>
              <div className="field">
                <label htmlFor="code">Гость: код раунда</label>
                <input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="AB12"
                  maxLength={6}
                  autoCapitalize="characters"
                />
              </div>
              <button className="btn btn-ice" type="submit">
                Войти с телефона
              </button>
              {err && <p className="error">{err}</p>}
            </form>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
