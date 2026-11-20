"use client";

import type { RankedGuess } from "@/lib/types";

export function Podium({
  top3,
  answer,
  hall = false,
}: {
  top3: RankedGuess[];
  answer: number | null;
  hall?: boolean;
}) {
  return (
    <div className="stack">
      {answer != null && (
        <p
          className="display"
          style={{
            fontSize: hall ? "clamp(3rem, 9vw, 6rem)" : "clamp(2rem, 6vw, 3.5rem)",
            color: "var(--frost)",
          }}
        >
          Ответ: <span style={{ color: "var(--gold)" }}>{answer}</span>
        </p>
      )}
      <div className="podium">
        {top3.map((g) => (
          <div key={g.place} className="podium-item" style={{ animationDelay: `${g.place * 0.08}s` }}>
            <div className="place">#{g.place}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: hall ? "1.45rem" : "1.15rem" }}>{g.name}</div>
              <div className="muted" style={{ fontSize: "0.95rem" }}>
                угадал {g.value} · отклонение {g.distance}
              </div>
            </div>
            <div
              className="display"
              style={{ fontSize: hall ? "2.8rem" : "2rem", color: "var(--gold)" }}
            >
              {g.value}
            </div>
          </div>
        ))}
        {top3.length === 0 && <p className="muted">Нет ответов в этом раунде.</p>}
      </div>
    </div>
  );
}
