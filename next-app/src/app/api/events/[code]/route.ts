import { NextResponse } from "next/server";
import {
  clampInt,
  getByCode,
  sanitizePhoto,
  toPublic,
} from "@/lib/events";
import { sql } from "@/lib/db";
import { bearer } from "@/lib/tokens";
import type { EventRow } from "@/lib/types";

type Ctx = { params: Promise<{ code: string }> };

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
  return NextResponse.json({
    role,
    ...pub,
    ...(role === "host"
      ? { guestKey: ev.guest_key, screenToken: ev.screen_token, answer: ev.answer }
      : {}),
  });
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

  if (action === "save") {
    const company =
      typeof body.companyName === "string" ? body.companyName.trim().slice(0, 80) : ev.company_name;
    const question =
      typeof body.question === "string" ? body.question.trim().slice(0, 200) : ev.question;
    const answer = body.answer !== undefined ? clampInt(body.answer, -999999, 9999999) : ev.answer;
    if (body.answer !== undefined && answer == null) {
      return NextResponse.json({ error: "bad_answer" }, { status: 400 });
    }
    const duration =
      body.durationSec !== undefined
        ? clampInt(body.durationSec, 10, 180)
        : ev.duration_sec;
    if (body.durationSec !== undefined && duration == null) {
      return NextResponse.json({ error: "bad_duration" }, { status: 400 });
    }
    let cover = ev.cover_photo;
    if ("coverPhoto" in body) {
      try {
        cover = sanitizePhoto(body.coverPhoto);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        return NextResponse.json(
          { error: msg === "PHOTO_BIG" ? "photo_too_big" : "bad_photo" },
          { status: 400 },
        );
      }
    }
    const rows = await sql<EventRow>(
      `update events set company_name=$2, question=$3, answer=$4, duration_sec=$5, cover_photo=$6
       where id=$1 returning *`,
      [ev.id, company, question, answer, duration, cover],
    );
    const pub = await toPublic(rows[0]!, { revealAnswer: true });
    return NextResponse.json({
      role: "host",
      ...pub,
      guestKey: rows[0]!.guest_key,
      screenToken: rows[0]!.screen_token,
      answer: rows[0]!.answer,
    });
  }

  if (action === "lobby") {
    if (!ev.question.trim() || ev.answer == null) {
      return NextResponse.json({ error: "incomplete" }, { status: 400 });
    }
    const rows = await sql<EventRow>(
      `update events set phase='lobby', timer_ends_at=null where id=$1 returning *`,
      [ev.id],
    );
    const pub = await toPublic(rows[0]!, { revealAnswer: true });
    return NextResponse.json({ role: "host", ...pub, answer: rows[0]!.answer });
  }

  if (action === "start") {
    if (!ev.question.trim() || ev.answer == null) {
      return NextResponse.json({ error: "incomplete" }, { status: 400 });
    }
    const ends = new Date(Date.now() + ev.duration_sec * 1000).toISOString();
    const rows = await sql<EventRow>(
      `update events set phase='guessing', timer_ends_at=$2 where id=$1 returning *`,
      [ev.id, ends],
    );
    const pub = await toPublic(rows[0]!, { revealAnswer: true });
    return NextResponse.json({ role: "host", ...pub, answer: rows[0]!.answer });
  }

  if (action === "finale") {
    const rows = await sql<EventRow>(
      `update events set phase='finale' where id=$1 returning *`,
      [ev.id],
    );
    const pub = await toPublic(rows[0]!, { revealAnswer: true });
    return NextResponse.json({ role: "host", ...pub, answer: rows[0]!.answer });
  }

  if (action === "reset") {
    await sql(`delete from guesses where event_id=$1`, [ev.id]);
    const rows = await sql<EventRow>(
      `update events set phase='setup', timer_ends_at=null where id=$1 returning *`,
      [ev.id],
    );
    const pub = await toPublic(rows[0]!, { revealAnswer: true });
    return NextResponse.json({
      role: "host",
      ...pub,
      guestKey: rows[0]!.guest_key,
      screenToken: rows[0]!.screen_token,
      answer: rows[0]!.answer,
    });
  }

  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}

export async function POST(req: Request, ctx: Ctx) {
  // guest guess: POST /api/events/[code] with action guess — kept on same route
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
  // Party MVP: 4-char code is enough; if guestKey is sent it must match.
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

  const { randomToken } = await import("@/lib/tokens");
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
