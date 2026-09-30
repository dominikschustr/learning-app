import { createHash } from "node:crypto";
import { BlobPreconditionFailedError, del, get, put } from "@vercel/blob";

/**
 * Geräteübergreifende Synchronisation des Lernstands.
 * Der Sync-Schlüssel ist das Geheimnis (32 zufällige Bytes, base64url) und kommt im Header x-sync-key.
 * Gespeichert wird im privaten Vercel-Blob-Store unter dem SHA-256 des Schlüssels.
 * Schreiben ist bedingt (ETag), damit zwei Geräte sich nicht gegenseitig überschreiben:
 * bei 409 holt der Client den neuen Stand, führt zusammen und versucht es erneut.
 */

const MAX_BYTES = 2_000_000;
const noStore = { "cache-control": "no-store" };

function blobPath(req: Request): string | null {
  const key = req.headers.get("x-sync-key") ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(key)) return null;
  return `sync/${createHash("sha256").update(key).digest("hex")}.json`;
}

function guard(req: Request): string | Response {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: "not-configured" }, { status: 503, headers: noStore });
  }
  return blobPath(req) ?? Response.json({ error: "invalid-key" }, { status: 400, headers: noStore });
}

export async function GET(req: Request) {
  const path = guard(req);
  if (path instanceof Response) return path;
  const res = await get(path, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return Response.json({ data: null, etag: null }, { headers: noStore });
  const data = JSON.parse(await new Response(res.stream).text());
  return Response.json({ data, etag: res.blob.etag }, { headers: noStore });
}

export async function PUT(req: Request) {
  const path = guard(req);
  if (path instanceof Response) return path;

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

  try {
    const blob = await put(path, JSON.stringify(parsed.data), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
      // Mit ETag: nur überschreiben, wenn sich nichts geändert hat. Ohne: nur neu anlegen.
      ...(parsed.etag ? { ifMatch: parsed.etag } : { allowOverwrite: false }),
    });
    return Response.json({ etag: blob.etag }, { headers: noStore });
  } catch (e) {
    if (e instanceof BlobPreconditionFailedError || /already exists/i.test(String((e as Error)?.message))) {
      return Response.json({ error: "conflict" }, { status: 409, headers: noStore });
    }
    throw e;
  }
}

export async function DELETE(req: Request) {
  const path = guard(req);
  if (path instanceof Response) return path;
  await del(path);
  return new Response(null, { status: 204, headers: noStore });
}
