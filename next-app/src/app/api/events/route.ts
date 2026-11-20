import { NextResponse } from "next/server";
import { createEvent } from "@/lib/events";

const hits = new Map<string, { n: number; t: number }>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const row = hits.get(ip);
  if (!row || now - row.t > 60_000) {
    hits.set(ip, { n: 1, t: now });
    return true;
  }
  if (row.n >= 3) return false;
  row.n += 1;
  return true;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: "rate_limit" }, { status: 429 });
  }
  try {
    const ev = await createEvent();
    return NextResponse.json({
      code: ev.code,
      hostToken: ev.host_token,
      screenToken: ev.screen_token,
      guestKey: ev.guest_key,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "LIMIT") {
      return NextResponse.json({ error: "capacity" }, { status: 503 });
    }
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
