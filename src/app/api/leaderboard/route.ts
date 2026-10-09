import { createHash } from "node:crypto";
import { StatsSchema, type Entry } from "@/lib/ranking";
import { redis } from "@/lib/redis";

/**
 * Rangliste in Upstash Redis: ein Hash "leaderboard" mit öffentlicher id → JSON-Eintrag.
 * Lesen = 1 Befehl (HGETALL), Melden = 1 Befehl (Skript), Austreten = 1 Befehl (HDEL).
 * Der geheime Schlüssel kommt im Header x-lb-key; gespeichert wird nur sein Hash als öffentliche id,
 * deshalb kann niemand fremde Einträge ändern.
 */

const KEY = "leaderboard";
const MAX_ENTRIES = 300;
const noStore = { "cache-control": "no-store" };

const isSecret = (s: string) => /^[A-Za-z0-9_-]{22}$/.test(s);
const publicId = (secret: string) => createHash("sha256").update(`lb:${secret}`).digest("hex").slice(0, 16);

/** Ersetzt ggf. den alten Eintrag (Profil von einem anderen Gerät übernommen), begrenzt die Anzahl. */
const UPSERT = `
if ARGV[3] ~= '' and ARGV[3] ~= ARGV[1] then redis.call('HDEL', KEYS[1], ARGV[3]) end
if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 0 and redis.call('HLEN', KEYS[1]) >= tonumber(ARGV[4]) then return -1 end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
return 1
`;

const unavailable = () => Response.json({ error: "not-configured" }, { status: 503, headers: noStore });

function secretOf(req: Request): string | null {
  const s = req.headers.get("x-lb-key") ?? "";
  return isSecret(s) ? s : null;
}

export async function GET(req: Request) {
  if (!redis) return unavailable();
  // ohne automatische Deserialisierung liefert HGETALL eine flache Liste [id, json, id, json, …]
  const raw = (await redis.hgetall(KEY)) as unknown as string[] | Record<string, string> | null;
  const pairs: [string, string][] = Array.isArray(raw)
    ? Array.from({ length: raw.length / 2 }, (_, i) => [raw[2 * i], raw[2 * i + 1]])
    : Object.entries(raw ?? {});
  const entries: Entry[] = [];
  for (const [id, json] of pairs) {
    try {
      entries.push({ ...(JSON.parse(json) as Omit<Entry, "id">), id });
    } catch {}
  }
  const secret = secretOf(req);
  return Response.json({ entries, me: secret ? publicId(secret) : null }, { headers: noStore });
}

export async function PUT(req: Request) {
  if (!redis) return unavailable();
  const secret = secretOf(req);
  if (!secret) return Response.json({ error: "invalid-key" }, { status: 400, headers: noStore });

  let body: unknown;
  try {
    body = JSON.parse((await req.text()).slice(0, 4000));
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400, headers: noStore });
  }
  const stats = StatsSchema.safeParse(body);
  if (!stats.success) return Response.json({ error: "invalid-data" }, { status: 400, headers: noStore });
  const replaces = (body as { replaces?: unknown }).replaces;

  const id = publicId(secret);
  const n = await redis.eval<[string, string, string, string], number>(UPSERT, [KEY], [
    id,
    JSON.stringify({ ...stats.data, at: Date.now() }),
    typeof replaces === "string" && isSecret(replaces) ? publicId(replaces) : "",
    String(MAX_ENTRIES),
  ]);
  if (n === -1) return Response.json({ error: "full" }, { status: 409, headers: noStore });
  return Response.json({ id }, { headers: noStore });
}

export async function DELETE(req: Request) {
  if (!redis) return unavailable();
  const secret = secretOf(req);
  if (!secret) return Response.json({ error: "invalid-key" }, { status: 400, headers: noStore });
  await redis.hdel(KEY, publicId(secret));
  return new Response(null, { status: 204, headers: noStore });
}
