"use client";

import { ArrowDown, ArrowUp, Crown, Flame, RefreshCw, Swords, Trophy, Users } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { titleFor } from "@/lib/gamification";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { loadBoard, useBoard } from "@/lib/leaderboard";
import {
  duel,
  leagueFor,
  movement,
  overtakes,
  rankEntries,
  snapshot,
  sortValue,
  statsFrom,
  streakMilestone,
  teamDay,
  type Entry,
  type Row,
  type Seen,
  type SortBy,
} from "@/lib/ranking";
import { useApp, useHydrated } from "@/lib/store";
import { announce, celebrate, useToasts } from "@/lib/toast";
import { useNow } from "@/lib/useNow";
import { alpha, cn, dayKey } from "@/lib/utils";
import { Bar, Button, Chip, Skeleton } from "./ui";

const SORTS: { id: SortBy; label: string }[] = [
  { id: "xp", label: "Level" },
  { id: "today", label: "Heute" },
  { id: "streak", label: "Streak" },
];

const UNIT: Record<SortBy, [string, string]> = { xp: ["XP", "XP"], today: ["Antwort", "Antworten"], streak: ["Tag", "Tage"] };
const unit = (by: SortBy, n: number) => `${n} ${UNIT[by][n === 1 ? 0 : 1]}`;

/** Plätze beim letzten Besuch je Sortierung (nur auf diesem Gerät), für Auf-/Abstiege und Überhol-Meldungen. */
type SeenStore = { day: string; ranks: Partial<Record<SortBy, Seen>> };
const SEEN_KEY = "lernwerk-board-seen";

function readSeen(): SeenStore | null {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "null") as SeenStore | null;
  } catch {
    return null;
  }
}

function writeSeen(v: SeenStore) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(v));
  } catch {}
}

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
  const session = useAuth((a) => a.session);

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
  const myId = session?.uid ?? null;
  const rows = useMemo(() => {
    let entries: Entry[] = board.entries;
    if (session) {
      const own: Entry = { ...statsFrom(s, session.name, now), id: session.uid, at: now };
      entries = [...entries.filter((e) => e.id !== session.uid), own];
    }
    return rankEntries(entries, by, now);
  }, [board.entries, session, s, by, now]);
  const mine = rows.find((r) => r.id === myId);

  // Stand beim letzten Besuch: einmal pro geladener Liste lesen, dann den neuen Stand merken
  const [prevSeen, setPrevSeen] = useState<SeenStore | null>(null);
  const handled = useRef<number | null>(null);
  useEffect(() => {
    if (!board.loadedAt || handled.current === board.loadedAt || !session) return;
    handled.current = board.loadedAt;
    const own: Entry = { ...statsFrom(useApp.getState(), session.name, Date.now()), id: session.uid, at: Date.now() };
    const entries = [...board.entries.filter((e) => e.id !== session.uid), own];
    const t = Date.now();
    const bySort = Object.fromEntries(SORTS.map((o) => [o.id, rankEntries(entries, o.id, t)])) as Record<SortBy, Row[]>;
    const before = readSeen();
    // „Heute“ beginnt jeden Tag neu – Vergleich nur innerhalb desselben Tages
    const prev: SeenStore | null = before && { ...before, ranks: { ...before.ranks, ...(before.day !== dayKey(t) ? { today: undefined } : {}) } };
    setPrevSeen(prev);
    writeSeen({ day: dayKey(t), ranks: Object.fromEntries(SORTS.map((o) => [o.id, snapshot(bySort[o.id])])) });

    const { push } = useToasts.getState();
    const { passed, passedBy } = overtakes(prev?.ranks.xp ?? null, bySort.xp, session.uid);
    if (passed.length) {
      const me = bySort.xp.find((r) => r.id === session.uid)!;
      push({ kind: "rank", icon: "rocket", title: `Du hast ${listNames(passed)} überholt!`, body: `Jetzt Platz ${me.rank} der Level-Rangliste.` });
      celebrate();
    }
    if (passedBy.length) {
      push({ kind: "rank", icon: "swords", title: `${listNames(passedBy)} ${passedBy.length === 1 ? "hat" : "haben"} dich überholt`, body: "Hol dir deinen Platz zurück – jede richtige Antwort bringt 10 XP." });
    }

    const unlock: string[] = [];
    if (passed.length) unlock.push("rank-overtake");
    const meXp = bySort.xp.find((r) => r.id === session.uid);
    if (meXp && bySort.xp.length >= 4 && meXp.rank <= 3) unlock.push("rank-podium");
    const meToday = bySort.today.find((r) => r.id === session.uid);
    if (meToday && meToday.rank === 1 && meToday.todayNow > 0 && teamDay(bySort.today).active >= 3) unlock.push("rank-day-1");
    const fresh = useApp.getState().unlockBoardAchievements(unlock);
    if (fresh.length) announce({ xp: 0, levelUp: null, goalReached: false, achievements: fresh });
  }, [board.loadedAt, board.entries, session]);

  const showPodium = rows.length >= 3 && rows.slice(0, 3).some((r) => sortValue(r, by) > 0);

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

      {mine && session && (
        <section className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p className="text-sm text-ink-2">
            <span className="font-semibold text-ink">{session.name}</span> – Platz {mine.rank} von {rows.length}
          </p>
          <Link href="/settings/#konto" className="text-sm font-medium text-accent hover:underline">
            Namen ändern
          </Link>
        </section>
      )}

      <TeamCard rows={rows} />

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

      {myId && rows.length > 1 && <DuelCard rows={rows} myId={myId} by={by} />}
      {showPodium && <Podium rows={rows} by={by} myId={myId} />}

      {board.status === "loading" && !board.loadedAt ? (
        <Skeleton className="h-72" />
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center">
          <Trophy className="mx-auto size-8 text-muted" />
          <p className="mt-3 font-semibold">Noch niemand dabei</p>
          <p className="text-sm text-muted">Teile den Link zur App mit deinen Kommiliton:innen.</p>
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
              <RowView row={r} by={by} me={r.id === myId} now={now} moved={movement(prevSeen?.ranks[by] ?? null, r)} />
            </motion.li>
          ))}
        </ol>
      )}

      <p className="text-xs text-muted">
        Hier stehen alle, die ein Konto haben. „Heute“ zählt beantwortete Fragen und Karteikarten seit Mitternacht,
        „Streak“ die Lerntage in Folge. Die Liga richtet sich nach deinem Level (Bronze ab 1, Silber ab 3, Gold ab 5,
        Platin ab 8, Diamant ab 12, Legende ab 17). Pfeile zeigen Auf- und Abstiege seit deinem letzten Besuch.
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

