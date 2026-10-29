"use client";

import { Check, Download, KeyRound, Minus, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { setGeminiKey, useGeminiKey } from "@/lib/grade";
import { exportData, useApp, useHydrated } from "@/lib/store";
import { resetProgress } from "@/lib/account";
import { dayKey } from "@/lib/utils";
import { AccountSettings } from "./AccountSettings";
import { Button, Skeleton } from "./ui";

export function SettingsView() {
  const hydrated = useHydrated();
  const dailyGoal = useApp((s) => s.dailyGoal);
  const setDailyGoal = useApp((s) => s.setDailyGoal);
  const importData = useApp((s) => s.importData);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (!hydrated) return <Skeleton className="h-96" />;

  const download = () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lernwerk-backup-${dayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("Backup heruntergeladen.");
  };

  const upload = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!window.confirm("Aktuellen Fortschritt durch das Backup ersetzen?")) return;
      setMsg(importData(data) ? "Backup importiert." : "Die Datei ist kein Lernwerk-Backup.");
    } catch {
      setMsg("Die Datei konnte nicht gelesen werden.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="display text-4xl sm:text-5xl">Einstellungen</h1>

      <AccountSettings />

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Tagesziel</h2>
        <p className="text-sm text-muted">Beantwortete Fragen und Karteikarten pro Tag.</p>
        <div className="mt-4 flex items-center gap-3">
          <Button variant="secondary" className="size-11 px-0" onClick={() => setDailyGoal(dailyGoal - 5)} aria-label="weniger">
            <Minus className="size-4" />
          </Button>
          <span className="display w-20 text-center text-4xl tabular-nums">{dailyGoal}</span>
          <Button variant="secondary" className="size-11 px-0" onClick={() => setDailyGoal(dailyGoal + 5)} aria-label="mehr">
            <Plus className="size-4" />
          </Button>
        </div>
      </section>

      <AiSettings />

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Backup</h2>
        <p className="text-sm text-muted">
          Zusätzlich zur Synchronisation kannst du deinen Fortschritt als Datei sichern und wieder importieren.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={download}>
            <Download className="size-4" /> Exportieren
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Importieren
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </div>
        {msg && <p className="mt-3 text-sm text-ink-2">{msg}</p>}
      </section>

      <section className="card border-bad/30 p-6">
        <h2 className="text-lg font-semibold">Zurücksetzen</h2>
        <p className="text-sm text-muted">
          Löscht XP, Streak, Achievements und den gesamten Lernfortschritt deines Kontos – auf allen Geräten. Konto und
          Name bleiben.
        </p>
        <Button
          variant="secondary"
          className="mt-4 text-bad"
          onClick={() => {
            if (!window.confirm("Wirklich den gesamten Fortschritt löschen – auf allen Geräten? Das lässt sich nicht rückgängig machen.")) return;
            resetProgress()
              .then(() => setMsg("Fortschritt zurückgesetzt."))
              .catch((e: Error) => setMsg(`Zurücksetzen fehlgeschlagen: ${e.message}`));
          }}
        >
          <Trash2 className="size-4" /> Fortschritt löschen
        </Button>
      </section>
    </div>
  );
}

function AiSettings() {
  const saved = useGeminiKey();
  const [input, setInput] = useState("");

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">KI-Bewertung</h2>
      <p className="text-sm text-muted">
        Optional: Kurzantworten von Google Gemini bewerten lassen statt selbst. Dafür brauchst du einen eigenen,
        kostenlosen API-Key aus{" "}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="font-medium text-accent underline">
          Google AI Studio
        </a>{" "}
        (keine Abrechnung aktivieren). Der Key bleibt nur in diesem Browser.
      </p>
      {saved ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-good">
            <Check className="size-4" /> Aktiv (Key …{saved.slice(-4)})
          </span>
          <Button variant="ghost" onClick={() => setGeminiKey("")}>
            Entfernen
          </Button>
        </div>
      ) : (
        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setGeminiKey(input);
            setInput("");
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            type="password"
            autoComplete="off"
            placeholder="API-Key einfügen"
            className="h-11 min-w-0 flex-1 rounded-full border border-line-strong bg-surface px-4 text-sm outline-none focus:border-accent"
          />
          <Button type="submit" variant="secondary" disabled={!input.trim()}>
            <KeyRound className="size-4" /> Speichern
          </Button>
        </form>
      )}
    </section>
  );
}
