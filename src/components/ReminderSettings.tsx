"use client";

import { Bell, Loader2, Share, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import {
  REMINDER_HOURS,
  enableReminder,
  notificationPermission,
  reminderSupport,
  setDailyReminder,
  setReminderHour,
  setSocialPush,
  useReminder,
  type ReminderSupport,
} from "@/lib/push";
import { cn } from "@/lib/utils";
import { Button } from "./ui";

/** Unterstützung erst im Browser ermitteln (auf dem Server gibt es kein navigator). */
function useSupport(): ReminderSupport | null {
  const [support, setSupport] = useState<ReminderSupport | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- einmalig nach dem Mounten, Browser-API
  useEffect(() => setSupport(reminderSupport()), []);
  return support;
}

function Switch({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50",
        checked ? "bg-accent" : "bg-line-strong",
      )}
    >
      <span className={cn("inline-block size-5 rounded-full bg-white shadow transition", checked ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}

function IosHint() {
  return (
    <p className="mt-4 flex gap-2 rounded-2xl bg-surface-2 p-3 text-sm leading-relaxed text-ink-2">
      <Share className="mt-0.5 size-4 shrink-0" />
      <span>
        Auf dem iPhone kommen Mitteilungen nur an die Home-Bildschirm-App: in Safari auf <b>Teilen</b> →{" "}
        <b>Zum Home-Bildschirm</b>, Lernwerk von dort öffnen und die Erinnerung hier einschalten.
      </span>
    </p>
  );
}

function Row({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted">{text}</p>
      </div>
      {children}
    </div>
  );
}

/** Einstellungen → Mitteilungen (pro Gerät): Erinnerung ans Tagesziel und Rangliste. */
export function ReminderSettings() {
  const support = useSupport();
  const { on, social, hour } = useReminder();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (support === null || support === "unsupported") {
    if (support === null) return null;
    return (
      <section className="card p-6">
        <h2 className="text-lg font-semibold">Mitteilungen</h2>
        <p className="text-sm text-muted">Dieser Browser unterstützt keine Mitteilungen.</p>
      </section>
    );
  }

  const run = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (done) setMsg(done);
    } catch (e) {
      setMsg((e as Error).message || "Das hat nicht geklappt.");
    } finally {
      setBusy(false);
    }
  };

  const blocked = notificationPermission() === "denied";
  const toggle = (label: string, checked: boolean, set: (v: boolean) => Promise<void>, what: string) =>
    busy ? (
      <Loader2 className="mt-1 size-5 shrink-0 animate-spin text-muted" />
    ) : (
      <Switch
        checked={checked}
        disabled={support !== "ok"}
        label={label}
        onChange={(v) => void run(() => set(v), `${what} ist ${v ? "an" : "aus"}.`)}
      />
    );

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">Mitteilungen</h2>
      <p className="mb-4 text-sm text-muted">Gilt für dieses Gerät.</p>

      <Row
        title="Erinnerung ans Tagesziel"
        text="Abends, falls das Tagesziel noch offen ist"
      >
        {toggle("Erinnerung ans Tagesziel", on, setDailyReminder, "Die Erinnerung")}
      </Row>

      {support === "ok" && on && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-2">Uhrzeit</span>
          {REMINDER_HOURS.map((h) => (
            <button
              key={h}
              type="button"
              disabled={busy}
              onClick={() => void run(() => setReminderHour(h))}
              className={cn(
                "h-9 rounded-full px-3 text-sm font-semibold tabular-nums transition",
                hour === h ? "bg-ink text-bg" : "border border-line-strong text-ink-2 hover:bg-surface-2",
              )}
            >
              {h}:00
            </button>
          ))}
        </div>
      )}

      <div className="my-4 border-t border-line" />

      <Row title="Rangliste" text="Wenn jemand gerade lernt, höchstens alle 3 Std. pro Person">
        {toggle("Mitteilung, wenn jemand aus der Rangliste lernt", social, setSocialPush, "Die Ranglisten-Mitteilung")}
      </Row>

      {support === "ios-install" && <IosHint />}

      {blocked && !on && !social && support === "ok" && (
        <p className="mt-3 text-sm text-bad">
          Mitteilungen sind für Lernwerk blockiert – erlaube sie in den Einstellungen des Browsers bzw. des iPhones.
        </p>
      )}
      {msg && <p className="mt-3 text-sm text-ink-2">{msg}</p>}
    </section>
  );
}

/** Einmaliger Hinweis auf der Startseite, die Erinnerung einzuschalten. */
export function ReminderPrompt() {
  const support = useSupport();
  const { on, social, dismissed, hour } = useReminder();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!support || support === "unsupported" || on || social || dismissed) return null;
  if (support === "ok" && notificationPermission() === "denied") return null;

  return (
    <section className="card relative flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
        <Bell className="size-5" />
      </span>
      <div className="min-w-0 flex-1 pr-6 sm:pr-0">
        <p className="font-semibold">Mitteilungen einschalten?</p>
        <p className="text-sm text-muted">
          {support === "ios-install"
            ? "Erst zum Home-Bildschirm hinzufügen (Teilen → Zum Home-Bildschirm), dann klappt die Erinnerung ans Tagesziel."
            : `Um ${hour}:00 Uhr, falls dein Tagesziel offen ist – und wenn jemand aus der Rangliste lernt.`}
        </p>
        {msg && <p className="mt-1 text-sm text-bad">{msg}</p>}
      </div>
      {support === "ok" && (
        <Button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setMsg(null);
            enableReminder()
              .catch((e: Error) => setMsg(e.message))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />} Einschalten
        </Button>
      )}
      <button
        type="button"
        aria-label="Hinweis schließen"
        onClick={() => useReminder.setState({ dismissed: true })}
        className="absolute right-3 top-3 rounded-full p-1 text-muted hover:bg-surface-2 hover:text-ink"
      >
        <X className="size-4" />
      </button>
    </section>
  );
}
