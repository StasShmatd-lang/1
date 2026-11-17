"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Footer } from "@/components/Footer";
import { Snow } from "@/components/Snow";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <div className="shell">
      <Snow />
      <main className="main">
        <form
          className="panel stack"
          style={{ maxWidth: 420 }}
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/g/${code.trim().toUpperCase()}`);
          }}
        >
          <h1 className="display" style={{ fontSize: "2.8rem" }}>
            Войти
          </h1>
          <div className="field">
            <label>Код</label>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} />
          </div>
          <button className="btn btn-coral" type="submit">
            Далее
          </button>
        </form>
      </main>
      <Footer />
    </div>
  );
}
