import { sql } from "./db";
import { parseFacts } from "./facts";
import { randomToken, shortCode } from "./tokens";
import type { EventPublic, EventRow, GuessRow, Phase, RankedGuess } from "./types";

const MAX_EVENTS = 120;
const MAX_PHOTO = 450_000;

export async function createEvent(): Promise<EventRow> {
  const [{ c } = { c: 0 }] = await sql<{ c: number }>("select count(*)::int as c from events");
  if (c >= MAX_EVENTS) {
    throw new Error("LIMIT");
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const id = randomToken(16);
    const code = shortCode();
    const host_token = randomToken(24);
    const screen_token = randomToken(24);
    const guest_key = randomToken(16);
    try {
      const rows = await sql<EventRow>(
        `insert into events (id, code, host_token, screen_token, guest_key)
         values ($1,$2,$3,$4,$5)
         returning *`,
        [id, code, host_token, screen_token, guest_key],
      );
      return rows[0]!;
    } catch {
      /* retry on code collision */
    }
  }
  throw new Error("CREATE_FAILED");
}

export async function getByCode(code: string): Promise<EventRow | null> {
  const rows = await sql<EventRow>("select * from events where code = $1", [
    code.toUpperCase().trim(),
  ]);
  return rows[0] ?? null;
}

export async function getById(id: string): Promise<EventRow | null> {
  const rows = await sql<EventRow>("select * from events where id = $1", [id]);
  return rows[0] ?? null;
}

export async function listGuesses(eventId: string): Promise<GuessRow[]> {
  return sql<GuessRow>(
    "select * from guesses where event_id = $1 order by created_at asc",
    [eventId],
  );
}

function secondsLeft(endsAt: string | null): number | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 1000));
}

export function rankTop3(guesses: GuessRow[], answer: number): RankedGuess[] {
  const ranked = [...guesses]
    .map((g) => ({
      name: g.name,
      value: g.value,
      distance: Math.abs(g.value - answer),
    }))
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name, "ru"));
  return ranked.slice(0, 3).map((g, i) => ({ ...g, place: i + 1 }));
}

export async function maybeAutoFinale(ev: EventRow): Promise<EventRow> {
  if (ev.phase !== "guessing" || !ev.timer_ends_at) return ev;
  if (new Date(ev.timer_ends_at).getTime() > Date.now()) return ev;
  const rows = await sql<EventRow>(
    `update events set phase = 'finale' where id = $1 and phase = 'guessing' returning *`,
    [ev.id],
  );
  return rows[0] ?? ev;
}

export async function toPublic(
  ev: EventRow,
  opts: { revealAnswer: boolean },
): Promise<EventPublic> {
  const live = await maybeAutoFinale(ev);
  const guesses = await listGuesses(live.id);
  const isFinale = live.phase === "finale";
  const answer = live.answer;
  return {
    code: live.code,
    companyName: live.company_name,
    question: live.question,
    coverPhoto: live.cover_photo,
    durationSec: live.duration_sec,
    phase: live.phase as Phase,
    timerEndsAt: live.timer_ends_at,
    guessCount: guesses.length,
    secondsLeft: secondsLeft(live.timer_ends_at),
    guesses: guesses.map((g) => ({ name: g.name, value: g.value })),
    top3: isFinale && answer != null ? rankTop3(guesses, answer) : null,
    answer: opts.revealAnswer && isFinale ? answer : null,
    facts: opts.revealAnswer ? parseFacts(live.facts_json ?? "[]") : [],
  };
}

export function sanitizePhoto(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") throw new Error("PHOTO");
  if (!raw.startsWith("data:image/")) throw new Error("PHOTO");
  if (raw.length > MAX_PHOTO) throw new Error("PHOTO_BIG");
  return raw;
}

export function clampInt(n: unknown, min: number, max: number): number | null {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || !Number.isInteger(v)) return null;
  if (v < min || v > max) return null;
  return v;
}
