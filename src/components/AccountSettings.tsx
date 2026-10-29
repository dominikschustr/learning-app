"use client";

import { Cloud, CloudOff, Loader2, LogOut, Pencil, RefreshCw, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { deleteAccount, signOut } from "@/lib/account";
import { NAME_MAX } from "@/lib/ranking";
import { renameAccount, useAuth } from "@/lib/auth";
import { syncNow, useSync } from "@/lib/sync";
import { useNow } from "@/lib/useNow";
import { cn } from "@/lib/utils";
import { Button } from "./ui";

export function SyncStatusLine() {
  const { status, lastSync, error } = useSync();
  const now = useNow();
  const ago = lastSync && now ? Math.max(0, Math.round((now - lastSync) / 60000)) : null;

  const map = {
    idle: {
      icon: Cloud,
      text: ago === null ? "Mit deinem Konto verbunden" : ago < 1 ? "Gerade synchronisiert" : `Synchronisiert vor ${ago} Min`,
      cls: "text-good",
    },
    syncing: { icon: Loader2, text: "Synchronisiere …", cls: "text-accent" },
    offline: { icon: CloudOff, text: "Offline – wird nachgeholt", cls: "text-warn" },
    error: { icon: CloudOff, text: error ?? "Fehler", cls: "text-bad" },
  }[status];

  return (
    <p className={cn("flex items-center gap-2 text-sm font-medium", map.cls)}>
      <map.icon className={cn("size-4 shrink-0", status === "syncing" && "animate-spin")} /> {map.text}
    </p>
  );
}

const input =
  "h-11 min-w-0 flex-1 rounded-full border border-line-strong bg-surface px-4 text-sm outline-none focus:border-accent";

export function AccountSettings() {
  const session = useAuth((s) => s.session);
  const syncing = useSync((s) => s.status === "syncing");
  const [mode, setMode] = useState<"view" | "rename" | "delete">("view");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!session) return null;

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

  const logout = () =>
    run(async () => {
      if (await signOut()) return;
      const force = window.confirm(
        "Der Lernstand konnte gerade nicht hochgeladen werden (offline?). Trotzdem abmelden? Was seit der letzten Synchronisation auf diesem Gerät gelernt wurde, geht dann verloren.",
      );
      if (force) await signOut(true);
    });

  return (
    <section id="konto" className="card scroll-mt-20 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
            <UserRound className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{session.name}</h2>
            <p className="truncate text-sm text-muted">{session.email}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-2 px-4 py-3">
        <SyncStatusLine />
        <Button variant="ghost" className="h-9 px-3" disabled={syncing} onClick={() => void syncNow()}>
          <RefreshCw className={cn("size-4", syncing && "animate-spin")} /> Jetzt synchronisieren
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Dein Lernstand gehört zu deinem Konto: Melde dich auf Laptop und Handy an, dann ist überall alles gleich. In
        der Rangliste sehen andere deinen Namen, XP, Tagesstand und Streak.
      </p>

      {mode === "rename" && (
        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await renameAccount(value);
              setMode("view");
            });
          }}
        >
          <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={NAME_MAX} autoComplete="nickname" className={input} />
          <Button type="submit" disabled={busy || !value.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />} Speichern
          </Button>
          <Button variant="ghost" onClick={() => setMode("view")}>
            Abbrechen
          </Button>
        </form>
      )}

      {mode === "delete" && (
        <form
          className="mt-4 rounded-2xl border border-bad/30 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => deleteAccount(value));
          }}
        >
          <p className="text-sm font-semibold text-bad">Konto endgültig löschen</p>
          <p className="mt-1 text-sm text-ink-2">
            Löscht dein Konto, deinen Lernstand auf allen Geräten und deinen Eintrag in der Rangliste. Zur Bestätigung
            dein Passwort:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoComplete="current-password"
              placeholder="Passwort"
              className={input}
            />
            <Button type="submit" variant="bad" disabled={busy || !value}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Löschen
            </Button>
            <Button variant="ghost" onClick={() => setMode("view")}>
              Abbrechen
            </Button>
          </div>
        </form>
      )}

      {mode === "view" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setValue(session.name);
              setMode("rename");
            }}
          >
            <Pencil className="size-4" /> Namen ändern
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void logout()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />} Abmelden
          </Button>
          <Button
            variant="ghost"
            className="text-bad"
            onClick={() => {
              setValue("");
              setMode("delete");
            }}
          >
            <Trash2 className="size-4" /> Konto löschen
          </Button>
        </div>
      )}

      {msg && <p className="mt-3 text-sm text-bad">{msg}</p>}
    </section>
  );
}
