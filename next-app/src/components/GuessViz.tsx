"use client";

import type { PublicGuess } from "@/lib/types";

export function GuessViz({
  guesses,
  mode = "bars",
  hall = false,
}: {
  guesses: PublicGuess[];
  mode?: "bars" | "cloud";
  hall?: boolean;
}) {
  if (guesses.length === 0) {
    return (
      <p className="muted" style={{ fontSize: hall ? "1.35rem" : undefined }}>
        Ждём первые цифры…
      </p>
    );
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
  const maxH = hall ? 280 : 160;

  return (
    <div className="hist" style={hall ? { minHeight: 300 } : undefined}>
      {entries.map(([value, count], i) => (
        <div
          key={value}
          className="hist-bar"
          style={{
            height: `${Math.max(16, (count / max) * maxH)}px`,
            animationDelay: `${i * 0.05}s`,
            background:
              i % 3 === 0
                ? "linear-gradient(180deg, #9fd6e8, #e4c57a)"
                : i % 3 === 1
                  ? "linear-gradient(180deg, #e4c57a, #3ecf9a)"
                  : "linear-gradient(180deg, #f0d9a0, #9fd6e8)",
          }}
          title={`${value}: ${count}`}
        >
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}
