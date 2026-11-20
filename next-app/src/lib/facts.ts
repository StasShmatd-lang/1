import { randomToken } from "./tokens";
import type { Fact } from "./types";

function intInRange(n: unknown, min: number, max: number): number | null {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || !Number.isInteger(v)) return null;
  if (v < min || v > max) return null;
  return v;
}

export function parseFacts(raw: string | null | undefined): Fact[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: Fact[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const question = typeof r.question === "string" ? r.question.trim().slice(0, 200) : "";
      const answer = intInRange(r.answer, -999999, 9999999);
      const id =
        typeof r.id === "string" && r.id.length >= 4 ? r.id.slice(0, 32) : randomToken(10);
      if (!question || answer == null) continue;
      out.push({ id, question, answer });
    }
    return out.slice(0, 40);
  } catch {
    return [];
  }
}

export function serializeFacts(facts: Fact[]): string {
  return JSON.stringify(
    facts.slice(0, 40).map((f) => ({
      id: f.id,
      question: f.question.slice(0, 200),
      answer: f.answer,
    })),
  );
}

/** Lines: `вопрос | ответ` or `вопрос; ответ` or tab-separated. */
export function parseFactsPaste(text: string): Fact[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: Fact[] = [];
  for (const line of lines) {
    const parts = line.split(/\s*[|;]\s*|\t+/);
    if (parts.length < 2) continue;
    const answerRaw = parts[parts.length - 1]!;
    const question = parts.slice(0, -1).join(" ").trim().slice(0, 200);
    const answer = intInRange(answerRaw.replace(/[^\d-]/g, ""), -999999, 9999999);
    if (!question || answer == null) continue;
    out.push({ id: randomToken(10), question, answer });
  }
  return out.slice(0, 40);
}

export function mergeFacts(existing: Fact[], incoming: Fact[]): Fact[] {
  const map = new Map<string, Fact>();
  for (const f of existing) map.set(f.id, f);
  for (const f of incoming) {
    const dup = [...map.values()].find(
      (x) => x.question.toLowerCase() === f.question.toLowerCase() && x.answer === f.answer,
    );
    if (dup) continue;
    map.set(f.id, f);
  }
  return [...map.values()].slice(0, 40);
}
