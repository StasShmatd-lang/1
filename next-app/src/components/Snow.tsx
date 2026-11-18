"use client";

export function Snow({ count = 28 }: { count?: number }) {
  const flakes = Array.from({ length: count }, (_, i) => {
    const left = (i * 37) % 100;
    const delay = ((i * 13) % 80) / 10;
    const dur = 8 + ((i * 7) % 10);
    const size = 3 + (i % 5);
    return { left, delay, dur, size };
  });
  return (
    <div className="snow" aria-hidden>
      {flakes.map((f, i) => (
        <span
          key={i}
          style={{
            left: `${f.left}%`,
            width: f.size,
            height: f.size,
            animationDelay: `${f.delay}s`,
            animationDuration: `${f.dur}s`,
            opacity: 0.35 + (i % 5) * 0.08,
          }}
        />
      ))}
    </div>
  );
}
