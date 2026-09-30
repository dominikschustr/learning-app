"use client";

import { Check, Cloud, CloudOff, Copy, Link2, Loader2, RefreshCw, Smartphone, Unplug } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { connectSync, disconnectSync, enableSync, isValidKey, pairingLink, syncNow, useSync } from "@/lib/sync";
import { useNow } from "@/lib/useNow";
import { cn } from "@/lib/utils";
import { Button } from "./ui";

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

/** Sync-Schlüssel aus einem Kopplungslink (#sync=…) in der Adresszeile. */
function useHashKey(): string | null {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const m = hash.match(/sync=([A-Za-z0-9_-]{43})/);
  return m ? m[1] : null;
}

function clearHash() {
  history.replaceState(null, "", window.location.pathname + window.location.search);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function extractKey(input: string): string | null {
  const t = input.trim();
  const m = t.match(/sync=([A-Za-z0-9_-]{43})/);
  if (m) return m[1];
  return isValidKey(t) ? t : null;
}

export function SyncStatusLine() {
  const { status, lastSync, error } = useSync();
  const now = useNow();
  const ago = lastSync && now ? Math.max(0, Math.round((now - lastSync) / 60000)) : null;

  const map = {
    off: { icon: CloudOff, text: "Aus", cls: "text-muted" },
    idle: {
      icon: Cloud,
      text: ago === null ? "Verbunden" : ago < 1 ? "Gerade synchronisiert" : `Synchronisiert vor ${ago} Min`,
      cls: "text-good",
    },
    syncing: { icon: Loader2, text: "Synchronisiere …", cls: "text-accent" },
    offline: { icon: CloudOff, text: "Offline – wird nachgeholt", cls: "text-warn" },
    error: { icon: CloudOff, text: error ?? "Fehler", cls: "text-bad" },
    unavailable: { icon: CloudOff, text: error ?? "Nicht verfügbar", cls: "text-bad" },
  }[status];

  return (
    <p className={cn("flex items-center gap-2 text-sm font-medium", map.cls)}>
      <map.icon className={cn("size-4 shrink-0", status === "syncing" && "animate-spin")} /> {map.text}
    </p>
  );
}

export function SyncSettings() {
  const key = useSync((s) => s.key);
  const hashKey = useHashKey();
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="sync" className="card scroll-mt-20 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Geräte synchronisieren</h2>
          <p className="text-sm text-muted">
            Level, XP, Streak, Achievements, Tests und der Lernstand jeder Frage – auf Laptop und Handy gleich. Ohne
            Login: die Geräte werden über einen geheimen Link gekoppelt.
          </p>
        </div>
        {key && <SyncStatusLine />}
      </div>

      {hashKey && hashKey !== key && (
        <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <p className="flex items-center gap-2 font-semibold">
            <Link2 className="size-4 text-accent" /> Kopplungslink erkannt
          </p>
          <p className="mt-1 text-sm text-ink-2">
            Dieses Gerät mit deinem synchronisierten Lernstand verbinden? Was du hier schon gelernt hast, wird
            zusammengeführt – es geht nichts verloren.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await connectSync(hashKey);
                  clearHash();
                  setMsg("Verbunden – dein Lernstand ist jetzt auf beiden Geräten.");
                })
              }
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Verbinden
            </Button>
            <Button variant="ghost" onClick={clearHash}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {hashKey && hashKey !== key ? null : !key ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-line p-4">
            <p className="font-semibold">Erstes Gerät</p>
            <p className="mt-1 text-sm text-muted">Synchronisation starten und deinen aktuellen Stand hochladen.</p>
            <Button className="mt-3" disabled={busy} onClick={() => run(enableSync)}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Cloud className="size-4" />} Aktivieren
            </Button>
          </div>
          <div className="rounded-2xl border border-line p-4">
            <p className="font-semibold">Weiteres Gerät</p>
            <p className="mt-1 text-sm text-muted">
              QR-Code des anderen Geräts scannen – oder den Kopplungslink hier einfügen.
            </p>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const k = extractKey(input);
                if (!k) return setMsg("Das ist kein gültiger Kopplungslink.");
                void run(() => connectSync(k)).then(() => setInput(""));
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Link einfügen"
                className="h-11 min-w-0 flex-1 rounded-full border border-line-strong bg-surface px-4 text-sm outline-none focus:border-accent"
              />
              <Button type="submit" variant="secondary" disabled={busy || !input.trim()}>
                Koppeln
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <Connected syncKey={key} busy={busy} run={run} />
      )}

      {msg && <p className="mt-4 text-sm text-ink-2">{msg}</p>}
    </section>
  );
}

function Connected({
  syncKey,
  busy,
  run,
}: {
  syncKey: string;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const link = pairingLink(syncKey);

  useEffect(() => {
    let alive = true;
    void import("qrcode").then((QR) =>
      QR.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1b1915", light: "#ffffff" } }).then(
        (s) => alive && setSvg(s),
      ),
    );
    return () => {
      alive = false;
    };
  }, [link]);

  return (
    <div className="mt-5 grid gap-6 sm:grid-cols-[auto_1fr]">
      <div className="mx-auto w-48 rounded-2xl border border-line bg-white p-3 sm:mx-0">
        {svg ? (
          <div className="aspect-square [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="aspect-square animate-pulse rounded-lg bg-surface-2" />
        )}
      </div>
      <div className="flex flex-col justify-center">
        <p className="flex items-center gap-2 font-semibold">
          <Smartphone className="size-4" /> Handy koppeln
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-2">
          <li>QR-Code mit der Handy-Kamera scannen.</li>
          <li>Auf der geöffneten Seite „Verbinden“ tippen.</li>
          <li>Fertig – ab jetzt gleicht sich alles automatisch ab.</li>
        </ol>
        <p className="mt-3 text-xs text-muted">
          Der Link ist dein Schlüssel: Wer ihn hat, sieht und ändert deinen Lernstand. Nicht öffentlich teilen.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(link).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
          >
            {copied ? <Check className="size-4 text-good" /> : <Copy className="size-4" />} {copied ? "Kopiert" : "Link kopieren"}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => run(syncNow)}>
            <RefreshCw className={cn("size-4", busy && "animate-spin")} /> Jetzt synchronisieren
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm("Dieses Gerät von der Synchronisation trennen? Der Lernstand bleibt auf diesem Gerät und in der Cloud erhalten.")) {
                disconnectSync();
              }
            }}
          >
            <Unplug className="size-4" /> Trennen
          </Button>
        </div>
      </div>
    </div>
  );
}
