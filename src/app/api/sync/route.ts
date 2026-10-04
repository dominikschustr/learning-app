import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

/**
 * Geräteübergreifende Synchronisation des Lernstands.
 * Der Sync-Schlüssel ist das Geheimnis (32 zufällige Bytes, base64url) und kommt im Header x-sync-key.
 * Gespeichert wird in Upstash Redis (Free-Plan, 500.000 Befehle/Monat) unter dem SHA-256 des Schlüssels,
 * als Hash { v: Versionsnummer, d: JSON-Stand }. Pro Synchronisation fallen 1–2 Befehle an.
 * Schreiben ist bedingt (Version als ETag), damit zwei Geräte sich nicht gegenseitig überschreiben:
 * bei 409 holt der Client den neuen Stand, führt zusammen und versucht es erneut.
 */

const MAX_BYTES = 1_000_000;
const noStore = { "cache-control": "no-store" };

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token, automaticDeserialization: false }) : null;

/** Schreibt nur, wenn die Version noch der erwarteten entspricht ("" = Eintrag darf noch nicht existieren). */
const COMPARE_AND_SET = `
local v = redis.call('HGET', KEYS[1], 'v')
if (ARGV[1] == '' and v) or (ARGV[1] ~= '' and v ~= ARGV[1]) then return -1 end
local n = (tonumber(v) or 0) + 1
redis.call('HSET', KEYS[1], 'v', n, 'd', ARGV[2])
return n
`;

function guard(req: Request): { db: Redis; key: string } | Response {
  if (!redis) return Response.json({ error: "not-configured" }, { status: 503, headers: noStore });
  const secret = req.headers.get("x-sync-key") ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) {
    return Response.json({ error: "invalid-key" }, { status: 400, headers: noStore });
  }
  return { db: redis, key: `sync:${createHash("sha256").update(secret).digest("hex")}` };
}

export async function GET(req: Request) {
  const g = guard(req);
  if (g instanceof Response) return g;
  const r = await g.db.hmget<Record<string, string | null>>(g.key, "v", "d");
  if (!r?.v || !r?.d) return Response.json({ data: null, etag: null }, { headers: noStore });
  return Response.json({ data: JSON.parse(r.d), etag: String(r.v) }, { headers: noStore });
}

export async function PUT(req: Request) {
  const g = guard(req);
  if (g instanceof Response) return g;

  const body = await req.text();
  if (body.length > MAX_BYTES) return Response.json({ error: "too-large" }, { status: 413, headers: noStore });
  let parsed: { data?: unknown; etag?: string | null };
  try {
    parsed = JSON.parse(body);
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400, headers: noStore });
  }
  if (!parsed.data || typeof parsed.data !== "object") {
    return Response.json({ error: "invalid-data" }, { status: 400, headers: noStore });
  }

  const n = await g.db.eval<[string, string], number>(COMPARE_AND_SET, [g.key], [
    parsed.etag ?? "",
    JSON.stringify(parsed.data),
  ]);
  if (n === -1) return Response.json({ error: "conflict" }, { status: 409, headers: noStore });
  return Response.json({ etag: String(n) }, { headers: noStore });
}

export async function DELETE(req: Request) {
  const g = guard(req);
  if (g instanceof Response) return g;
  await g.db.del(g.key);
  return new Response(null, { status: 204, headers: noStore });
}
