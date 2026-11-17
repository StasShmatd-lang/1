"use client";

import type { RankedGuess } from "@/lib/types";

export function Podium({
  top3,
  answer,
}: {
  top3: RankedGuess[];
  answer: number | null;
}) {
  return (
    <div className="stack">
      {answer != null && (
        <p className="display" style={{ fontSize: "clamp(2rem, 6vw, 3.5rem)", color: "var(--ice)" }}>
          Ответ: {answer}
        </p>
      )}
      <div className="podium">
        {top3.map((g) => (
          <div key={g.place} className="podium-item" style={{ animationDelay: `${g.place * 0.08}s` }}>
            <div className="place">#{g.place}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.15rem" }}>{g.name}</div>
              <div className="muted" style={{ fontSize: "0.9rem" }}>
                угадал {g.value} · отклонение {g.distance}
              </div>
            </div>
            <div className="display" style={{ fontSize: "2rem", color: "var(--lime)" }}>
              {g.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
