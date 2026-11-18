"use client";

import type { PublicGuess } from "@/lib/types";

export function GuessViz({ guesses, mode = "bars" }: { guesses: PublicGuess[]; mode?: "bars" | "cloud" }) {
  if (guesses.length === 0) {
    return <p className="muted">Ждём первые цифры…</p>;
  }

  if (mode === "cloud") {
    return (
      <div className="cloud">
        {guesses.map((g, i) => (
          <div key={`${g.name}-${i}`} className="chip" style={{ animationDelay: `${i * 0.04}s` }}>
            {g.name}
            <strong>{g.value}</strong>
          </div>
        ))}
      </div>
    );
  }

  const counts = new Map<number, number>();
  for (const g of guesses) counts.set(g.value, (counts.get(g.value) || 0) + 1);
  const entries = [...counts.entries()].sort((a, b) => a[0] - b[0]);
  const max = Math.max(...entries.map(([, c]) => c), 1);

  return (
    <div className="hist">
      {entries.map(([value, count], i) => (
        <div
          key={value}
          className="hist-bar"
          style={{
            height: `${Math.max(12, (count / max) * 160)}px`,
            animationDelay: `${i * 0.05}s`,
            background:
              i % 3 === 0
                ? "linear-gradient(180deg, #7de8ff, #c8f542)"
                : i % 3 === 1
                  ? "linear-gradient(180deg, #ffd76a, #ff6b5a)"
                  : "linear-gradient(180deg, #c8f542, #7de8ff)",
          }}
          title={`${value}: ${count}`}
        >
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}
