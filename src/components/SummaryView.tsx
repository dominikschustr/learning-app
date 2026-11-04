import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calculator,
  ChevronDown,
  CircleCheck,
  FileText,
  GraduationCap,
  KeyRound,
  Layers,
  Lightbulb,
  ListChecks,
  ScrollText,
  Target,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import type { Subject } from "@/lib/schema";
import type { Summary, SummaryBlock } from "@/lib/summary";
import { alpha, cn } from "@/lib/utils";
import { Bars, Causal, Correlation, Funnel, LineChart, PositionMap, Rich, Scatter, Waterfall } from "./SummaryCharts";
import { ButtonLink } from "./ui";

/** Lern-Zusammenfassung einer Lecture mit Diagrammen (Server Component). */
export function SummaryView({ subject, summary, chapterIndex }: { subject: Subject; summary: Summary; chapterIndex: number }) {
  const lecture = subject.lectures[chapterIndex];
  const base = `/s/${subject.id}`;
  const color = subject.color;
  const next = subject.lectures[chapterIndex + 1];
  const nav = [
    ...summary.sections.map((s, i) => ({ id: s.id, label: `${i + 1} · ${s.heading}` })),
    { id: "auf-einen-blick", label: "Auf einen Blick" },
    ...(summary.exam.length || summary.traps.length ? [{ id: "klausur", label: "Klausur" }] : []),
  ];

  return (
    <article className="mx-auto max-w-3xl">
      <Link href={`${base}/c/${lecture.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {lecture.title}
      </Link>

      <header className="mt-8">
        <p className="eyebrow flex items-center gap-2">
          <ScrollText className="size-3.5" /> Kapitel {chapterIndex + 1} · Zusammenfassung
        </p>
        <h1 className="display mt-2 text-4xl sm:text-5xl">{summary.title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2 sm:text-xl">{summary.tagline}</p>
        <p className="mt-3 text-sm text-muted">Quelle: {summary.source}</p>
      </header>

      <section className="mt-8 rounded-3xl p-5 sm:p-6" style={{ background: alpha(color, 0.07) }}>
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color }}>
          <Target className="size-4" /> Nach dieser Lecture kannst du …
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {summary.goals.map((g, i) => (
            <li key={i} className="flex gap-2 text-[0.95rem] leading-snug text-ink">
              <CircleCheck className="mt-0.5 size-4 shrink-0" style={{ color }} />
              <span>
                <Rich text={g} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <nav className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 mt-8 flex gap-1 overflow-x-auto border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-full sm:border sm:px-2 sm:py-1.5">
        {nav.map((n) => (
          <a key={n.id} href={`#${n.id}`} className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface-2">
            {n.label}
          </a>
        ))}
      </nav>

      <div className="mt-10 space-y-16">
        {summary.sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-32">
            <div className="flex items-baseline gap-3">
              <span className="text-sm font-bold tabular-nums" style={{ color }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="display text-2xl sm:text-3xl">{s.heading}</h2>
            </div>
            {s.lead && <p className="mt-3 text-[1.05rem] leading-relaxed text-ink-2">{s.lead}</p>}
            <div className="mt-6 space-y-5">
              {s.blocks.map((b, j) => (
                <Block key={j} b={b} color={color} />
              ))}
            </div>
          </section>
        ))}

        <section id="auf-einen-blick" className="scroll-mt-32">
          <div className="card p-5 sm:p-6">
            <p className="flex items-center gap-2 text-sm font-semibold" style={{ color }}>
              <ListChecks className="size-4" /> Auf einen Blick
            </p>
            <h2 className="display mt-1 text-2xl">Das musst du sicher können</h2>
            <ol className="mt-5 space-y-3">
              {summary.recap.map((r, i) => (
                <li key={i} className="flex gap-3 leading-relaxed text-ink">
                  <span
                    className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums"
                    style={{ background: alpha(color, 0.12), color }}
                  >
                    {i + 1}
                  </span>
                  <span>
                    <Rich text={r} />
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {(summary.exam.length > 0 || summary.traps.length > 0) && (
          <section id="klausur" className="scroll-mt-32 grid gap-4 sm:grid-cols-2">
            {summary.exam.length > 0 && (
              <div className="rounded-2xl border p-5" style={{ borderColor: alpha(color, 0.35), background: alpha(color, 0.05) }}>
                <p className="flex items-center gap-2 font-semibold" style={{ color }}>
                  <GraduationCap className="size-4" /> So kommt es in der Klausur
                </p>
                <ul className="mt-3 space-y-2.5 text-[0.95rem] leading-snug text-ink">
                  {summary.exam.map((e, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full" style={{ background: color }} />
                      <span>
                        <Rich text={e} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {summary.traps.length > 0 && (
              <div className="rounded-2xl border border-bad/30 bg-bad-soft p-5">
                <p className="flex items-center gap-2 font-semibold text-bad">
                  <TriangleAlert className="size-4" /> Typische Fehler
                </p>
                <ul className="mt-3 space-y-2.5 text-[0.95rem] leading-snug text-ink">
                  {summary.traps.map((t, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-bad" />
                      <span>
                        <Rich text={t} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>

      <section className="card mt-16 p-6">
        <p className="eyebrow">Gelesen? Jetzt festigen</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <ButtonLink variant="secondary" href={`${base}/cards?lecture=${lecture.id}`}>
            <Layers className="size-4" /> Karteikarten
          </ButtonLink>
          <ButtonLink variant="secondary" href={`${base}/practice?mode=lecture&lecture=${lecture.id}`}>
            <BookOpen className="size-4" /> Üben
          </ButtonLink>
          <ButtonLink href={`${base}/exam?chapter=${lecture.id}`}>
            <FileText className="size-4" /> Kapiteltest
          </ButtonLink>
        </div>
      </section>

      {next && (
        <div className="mt-6 flex justify-end">
          <Link
            href={`${base}/c/${next.id}/text`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink"
          >
            Weiterlesen: {next.title} <ArrowRight className="size-4" />
          </Link>
        </div>
      )}
    </article>
  );
}

/* ---------- Text-Helfer ---------- */

/** „Begriff: Erklärung“ → Begriff fett */
function Term({ text }: { text: string }) {
  const m = text.match(/^([^:*]{2,48}):\s+(.*)$/);
  if (!m) return <Rich text={text} />;
  return (
    <>
      <strong className="font-semibold text-ink">{m[1]}:</strong> <Rich text={m[2]} />
    </>
  );
}

/** Formel: x_{i} tiefgestellt, x^{2} hochgestellt */
function MathText({ text }: { text: string }) {
  const parts = text.split(/([_^]\{[^}]*\})/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("_{") ? (
          <sub key={i}>{p.slice(2, -1)}</sub>
        ) : p.startsWith("^{") ? (
          <sup key={i}>{p.slice(2, -1)}</sup>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

/* ---------- Bausteine ---------- */

const TONE = {
  good: { bg: "var(--good-soft)", fg: "var(--good)" },
  bad: { bg: "var(--bad-soft)", fg: "var(--bad)" },
  warn: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  neutral: { bg: "var(--surface-2)", fg: "var(--ink)" },
};

function Block({ b, color }: { b: SummaryBlock; color: string }) {
  switch (b.type) {
    case "text":
      return (
        <p className="text-[1.05rem] leading-relaxed text-ink">
          <Rich text={b.text} />
        </p>
      );

    case "list":
      return (
        <div>
          {b.title && <p className="mb-2 font-semibold text-ink">{b.title}</p>}
          <ul className="space-y-2">
            {b.items.map((it, i) => (
              <li key={i} className="flex gap-3 leading-relaxed text-ink-2">
                {b.style === "number" ? (
                  <span className="w-5 shrink-0 text-right font-bold tabular-nums" style={{ color }}>
                    {i + 1}.
                  </span>
                ) : b.style === "check" ? (
                  <CircleCheck className="mt-1 size-4 shrink-0" style={{ color }} />
                ) : (
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full" style={{ background: color }} />
                )}
                <span>
                  <Term text={it} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      );

    case "defs":
      return (
        <dl className="grid gap-3">
          {b.items.map((d, i) => (
            <div key={i} className="rounded-2xl border border-line bg-surface p-4" style={{ borderLeft: `4px solid ${color}` }}>
              <dt className="font-semibold text-ink">{d.term}</dt>
              <dd className="mt-1 leading-relaxed text-ink-2">
                <Rich text={d.text} />
              </dd>
            </div>
          ))}
        </dl>
      );

    case "flow":
      return (
        <div>
          {b.title && <p className="mb-3 font-semibold text-ink">{b.title}</p>}
          <div className="flex flex-col items-stretch gap-2 sm:flex-row">
            {b.steps.map((s, i) => (
              <Fragment key={i}>
                {i > 0 && (
                  <span className="grid place-items-center text-muted">
                    <ArrowDown className="size-4 sm:hidden" />
                    <ArrowRight className="hidden size-4 sm:block" />
                  </span>
                )}
                <div
                  className="flex-1 rounded-2xl border p-3"
                  style={{ borderColor: alpha(color, 0.3), background: alpha(color, 0.05 + i * 0.03) }}
                >
                  {s.tag && (
                    <p className="text-[0.7rem] font-bold uppercase tracking-wider" style={{ color }}>
                      {s.tag}
                    </p>
                  )}
                  <p className="font-semibold leading-snug text-ink">{s.label}</p>
                  {s.text && (
                    <p className="mt-1 text-sm leading-snug text-ink-2">
                      <Rich text={s.text} />
                    </p>
                  )}
                  {s.points && (
                    <ul className="mt-1.5 space-y-0.5 text-sm leading-snug text-ink-2">
                      {s.points.map((p, j) => (
                        <li key={j}>· {p}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </Fragment>
            ))}
          </div>
          {b.note && <p className="mt-3 text-sm leading-relaxed text-muted">{b.note}</p>}
        </div>
      );

    case "grid":
      return (
        <div>
          {b.title && <p className="mb-3 font-semibold text-ink">{b.title}</p>}
          <div
            className={cn(
              "grid gap-3",
              b.cols >= 2 && "sm:grid-cols-2",
              b.cols === 3 && "lg:grid-cols-3",
              b.cols === 4 && "lg:grid-cols-4",
              b.cols === 5 && "sm:grid-cols-3 lg:grid-cols-5",
            )}
          >
            {b.items.map((t, i) => (
              <div key={i} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-snug" style={{ color }}>
                    {t.label}
                  </p>
                  {t.tag && (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold"
                      style={{ background: alpha(color, 0.1), color }}
                    >
                      {t.tag}
                    </span>
                  )}
                </div>
                {t.text && (
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
                    <Rich text={t.text} />
                  </p>
                )}
                {t.points && (
                  <ul className="mt-2 space-y-1 text-sm leading-snug text-ink-2">
                    {t.points.map((p, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted" />
                        <span>
                          <Term text={p} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      );

    case "table":
      return (
        <figure>
          {b.title && <figcaption className="mb-3 font-semibold text-ink">{b.title}</figcaption>}
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[32rem] border-collapse text-sm">
              <thead>
                <tr>
                  {b.head.map((h, i) => (
                    <th
                      key={i}
                      className="border-b border-line px-3 py-2.5 text-left font-semibold text-ink"
                      style={i === b.highlight ? { background: alpha(color, 0.1), color } : { background: "var(--surface-2)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {r.map((c, j) => (
                      <td
                        key={j}
                        className={cn("px-3 py-2.5 align-top leading-snug", j === 0 ? "font-semibold text-ink" : "text-ink-2")}
                        style={j === b.highlight ? { background: alpha(color, 0.05) } : undefined}
                      >
                        <Rich text={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {b.note && <p className="mt-2 text-sm leading-relaxed text-muted">{b.note}</p>}
        </figure>
      );

    case "matrix": {
      const cols = b.x.length;
      return (
        <figure className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          {b.title && <figcaption className="mb-3 font-semibold text-ink">{b.title}</figcaption>}
          <div className="flex gap-2">
            <div className="flex w-5 shrink-0 items-center justify-center">
              <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-muted [writing-mode:vertical-rl] rotate-180">
                {b.yLabel} →
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="grid gap-2" style={{ gridTemplateColumns: `auto repeat(${cols}, minmax(0, 1fr))` }}>
                {b.y.map((yl, r) => (
                  <Fragment key={r}>
                    <div className="flex items-center justify-end pr-1 text-right text-xs font-semibold text-muted">{yl}</div>
                    {b.x.map((_, c) => {
                      const cell = b.cells[r * cols + c];
                      if (!cell) return <div key={c} />;
                      const t = cell.tone === "accent" ? { bg: alpha(color, 0.14), fg: color } : TONE[cell.tone];
                      return (
                        <div key={c} className="min-h-20 rounded-xl p-2.5 sm:p-3" style={{ background: t.bg }}>
                          <p className="text-sm font-bold leading-tight" style={{ color: t.fg }}>
                            {cell.label}
                          </p>
                          {cell.text && <p className="mt-1 text-xs leading-snug text-ink-2 sm:text-[0.8rem]">{cell.text}</p>}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
                <div />
                {b.x.map((xl, c) => (
                  <div key={c} className="text-center text-xs font-semibold text-muted">
                    {xl}
                  </div>
                ))}
              </div>
              <p className="mt-1 text-center text-xs font-semibold uppercase tracking-wider text-muted">{b.xLabel} →</p>
            </div>
          </div>
          {b.note && <p className="mt-3 text-sm leading-relaxed text-muted">{b.note}</p>}
        </figure>
      );
    }

    case "formula":
      return (
        <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: alpha(color, 0.3) }}>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color }}>
            <Calculator className="size-3.5" /> {b.name}
          </p>
          <p className="mt-2 overflow-x-auto text-lg font-semibold leading-relaxed tracking-tight text-ink sm:text-xl">
            <MathText text={b.formula} />
          </p>
          {b.vars.length > 0 && (
            <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm text-ink-2 sm:grid-cols-2">
              {b.vars.map((v, i) => (
                <li key={i}>
                  <MathText text={v} />
                </li>
              ))}
            </ul>
          )}
          {b.note && (
            <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-muted">
              <Rich text={b.note} />
            </p>
          )}
        </div>
      );

    case "example":
      return (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="p-4 sm:p-5">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-warn">
              <Calculator className="size-3.5" /> Rechenbeispiel
            </p>
            <p className="mt-1 font-semibold text-ink">{b.title}</p>
            {b.given.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm leading-snug text-ink-2">
                {b.given.map((g, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted" />
                    <span>
                      <Rich text={g} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {b.question && (
              <p className="mt-3 text-sm font-medium text-ink">
                <Rich text={b.question} />
              </p>
            )}
          </div>
          <details className="group border-t border-line bg-surface-2/60">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-ink-2 hover:text-ink sm:px-5 [&::-webkit-details-marker]:hidden">
              Lösung Schritt für Schritt
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-4 pb-4 sm:px-5">
              <ol className="space-y-2">
                {b.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink-2">
                    <span className="w-4 shrink-0 text-right font-bold tabular-nums text-muted">{i + 1}</span>
                    <span className="font-mono text-[0.82rem] sm:text-sm">
                      <Rich text={s} />
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 rounded-xl bg-good-soft px-3 py-2 text-sm font-semibold text-good">
                <Rich text={b.result} />
              </p>
            </div>
          </details>
        </div>
      );

    case "compare":
      return (
        <figure>
          {b.title && <figcaption className="mb-3 font-semibold text-ink">{b.title}</figcaption>}
          <div className={cn("grid gap-3", b.sides.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
            {b.sides.map((s, i) => (
              <div
                key={i}
                className="rounded-2xl border p-4"
                style={{ borderColor: alpha(color, 0.25), background: alpha(color, i % 2 ? 0.03 : 0.07) }}
              >
                <p className="font-semibold" style={{ color }}>
                  {s.label}
                </p>
                {s.sub && <p className="text-sm text-muted">{s.sub}</p>}
                <ul className="mt-2.5 space-y-1.5 text-sm leading-snug text-ink-2">
                  {s.points.map((p, j) => (
                    <li key={j} className="flex gap-2">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full" style={{ background: color }} />
                      <span>
                        <Term text={p} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {b.note && <p className="mt-3 text-sm leading-relaxed text-muted">{b.note}</p>}
        </figure>
      );

    case "callout": {
      const tones = {
        exam: { Icon: GraduationCap, fg: color, bg: alpha(color, 0.07), label: "Klausur" },
        tip: { Icon: Lightbulb, fg: "var(--warn)", bg: "var(--warn-soft)", label: "Merkhilfe" },
        warn: { Icon: TriangleAlert, fg: "var(--bad)", bg: "var(--bad-soft)", label: "Achtung" },
        key: { Icon: KeyRound, fg: "var(--good)", bg: "var(--good-soft)", label: "Kernaussage" },
      } as const;
      const t = tones[b.tone];
      return (
        <div className="flex gap-3 rounded-2xl p-4" style={{ background: t.bg }}>
          <t.Icon className="mt-0.5 size-5 shrink-0" style={{ color: t.fg }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: t.fg }}>
              {b.title ?? t.label}
            </p>
            <p className="mt-0.5 leading-relaxed text-ink">
              <Rich text={b.text} />
            </p>
          </div>
        </div>
      );
    }

    case "scatter":
      return <Scatter b={b} color={color} />;
    case "correlation":
      return <Correlation b={b} color={color} />;
    case "bars":
      return <Bars b={b} color={color} />;
    case "waterfall":
      return <Waterfall b={b} color={color} />;
    case "funnel":
      return <Funnel b={b} color={color} />;
    case "map":
      return <PositionMap b={b} color={color} />;
    case "line":
      return <LineChart b={b} color={color} />;
    case "causal":
      return <Causal b={b} color={color} />;
  }
}
