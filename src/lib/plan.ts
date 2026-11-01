/**
 * Lernplan aus den Klausurterminen: Countdown je Prüfung und wie die Lernzeit heute auf die Fächer verteilt wird.
 * Gewicht eines Fachs = was bis zur Ziel-Readiness fehlt, geteilt durch die verbleibenden Tage –
 * viel Rückstand und eine nahe Klausur heißen hohe Priorität.
 */

/** Ziel-Readiness bis zum Klausurtag */
export const READINESS_TARGET = 0.85;

export type Priority = "hoch" | "mittel" | "niedrig" | "sicher";

export type PlanInput = {
  key: string;
  name: string;
  /** JJJJ-MM-TT */
  date: string;
  short?: string;
  color?: string;
  href?: string;
  /** fehlt bei Prüfungen ohne Fach in der App */
  readiness?: number;
};

export type PlanEntry = PlanInput & {
  /** Kalendertage bis zur Klausur (0 = heute) */
  days: number;
  /** Anteil der Lernzeit heute (0–1), nur Fächer in der App */
  share: number;
  priority: Priority | null;
  /** nötiger Readiness-Zuwachs pro Tag bis zum Ziel (0–1) */
  perDay: number | null;
};

function localDay(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Ganze Kalendertage von heute (lokal) bis zum Datum; negativ, wenn es vorbei ist. */
export function daysUntil(date: string, now: number): number {
  const today = new Date(now);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((localDay(date) - start) / 864e5);
}

export function studyPlan(inputs: PlanInput[], now: number): { upcoming: PlanEntry[]; past: PlanEntry[] } {
  const rows = inputs
    .map((e) => {
      const days = daysUntil(e.date, now);
      const need = e.readiness === undefined ? null : Math.max(0, READINESS_TARGET - e.readiness);
      // Am Klausurtag selbst zählt der Tag noch voll
      const perDay = need === null ? null : need / Math.max(1, days);
      return { ...e, days, perDay };
    })
    .sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));

  const upcoming = rows.filter((r) => r.days >= 0);
  const total = upcoming.reduce((s, r) => s + (r.perDay ?? 0), 0);
  const priority = (perDay: number | null, share: number): Priority | null => {
    if (perDay === null) return null;
    if (perDay === 0) return "sicher";
    return share >= 0.3 ? "hoch" : share >= 0.15 ? "mittel" : "niedrig";
  };

  return {
    upcoming: upcoming.map((r) => {
      const share = total && r.perDay ? r.perDay / total : 0;
      return { ...r, share, priority: priority(r.perDay, share) };
    }),
    past: rows.filter((r) => r.days < 0).map((r) => ({ ...r, share: 0, priority: null })),
  };
}

/** „heute“, „morgen“, „in 23 Tagen“ */
export function countdown(days: number): string {
  if (days === 0) return "heute";
  if (days === 1) return "morgen";
  if (days < 0) return days === -1 ? "gestern" : `vor ${-days} Tagen`;
  return `in ${days} Tagen`;
}

/** „Mo, 24. Nov.“ bzw. lang „Montag, 24. November“ */
export function fmtExamDate(date: string, long = false): string {
  return new Date(localDay(date)).toLocaleDateString(
    "de-DE",
    long ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "short", day: "numeric", month: "short" },
  );
}
