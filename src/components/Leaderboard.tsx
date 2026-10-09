"use client";

import { Flame, Loader2, LogOut, Pencil, RefreshCw, Trophy, UserPlus } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { titleFor } from "@/lib/gamification";
import { joinBoard, leaveBoard, loadBoard, renameOnBoard, useBoard } from "@/lib/leaderboard";
import { NAME_MAX, rankEntries, statsFrom, type Entry, type Row, type SortBy } from "@/lib/ranking";
import { useApp, useHydrated } from "@/lib/store";
import { useNow } from "@/lib/useNow";
import { cn, dayKey } from "@/lib/utils";
import { Bar, Button, Chip, Skeleton } from "./ui";

const SORTS: { id: SortBy; label: string }[] = [
  { id: "xp", label: "Level" },
  { id: "today", label: "Heute" },
  { id: "streak", label: "Streak" },
];

export function Leaderboard() {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  return <LeaderboardInner />;
}

function LeaderboardInner() {
  const s = useApp();
  const board = useBoard();
  const now = useNow();
  const [by, setBy] = useState<SortBy>("xp");
  const joined = s.profile?.on && s.profile.name ? s.profile : null;

  // Laden beim Öffnen und beim Zurückkehren in die App (höchstens alle 30 s)
  useEffect(() => {
    void loadBoard();
    const onVisible = () => {
      const { loadedAt, status } = useBoard.getState();
      if (document.visibilityState === "visible" && status !== "loading" && (!loadedAt || Date.now() - loadedAt > 30_000)) {
        void loadBoard();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Eigene Zeile immer mit dem aktuellen lokalen Stand, auch bevor die nächste Meldung raus ist
  const myId = board.me ?? "local";
  const rows = useMemo(() => {
    let entries: Entry[] = board.entries;
    if (joined) {
      const own: Entry = { ...statsFrom(s, joined.name, now), id: myId, at: now };
      entries = [...entries.filter((e) => e.id !== myId), own];
    } else if (board.me) {
      entries = entries.filter((e) => e.id !== board.me);
    }
    return rankEntries(entries, by, now);
  }, [board.entries, board.me, joined, s, by, now, myId]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Wettbewerb</p>
          <h1 className="display mt-2 text-4xl sm:text-5xl">Rangliste</h1>
        </div>
        <Button
          variant="ghost"
          className="size-11 px-0"
          aria-label="Aktualisieren"
          title="Aktualisieren"
          disabled={board.status === "loading"}
          onClick={() => void loadBoard()}
        >
          <RefreshCw className={cn("size-4 shrink-0", board.status === "loading" && "animate-spin")} />
        </Button>
      </section>

      {joined ? <Membership name={joined.name} /> : <JoinCard />}

      <div role="tablist" aria-label="Sortierung" className="inline-flex rounded-full border border-line bg-surface p-1">
        {SORTS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={by === o.id}
            onClick={() => setBy(o.id)}
            className={cn(
              "h-9 rounded-full px-4 text-sm font-semibold transition",
              by === o.id ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {board.error && <p className="text-sm text-bad">{board.error}</p>}

      {board.status === "loading" && !board.loadedAt ? (
        <Skeleton className="h-72" />
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center">
          <Trophy className="mx-auto size-8 text-muted" />
          <p className="mt-3 font-semibold">Noch niemand dabei</p>
          <p className="text-sm text-muted">Tritt als Erste:r bei und teile den Link zur App mit deinen Kommiliton:innen.</p>
        </div>
      ) : (
        <ol className="card divide-y divide-line overflow-hidden">
          {rows.map((r, i) => (
            <motion.li
              key={r.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 10) * 0.03 }}
            >
              <RowView row={r} by={by} me={r.id === myId && !!joined} now={now} />
            </motion.li>
          ))}
        </ol>
      )}

      <p className="text-xs text-muted">
        „Heute“ zählt beantwortete Fragen und Karteikarten seit Mitternacht, „Streak“ die Lerntage in Folge. Die
        Rangliste aktualisiert sich, wenn du sie öffnest.
      </p>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      aria-label={`Platz ${rank}`}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums",
        rank === 1 ? "bg-warn-soft text-warn" : rank <= 3 ? "bg-surface-2 text-ink" : "text-muted",
      )}
    >
      {rank === 1 ? <Trophy className="size-4" fill="currentColor" /> : rank}
    </span>
  );
}

function lastSeen(at: number, now: number): string | null {
  const days = Math.floor((now - at) / 86_400_000);
  if (days < 1) return null;
  return days === 1 ? "gestern aktiv" : `vor ${days} Tagen aktiv`;
}

function RowView({ row, by, me, now }: { row: Row; by: SortBy; me: boolean; now: number }) {
  const seen = me ? null : lastSeen(row.at, now);
  const goalDone = row.todayNow >= row.goal;

  return (
    <div className={cn("flex items-center gap-3 px-4 py-3 sm:px-5", me && "bg-accent/5")}>
      <RankBadge rank={row.rank} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="truncate font-semibold">{row.name}</span>
          {me && <Chip className="border-accent/30 text-accent">Du</Chip>}
        </p>
        <p className="truncate text-xs text-muted">
          {titleFor(row.level)}
          {seen && ` · ${seen}`}
        </p>
        {by === "today" && <Bar value={row.todayNow / row.goal} color="var(--good)" className="mt-2 h-1.5" />}
      </div>

      <div className="flex shrink-0 items-center gap-3 text-right sm:gap-5">
        <Stat label="Level" active={by === "xp"} value={`Lv ${row.level}`} sub={`${row.xp} XP`} />
        <Stat
          label="Heute"
          active={by === "today"}
          value={String(row.todayNow)}
          sub={goalDone ? "Ziel ✓" : `/ ${row.goal}`}
          subClass={goalDone ? "text-good" : undefined}
        />
        <Stat
          label="Streak"
          active={by === "streak"}
          value={
            <span className="inline-flex items-center gap-0.5">
              <Flame className={cn("size-3.5", row.streakNow ? "text-flame" : "text-muted")} fill={row.streakNow ? "currentColor" : "none"} />
              {row.streakNow}
            </span>
          }
          sub={row.streakNow === 1 ? "Tag" : "Tage"}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  active,
  subClass,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
  active: boolean;
  subClass?: string;
}) {
  return (
    <div className={cn("w-12 sm:w-16", !active && "hidden sm:block")} aria-label={label}>
      <p className={cn("tabular-nums", active ? "text-lg font-bold" : "text-sm font-semibold text-ink-2")}>{value}</p>
      <p className={cn("text-[11px] tabular-nums text-muted", subClass)}>{sub}</p>
    </div>
  );
}

function NameForm({
  initial = "",
  submitLabel,
  icon,
  onSubmit,
  onCancel,
}: {
  initial?: string;
  submitLabel: string;
  icon: React.ReactNode;
  onSubmit: (name: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const clean = name.trim();

  return (
    <form
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!clean) return;
        setBusy(true);
        setMsg(null);
        onSubmit(clean)
          .catch((err: Error) => setMsg(err.message))
          .finally(() => setBusy(false));
      }}
    >
      <div className="flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX}
          placeholder="Dein Name oder Spitzname"
          autoComplete="nickname"
          className="h-11 min-w-0 flex-1 rounded-full border border-line-strong bg-surface px-4 text-sm outline-none focus:border-accent"
        />
        <Button type="submit" disabled={busy || !clean}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : icon} {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Abbrechen
          </Button>
        )}
      </div>
      {msg && <p className="mt-2 text-sm text-bad">{msg}</p>}
    </form>
  );
}

