import { NextResponse } from "next/server";
import {
  clampInt,
  getByCode,
  sanitizePhoto,
  toPublic,
} from "@/lib/events";
import { mergeFacts, parseFacts, parseFactsPaste, serializeFacts } from "@/lib/facts";
import { sql } from "@/lib/db";
import { bearer, randomToken } from "@/lib/tokens";
import type { EventRow, Fact } from "@/lib/types";

type Ctx = { params: Promise<{ code: string }> };

function hostPayload(row: EventRow, pub: Awaited<ReturnType<typeof toPublic>>) {
  return {
    role: "host" as const,
    ...pub,
    guestKey: row.guest_key,
    screenToken: row.screen_token,
    answer: row.answer,
    facts: parseFacts(row.facts_json ?? "[]"),
  };
}

function readFactFields(
  body: Record<string, unknown>,
  ev: EventRow,
): { company: string; question: string; answer: number | null; duration: number; cover: string | null; factsJson: string; error?: string } {
  const company =
    typeof body.companyName === "string" ? body.companyName.trim().slice(0, 80) : ev.company_name;

  let facts = parseFacts(ev.facts_json);
  if (Array.isArray(body.facts)) {
    const incoming: Fact[] = [];
    for (const row of body.facts) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const question = typeof r.question === "string" ? r.question.trim().slice(0, 200) : "";
      const answer = clampInt(r.answer, -999999, 9999999);
      if (!question || answer == null) continue;
      incoming.push({
        id: typeof r.id === "string" && r.id.length >= 4 ? r.id.slice(0, 32) : randomToken(10),
        question,
        answer,
      });
    }
    // Full replace when host sends facts array (authoritative bank).
    facts = incoming.slice(0, 40);
  }
  if (typeof body.factsPaste === "string" && body.factsPaste.trim()) {
    facts = mergeFacts(facts, parseFactsPaste(body.factsPaste));
  }
  if (body.addFact && typeof body.addFact === "object") {
    const r = body.addFact as Record<string, unknown>;
    const question = typeof r.question === "string" ? r.question.trim().slice(0, 200) : "";
    const answer = clampInt(r.answer, -999999, 9999999);
    if (!question || answer == null) {
      return {
        company,
        question: ev.question,
        answer: ev.answer,
        duration: ev.duration_sec,
        cover: ev.cover_photo,
        factsJson: serializeFacts(facts),
        error: "bad_fact",
      };
    }
    facts = mergeFacts(facts, [
      {
        id: typeof r.id === "string" && r.id.length >= 4 ? r.id.slice(0, 32) : randomToken(10),
        question,
        answer,
      },
    ]);
  }
  if (typeof body.removeFactId === "string" && body.removeFactId) {
    facts = facts.filter((f) => f.id !== body.removeFactId);
  }

  let question = ev.question;
  let answer = ev.answer;
  if (typeof body.activateFactId === "string" && body.activateFactId) {
    const found = facts.find((f) => f.id === body.activateFactId);
    if (!found) {
      return {
        company,
        question,
        answer,
        duration: ev.duration_sec,
        cover: ev.cover_photo,
        factsJson: serializeFacts(facts),
        error: "fact_not_found",
      };
    }
    question = found.question;
    answer = found.answer;
  }
  if (typeof body.question === "string") {
    question = body.question.trim().slice(0, 200);
  }
  if (body.answer !== undefined) {
    answer = clampInt(body.answer, -999999, 9999999);
    if (answer == null) {
      return {
        company,
        question,
        answer: ev.answer,
        duration: ev.duration_sec,
        cover: ev.cover_photo,
        factsJson: serializeFacts(facts),
        error: "bad_answer",
      };
    }
  }

  // Keep active fact in the bank so a show never loses the question.
  if (question.trim() && answer != null) {
    facts = mergeFacts(facts, [{ id: randomToken(10), question: question.trim(), answer }]);
  }

  const duration =
    body.durationSec !== undefined ? clampInt(body.durationSec, 10, 180) : ev.duration_sec;
  if (body.durationSec !== undefined && duration == null) {
    return {
      company,
      question,
      answer,
      duration: ev.duration_sec,
      cover: ev.cover_photo,
      factsJson: serializeFacts(facts),
      error: "bad_duration",
    };
  }

  let cover = ev.cover_photo;
  if ("coverPhoto" in body) {
    try {
      cover = sanitizePhoto(body.coverPhoto);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      return {
        company,
        question,
        answer,
        duration: duration ?? ev.duration_sec,
        cover: ev.cover_photo,
        factsJson: serializeFacts(facts),
        error: msg === "PHOTO_BIG" ? "photo_too_big" : "bad_photo",
      };
    }
  }

  return {
    company,
    question,
    answer,
    duration: duration ?? ev.duration_sec,
    cover,
    factsJson: serializeFacts(facts),
  };
}

