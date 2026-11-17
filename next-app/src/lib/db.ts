import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

type GlobalDb = {
  pool?: pg.Pool;
  local?: Promise<PGlite>;
};

const g = globalThis as typeof globalThis & { __guessDigitDb?: GlobalDb };
g.__guessDigitDb ??= {};

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (databaseUrl !== "") {
    g.__guessDigitDb!.pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    return (await g.__guessDigitDb!.pool.query(text, params)).rows as T[];
  }
  g.__guessDigitDb!.local ??= startLocal().catch((error: unknown) => {
    g.__guessDigitDb!.local = undefined;
    throw error;
  });
  return (await (await g.__guessDigitDb!.local).query<T>(text, params)).rows;
}

async function startLocal(): Promise<PGlite> {
  const db = new PGlite();
  const files = (await readdir("migrations").catch(() => []))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(await readFile(`migrations/${file}`, "utf8"));
  }
  return db;
}