function RowView({ row, by, me, now, moved }: { row: Row; by: SortBy; me: boolean; now: number; moved?: number }) {
  const seen = me ? null : lastSeen(row.at, now);
  const goalDone = row.todayNow >= row.goal;
  const league = leagueFor(row.level);
  const milestone = streakMilestone(row.streakNow);

  return (
    <div className={cn("flex items-center gap-3 px-4 py-3 sm:px-5", me && "bg-accent/5")}>
      <div className="flex w-9 shrink-0 flex-col items-center">
        <RankBadge rank={row.rank} />
        <Moved n={moved} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="truncate font-semibold">{row.name}</span>
          {me && <Chip className="border-accent/30 text-accent">Du</Chip>}
          {goalDone && (
            <span title="Tagesziel geschafft" aria-label="Tagesziel geschafft" className="text-warn">
              <Crown className="size-3.5" fill="currentColor" />
            </span>
          )}
          {milestone && (
            <span
              title={`${milestone}-Tage-Streak`}
              className="inline-flex items-center gap-0.5 rounded-full bg-flame/10 px-1.5 text-[11px] font-bold text-flame"
            >
              <Flame className="size-3" fill="currentColor" />
              {milestone}+
            </span>
          )}
        </p>
        <p className="flex items-center gap-1.5 truncate text-xs text-muted">
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[11px] font-semibold"
            style={{ background: alpha(league.color, 0.14), color: league.color }}
          >
            <span className="size-1.5 rounded-full" style={{ background: league.color }} />
            {league.name}
          </span>
          <span className="truncate">
            {titleFor(row.level)}
            {seen && ` · ${seen}`}
          </span>
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

function listNames(rows: Row[]): string {
  const names = rows.map((r) => r.name);
  return names.length <= 2 ? names.join(" und ") : `${names.slice(0, 2).join(", ")} und ${names.length - 2} weitere`;
}

/** Plätze gewonnen/verloren seit dem letzten Besuch. */
function Moved({ n }: { n?: number }) {
  if (!n) return null;
  const up = n > 0;
  return (
    <span
      className={cn("mt-0.5 inline-flex items-center text-[10px] font-bold tabular-nums", up ? "text-good" : "text-bad")}
      aria-label={up ? `${n} Plätze gewonnen` : `${-n} Plätze verloren`}
    >
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(n)}
    </span>
  );
}

const MEDALS = ["#d4a017", "#9aa4b2", "#b8733a"];

/** Die ersten drei der aktuellen Sortierung als Siegertreppchen. */
function Podium({ rows, by, myId }: { rows: Row[]; by: SortBy; myId: string | null }) {
  const top = rows.slice(0, 3);
  const order = [top[1], top[0], top[2]];
  const height = ["h-16", "h-24", "h-12"];
  return (
    <section className="card px-4 pb-0 pt-5" aria-label="Siegertreppchen">
      <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
        {order.map((r, i) => {
          const place = i === 1 ? 0 : i === 0 ? 1 : 2;
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + (2 - place) * 0.08 }}
              className="flex min-w-0 flex-col items-center text-center"
            >
              {place === 0 && <Crown className="mb-1 size-5" style={{ color: MEDALS[0] }} fill="currentColor" />}
              <span
                className="grid size-11 place-items-center rounded-full text-base font-bold text-white"
                style={{ background: MEDALS[place] }}
              >
                {r.name.slice(0, 1).toUpperCase()}
              </span>
              <p className={cn("mt-1.5 w-full truncate text-sm font-semibold", r.id === myId && "text-accent")}>{r.name}</p>
              <p className="text-xs tabular-nums text-muted">{by === "xp" ? `Lv ${r.level} · ${r.xp} XP` : unit(by, sortValue(r, by))}</p>
              <div
                className={cn("mt-2 grid w-full place-items-center rounded-t-xl text-lg font-bold", height[i])}
                style={{ background: alpha(MEDALS[place], 0.18), color: MEDALS[place] }}
              >
                {r.rank}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

/** Wer liegt direkt vor dir, wer direkt hinter dir? */
function DuelCard({ rows, myId, by }: { rows: Row[]; myId: string; by: SortBy }) {
  const d = duel(rows, myId, by);
  const me = rows.find((r) => r.id === myId);
  if (!d || !me) return null;
  const mine = sortValue(me, by);
  const hint = by === "xp" && d.ahead ? ` – etwa ${Math.ceil(d.ahead.gap / 10)} richtige Antworten` : "";
  return (
    <section className="card space-y-3 px-5 py-4">
      <p className="eyebrow flex items-center gap-1.5">
        <Swords className="size-3.5" /> Dein Duell
      </p>
      {d.ahead ? (
        <div>
          <p className="text-sm">
            Noch <span className="font-bold tabular-nums">{unit(by, d.ahead.gap)}</span>{hint} bis Platz {d.ahead.row.rank}:{" "}
            überhol <span className="font-semibold">{d.ahead.row.name}</span>.
          </p>
          <Bar value={mine / Math.max(1, mine + d.ahead.gap)} color="var(--accent)" className="mt-2 h-1.5" />
        </div>
      ) : (
        <p className="text-sm">
          <span className="font-semibold">Du führst!</span>
          {d.behind ? (
            <>
              {" "}Vorsprung <span className="font-bold tabular-nums">{unit(by, d.behind.gap)}</span> vor {d.behind.row.name}.
            </>
          ) : null}
        </p>
      )}
      {d.ahead && d.behind && (
        <p className="text-xs text-muted">
          {d.behind.gap === 0
            ? `${d.behind.row.name} ist gleichauf mit dir.`
            : `${d.behind.row.name} ist ${unit(by, d.behind.gap)} hinter dir.`}
        </p>
      )}
    </section>
  );
}

/** Gemeinsamer Tagesfortschritt aller. */
function TeamCard({ rows }: { rows: Row[] }) {
  const t = teamDay(rows);
  if (rows.length < 2) return null;
  return (
    <section className="card px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow flex items-center gap-1.5">
          <Users className="size-3.5" /> Gemeinsam heute
        </p>
        <p className="text-xs text-muted">
          {t.done} von {rows.length} mit Tagesziel <Crown className="inline size-3 text-warn" fill="currentColor" />
        </p>
      </div>
      {t.active ? (
        <>
          <p className="mt-2 text-sm">
            <span className="display text-2xl tabular-nums">{t.answers}</span>{" "}
            <span className="text-muted">
              Antworten von {t.active} {t.active === 1 ? "Person" : "Personen"} · gemeinsames Ziel {t.goal}
            </span>
          </p>
          <Bar value={t.goal ? t.answers / t.goal : 0} color="var(--good)" className="mt-2 h-2" />
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">Heute hat noch niemand gelernt – sei die erste Person auf dem Treppchen.</p>
      )}
    </section>
  );
}