async function persistFields(
  ev: EventRow,
  fields: ReturnType<typeof readFactFields>,
): Promise<EventRow> {
  const rows = await sql<EventRow>(
    `update events set company_name=$2, question=$3, answer=$4, duration_sec=$5, cover_photo=$6, facts_json=$7
     where id=$1 returning *`,
    [ev.id, fields.company, fields.question, fields.answer, fields.duration, fields.cover, fields.factsJson],
  );
  return rows[0]!;
}

export async function GET(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const ev = await getByCode(code);
  if (!ev) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const token = bearer(req);
  const role =
    token && token === ev.host_token
      ? "host"
      : token && token === ev.screen_token
        ? "screen"
        : "guest";

  const pub = await toPublic(ev, { revealAnswer: role === "host" || role === "screen" });
  if (role === "host") return NextResponse.json(hostPayload(ev, pub));
  return NextResponse.json({ role, ...pub });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const ev = await getByCode(code);
  if (!ev) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const token = bearer(req);
  if (!token || token !== ev.host_token) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "save";

  if (action === "save" || action === "lobby" || action === "start") {
    const fields = readFactFields(body, ev);
    if (fields.error) {
      return NextResponse.json({ error: fields.error }, { status: 400 });
    }
    let row = await persistFields(ev, fields);

    if (action === "lobby" || action === "start") {
      if (!row.question.trim() || row.answer == null) {
        return NextResponse.json({ error: "incomplete" }, { status: 400 });
      }
      if (action === "lobby") {
        const rows = await sql<EventRow>(
          `update events set phase='lobby', timer_ends_at=null where id=$1 returning *`,
          [row.id],
        );
        row = rows[0]!;
      } else {
        const ends = new Date(Date.now() + row.duration_sec * 1000).toISOString();
        const rows = await sql<EventRow>(
          `update events set phase='guessing', timer_ends_at=$2 where id=$1 returning *`,
          [row.id, ends],
        );
        row = rows[0]!;
      }
    }

    const pub = await toPublic(row, { revealAnswer: true });
    return NextResponse.json(hostPayload(row, pub));
  }

  if (action === "finale") {
    const rows = await sql<EventRow>(
      `update events set phase='finale' where id=$1 returning *`,
      [ev.id],
    );
    const pub = await toPublic(rows[0]!, { revealAnswer: true });
    return NextResponse.json(hostPayload(rows[0]!, pub));
  }

  if (action === "reset") {
    await sql(`delete from guesses where event_id=$1`, [ev.id]);
    const rows = await sql<EventRow>(
      `update events set phase='setup', timer_ends_at=null, question='', answer=null where id=$1 returning *`,
      [ev.id],
    );
    // Keep facts_json bank for the next round of the show.
    const pub = await toPublic(rows[0]!, { revealAnswer: true });
    return NextResponse.json(hostPayload(rows[0]!, pub));
  }

  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}

export async function POST(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const ev = await getByCode(code);
  if (!ev) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  if (body.action !== "guess") {
    return NextResponse.json({ error: "bad_action" }, { status: 400 });
  }

  const guestKey = typeof body.guestKey === "string" ? body.guestKey : "";
  if (guestKey && guestKey !== ev.guest_key) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const live = await toPublic(ev, { revealAnswer: false });
  if (live.phase !== "lobby" && live.phase !== "guessing") {
    return NextResponse.json({ error: "closed" }, { status: 409 });
  }
  if (live.phase === "guessing" && live.secondsLeft === 0) {
    return NextResponse.json({ error: "time_up" }, { status: 409 });
  }
  if (!ev.question.trim() || ev.answer == null) {
    return NextResponse.json({ error: "no_fact" }, { status: 409 });
  }

  const name =
    typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
  if (name.length < 1) {
    return NextResponse.json({ error: "bad_name" }, { status: 400 });
  }
  const value = clampInt(body.value, -999999, 9999999);
  if (value == null) {
    return NextResponse.json({ error: "bad_value" }, { status: 400 });
  }

  const guestToken =
    typeof body.guestToken === "string" && body.guestToken.length >= 8
      ? body.guestToken.slice(0, 64)
      : null;
  if (!guestToken) {
    return NextResponse.json({ error: "bad_guest_token" }, { status: 400 });
  }

  const id = randomToken(12);
  await sql(
    `insert into guesses (id, event_id, guest_token, name, value)
     values ($1,$2,$3,$4,$5)
     on conflict (event_id, guest_token) do update set name=excluded.name, value=excluded.value`,
    [id, ev.id, guestToken, name, value],
  );

  const pub = await toPublic(ev, { revealAnswer: false });
  return NextResponse.json({ ok: true, ...pub });
}