function JoinCard() {
  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">Mitmachen</h2>
      <p className="text-sm text-muted">
        Vergleiche Level, Tagesstand und Streak mit allen, die Lernwerk nutzen. Sichtbar sind nur dein Name, XP, deine
        Antworten heute, dein Tagesziel und deine Streak – nicht dein Lernstand.
      </p>
      <NameForm submitLabel="Beitreten" icon={<UserPlus className="size-4" />} onSubmit={joinBoard} />
    </section>
  );
}

function Membership({ name }: { name: string }) {
  const [editing, setEditing] = useState(false);
  const now = useNow();
  const today = useApp((s) => s.activity[dayKey(now)] ?? 0);

  if (editing) {
    return (
      <section className="card p-6">
        <h2 className="text-lg font-semibold">Namen ändern</h2>
        <NameForm
          initial={name}
          submitLabel="Speichern"
          icon={<Pencil className="size-4" />}
          onSubmit={async (n) => {
            await renameOnBoard(n);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </section>
    );
  }

  return (
    <section className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <p className="text-sm text-ink-2">
        Du bist dabei als <span className="font-semibold text-ink">{name}</span>
        {today === 0 && <span className="text-muted"> – heute noch keine Antwort</span>}
      </p>
      <div className="flex gap-1">
        <Button variant="ghost" className="h-9 px-3" onClick={() => setEditing(true)}>
          <Pencil className="size-4" /> Umbenennen
        </Button>
        <Button
          variant="ghost"
          className="h-9 px-3"
          onClick={() => {
            if (window.confirm("Aus der Rangliste austreten? Dein Eintrag wird gelöscht, dein Lernstand bleibt.")) {
              void leaveBoard().catch(() => undefined);
            }
          }}
        >
          <LogOut className="size-4" /> Austreten
        </Button>
      </div>
    </section>
  );
}
