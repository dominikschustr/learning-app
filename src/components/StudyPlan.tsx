"use client";

import { ArrowRight, CalendarClock, CheckCircle2, Info } from "lucide-react";
import Link from "next/link";
import { READINESS_TARGET, countdown, fmtExamDate, type PlanEntry, type Priority } from "@/lib/plan";
import { alpha, cn } from "@/lib/utils";
import { ButtonLink } from "./ui";

const PRIORITY: Record<Priority, { label: string; className: string; dot: string }> = {
  hoch: { label: "Priorität hoch", className: "bg-bad-soft text-bad", dot: "bg-bad" },
  mittel: { label: "Priorität mittel", className: "bg-warn-soft text-warn", dot: "bg-warn" },
  niedrig: { label: "Priorität niedrig", className: "bg-surface-2 text-muted", dot: "bg-line-strong" },
  sicher: { label: "Ziel erreicht", className: "bg-good-soft text-good", dot: "bg-good" },
};

/** Prüfungsplan auf der Startseite: alle Klausuren nach Datum, mit Countdown und Anteil der Lernzeit heute. */
export function StudyPlan({ upcoming, past }: { upcoming: PlanEntry[]; past: PlanEntry[] }) {
  if (!upcoming.length && !past.length) return null;
  const next = upcoming[0];
  const focus = upcoming.filter((e) => e.share > 0).toSorted((a, b) => b.share - a.share)[0];
  const external = upcoming.filter((e) => e.readiness === undefined);

  return (
    <section className="card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <CalendarClock className="size-3.5" /> Prüfungsplan
          </p>
          {next ? (
            <h2 className="display mt-1 text-xl sm:text-3xl">
              Nächste Klausur {countdown(next.days)}: {next.name}
            </h2>
          ) : (
            <h2 className="display mt-1 text-xl sm:text-3xl">Alle Klausuren geschrieben</h2>
          )}
        </div>
        {next && (
          <div className="hidden text-right sm:block">
            <p className="display text-4xl tabular-nums sm:text-5xl">{next.days}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{next.days === 1 ? "Tag" : "Tage"}</p>
          </div>
        )}
      </div>

      {focus && (
        <div
          className="mt-4 flex items-center gap-3 rounded-2xl p-3 sm:mt-5 sm:p-4"
          style={{ background: alpha(focus.color ?? "#000000", 0.08) }}
        >
          <p className="min-w-0 flex-1 text-sm">
            <span className="block font-semibold">
              Heute zuerst: {focus.name}
              <span className="max-sm:hidden"> – etwa {Math.round(focus.share * 100)} % deiner Lernzeit</span>
            </span>
            <span className="text-xs text-ink-2 sm:hidden">etwa {Math.round(focus.share * 100)} % deiner Lernzeit</span>
            <span className="text-ink-2 max-sm:hidden">
              Bis {fmtExamDate(focus.date)} fehlen {Math.round((READINESS_TARGET - (focus.readiness ?? 0)) * 100)} Punkte
              Readiness, also rund {fmtPoints(focus.perDay)} pro Tag.
            </span>
          </p>
          {focus.href && (
            <ButtonLink href={`${focus.href}/practice?mode=smart`} className="shrink-0">
              Loslegen <ArrowRight className="size-4" />
            </ButtonLink>
          )}
        </div>
      )}

      <ol className="mt-3 divide-y divide-line sm:mt-5">
        {upcoming.map((e) => (
          <PlanRow key={e.key} e={e} />
        ))}
        {past.map((e) => (
          <PlanRow key={e.key} e={e} done />
        ))}
      </ol>

      <details className="group mt-3 text-xs leading-relaxed text-muted">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-semibold text-ink-2">
          <Info className="size-3.5" /> Wie wird priorisiert?
        </summary>
        <p className="mt-2">
          Anteil der Lernzeit = was bis {Math.round(READINESS_TARGET * 100)} % Readiness fehlt, geteilt durch die Tage bis
          zur Klausur – nahe Klausuren mit viel Rückstand zuerst. Er verschiebt sich, sobald du lernst.
          {external.length > 0 &&
            ` ${external.map((e) => e.name).join(" und ")} ${external.length === 1 ? "ist" : "sind"} nicht in der App – plane dafür zusätzlich Zeit ein.`}
        </p>
      </details>
    </section>
  );
}

/** „24. Nov.“ – kurz fürs Handy */
function fmtDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

function fmtPoints(perDay: number | null) {
  return `${((perDay ?? 0) * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Punkte`;
}

function PlanRow({ e, done }: { e: PlanEntry; done?: boolean }) {
  const inApp = e.readiness !== undefined;
  const content = (
    <>
      <span className="w-16 shrink-0 text-sm sm:w-28">
        <span className="block whitespace-nowrap font-semibold">
          <span className="sm:hidden">{fmtDay(e.date)}</span>
          <span className="max-sm:hidden">{fmtExamDate(e.date)}</span>
        </span>
        <span className={cn("text-xs", e.days <= 7 && !done ? "font-semibold text-bad" : "text-muted")}>
          <span className="sm:hidden">{done ? "vorbei" : e.days === 0 ? "heute" : `${e.days} Tage`}</span>
          <span className="max-sm:hidden">{countdown(e.days)}</span>
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          {e.short && (
            <span
              className="rounded-md px-1.5 py-0.5 text-[11px] font-bold"
              style={{ background: alpha(e.color ?? "#000000", 0.12), color: e.color }}
            >
              {e.short}
            </span>
          )}
          <span className={cn("min-w-0 truncate font-semibold", !inApp && "text-ink-2")}>{e.name}</span>
          {e.priority && !done && (
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold max-sm:hidden", PRIORITY[e.priority].className)}>
              {PRIORITY[e.priority].label}
            </span>
          )}
        </span>
        {inApp && !done ? (
          <span className="mt-1 flex items-center gap-2 text-xs text-muted sm:mt-1.5">
            {e.priority && (
              <span className={cn("size-2 shrink-0 rounded-full sm:hidden", PRIORITY[e.priority].dot)} title={PRIORITY[e.priority].label} />
            )}
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2 max-sm:hidden sm:w-40">
              <span
                className="block h-full rounded-full"
                style={{ width: `${Math.round(e.share * 100)}%`, background: e.color }}
              />
            </span>
            <span className="tabular-nums">
              {Math.round(e.share * 100)} % der Lernzeit
              <span className="max-sm:hidden"> · Readiness {Math.round((e.readiness ?? 0) * 100)} %</span>
            </span>
          </span>
        ) : (
          <span className="mt-0.5 block text-xs text-muted">
            {done ? "geschrieben" : "nicht in der App"}
          </span>
        )}
      </span>
      {done ? (
        <CheckCircle2 className="size-4 shrink-0 text-good" />
      ) : (
        inApp && <ArrowRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5" />
      )}
    </>
  );
  const cls = cn("flex items-center gap-3 py-2.5 sm:gap-4 sm:py-3", done && "opacity-50");
  return (
    <li>
      {e.href && !done ? (
        <Link href={e.href} className={cn(cls, "group -mx-2 rounded-xl px-2 hover:bg-surface-2/60")}>
          {content}
        </Link>
      ) : (
        <div className={cls}>{content}</div>
      )}
    </li>
  );
}
