"use client";

import { Download, Minus, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { exportData, useApp, useHydrated } from "@/lib/store";
import { disconnectSync, useSync } from "@/lib/sync";
import { dayKey } from "@/lib/utils";
import { SyncSettings } from "./SyncSettings";
import { Button, Skeleton } from "./ui";

export function SettingsView() {
  const hydrated = useHydrated();
  const dailyGoal = useApp((s) => s.dailyGoal);
  const setDailyGoal = useApp((s) => s.setDailyGoal);
  const importData = useApp((s) => s.importData);
  const reset = useApp((s) => s.reset);
  const syncKey = useSync((s) => s.key);
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

      <SyncSettings />

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
        <p className="text-sm text-muted">Löscht XP, Streak, Achievements und den gesamten Lernfortschritt.</p>
        <Button
          variant="secondary"
          className="mt-4 text-bad"
          onClick={() => {
            const warning = syncKey
              ? "Fortschritt auf diesem Gerät löschen? Das Gerät wird dabei von der Synchronisation getrennt – der Stand in der Cloud und auf deinen anderen Geräten bleibt erhalten."
              : "Wirklich den gesamten Fortschritt löschen? Das lässt sich nicht rückgängig machen.";
            if (window.confirm(warning)) {
              if (syncKey) disconnectSync();
              reset();
              setMsg("Fortschritt zurückgesetzt.");
            }
          }}
        >
          <Trash2 className="size-4" /> Fortschritt löschen
        </Button>
      </section>
    </div>
  );
}
