"use client";

import { Check, Minus, Play, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { paperItems, type Paper, type Question, type SubjectContent } from "@/lib/schema";
import { itemStatus, type ItemStatus } from "@/lib/srs";
import { useApp } from "@/lib/store";
import { cn, itemKey } from "@/lib/utils";
import { fmtPoints, slotLabel } from "./Papers";
import { ButtonLink } from "./ui";

type Row = {
  key: string;
  q: Question;
  /** z. B. „Part 2 · b)“ */
  slot: string;
  /** Aufgabentitel im Klausurbogen, z. B. „CGU Lyon“ */
  section: string;
  topic: string;
  points: number;
};

type StatusFilter = "all" | "open" | "done" | "wrong";

const STATUS: Record<ItemStatus, { label: string; color: string }> = {
  new: { label: "Offen", color: "var(--line-strong)" },
  first: { label: "Richtig", color: "var(--good)" },
  recovered: { label: "Richtig nach Fehler", color: "var(--warn)" },
  wrong: { label: "Zuletzt falsch", color: "var(--bad)" },
};

const TYPE_LABEL = (q: Question) =>
  q.type === "mc" ? "MC" : q.type === "tf" ? "T/F" : q.results.length ? "Rechnen" : "Text";

/** Kurzcode eines Kapitels, z. B. „T3“ aus „T3 · Non-current assets …“. */
const code = (title: string) => title.split(" · ")[0];

/** Zeilen einer Klausur: jede Teilaufgabe einzeln, mit Position, Thema und Punkten. */
function rowsOf(paper: Paper, byId: Map<string, Question>): Row[] {
  return paperItems(paper).flatMap((i) => {
    const q = byId.get(i.q);
    if (!q) return [];
    const part = paper.parts[i.part];
    const section = part.sections[i.section].title;
    const slot = slotLabel({ part: i.part, partTitle: part.title, instructions: "", section: "", letter: i.letter, points: i.points });
    // Thema: eigenes Feld der Frage, sonst Aufgabentitel bzw. Thema des Klausurteils
    const topic = q.topic || section || part.title.split(/\s[–:-]\s/).slice(1).join(" – ") || part.title;
    return [{ key: `${paper.id}:${q.id}`, q, slot, section, topic, points: i.points }];
  });
}

/** Alle Aufgaben der Probeklausuren als Tabelle: Thema, Kapitel, Stand – einzeln oder als Auswahl üben. */
export function PaperTasks({ content, papers }: { content: SubjectContent; papers: Paper[] }) {
  const { subject } = content;
  const items = useApp((s) => s.items);
  const [chapter, setChapter] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<string[]>([]);

  const byId = useMemo(() => new Map(content.questions.map((q) => [q.id, q])), [content.questions]);
  const groups = useMemo(() => papers.map((p, i) => ({ paper: p, n: i + 1, rows: rowsOf(p, byId) })), [papers, byId]);
  const lectureOf = useMemo(() => new Map(subject.lectures.map((l) => [l.id, l.title])), [subject.lectures]);

  const st = (q: Question) => itemStatus(items[itemKey(subject.id, q.id)]);
  const passes = (r: Row) => {
    if (chapter !== "all" && r.q.lecture !== chapter) return false;
    const s = st(r.q);
    if (status === "open") return s === "new";
    if (status === "done") return s !== "new";
    if (status === "wrong") return s === "wrong";
    return true;
  };

  // Gesamtstand über alle Aufgaben (jede Frage einmal, auch wenn sie in zwei Klausuren steht)
  const unique = [...new Map(groups.flatMap((g) => g.rows).map((r) => [r.q.id, r.q])).values()];
  const doneCount = unique.filter((q) => st(q) !== "new").length;
  const chapterCounts = subject.lectures
    .map((l) => ({ id: l.id, code: code(l.title), title: l.title, n: unique.filter((q) => q.lecture === l.id).length }))
    .filter((c) => c.n > 0);

  const sel = new Set(selected);
  const toggle = (ids: string[], on: boolean) =>
    setSelected((cur) => (on ? [...new Set([...cur, ...ids])] : cur.filter((id) => !ids.includes(id))));
  // Üben in Tabellenreihenfolge, jede Frage einmal
  const order = unique.map((q) => q.id);
  const pickedInOrder = order.filter((id) => sel.has(id));
  const practiceHref = (ids: string[]) => `/s/${subject.id}/practice?mode=papers&q=${ids.join(",")}`;

  const visible = groups.map((g) => ({ ...g, rows: g.rows.filter(passes) })).filter((g) => g.rows.length);

  return (
    <div className={cn(selected.length > 0 && "pb-24")}>
      <p className="text-sm text-muted">
        {unique.length} Aufgaben · <span className="font-semibold text-ink-2">{doneCount} bearbeitet</span> ·{" "}
        {unique.length - doneCount} offen. Tippe eine Zeile an, um sie auszuwählen, oder starte sie direkt mit ▶.
      </p>

      {/* Filter */}
      <div className="mt-4 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={chapter === "all"} onClick={() => setChapter("all")}>
            Alle Kapitel
          </FilterChip>
          {chapterCounts.map((c) => (
            <FilterChip key={c.id} active={chapter === c.id} onClick={() => setChapter(c.id)} title={c.title}>
              {c.code} <span className="opacity-60">{c.n}</span>
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "Alle"],
              ["open", "Nur offene"],
              ["done", "Schon bearbeitet"],
              ["wrong", "Zuletzt falsch"],
            ] as const
          ).map(([k, label]) => (
            <FilterChip key={k} active={status === k} onClick={() => setStatus(k)}>
              {label}
            </FilterChip>
          ))}
        </div>
      </div>

      {!visible.length && <p className="card mt-6 p-6 text-center text-sm text-muted">Keine Aufgaben für diesen Filter.</p>}

      <div className="mt-6 space-y-6">
        {visible.map(({ paper, n, rows }) => {
          const ids = [...new Set(rows.map((r) => r.q.id))];
          const all = ids.every((id) => sel.has(id));
          const some = !all && ids.some((id) => sel.has(id));
          const done = ids.filter((id) => st(byId.get(id)!) !== "new").length;
          return (
            <section key={paper.id} className="card overflow-hidden">
              <header className="flex items-center gap-3 border-b border-line bg-surface-2/60 px-3 py-2.5 sm:px-4">
                <Box checked={all} mixed={some} onClick={() => toggle(ids, !all)} label={`Alle Aufgaben von ${paper.title} auswählen`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted">Klausur {n}</p>
                  <h3 className="truncate text-sm font-semibold sm:text-base">{paper.title}</h3>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {done}/{ids.length} bearbeitet
                </span>
              </header>
              <table className="w-full table-fixed border-collapse text-sm">
                <thead className="max-sm:hidden">
                  <tr className="border-b border-line text-left text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted">
                    <th className="w-11 py-2 pl-3 sm:pl-4" />
                    <th className="w-[11rem] py-2 pr-3 font-semibold">Aufgabe</th>
                    <th className="py-2 pr-3 font-semibold">Thema</th>
                    <th className="w-16 py-2 pr-3 font-semibold">Kapitel</th>
                    <th className="w-14 py-2 pr-3 text-right font-semibold">Punkte</th>
                    <th className="w-[9.5rem] py-2 pr-2 font-semibold">Stand</th>
                    <th className="w-12 py-2 pr-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const s = items[itemKey(subject.id, r.q.id)];
                    const status = STATUS[itemStatus(s)];
                    const on = sel.has(r.q.id);
                    const lecture = lectureOf.get(r.q.lecture) ?? r.q.lecture;
                    return (
                      <tr
                        key={r.key}
                        onClick={() => toggle([r.q.id], !on)}
                        className={cn(
                          "cursor-pointer border-b border-line/70 align-top transition last:border-0 hover:bg-surface-2/60",
                          on && "bg-accent/5",
                        )}
                      >
                        <td className="w-11 py-3 pl-3 sm:pl-4">
                          <Box checked={on} onClick={() => toggle([r.q.id], !on)} label={`${r.slot} auswählen`} />
                        </td>
                        <td className="w-[11rem] py-3 pr-3 max-sm:hidden">
                          <span className="block font-medium text-ink-2">{r.slot}</span>
                          {r.section && <span className="block truncate text-xs text-muted">{r.section}</span>}
                        </td>
                        <td className="py-3 pr-3">
                          {/* Mobil: Position und Kapitel über dem Thema */}
                          <span className="mb-0.5 block truncate text-xs text-muted sm:hidden">
                            {r.slot} · {code(lecture)} · {fmtPoints(r.points)} P.
                          </span>
                          <span className="block font-semibold leading-snug">{r.topic}</span>
                          <span className="mt-0.5 block text-xs text-muted">
                            {TYPE_LABEL(r.q)}
                            <span className="sm:hidden">
                              {" · "}
                              <StatusLabel color={status.color} label={status.label} seen={s?.seen ?? 0} />
                            </span>
                          </span>
                        </td>
                        <td className="w-16 py-3 pr-3 max-sm:hidden">
                          <span
                            title={lecture}
                            className="inline-flex rounded-md px-1.5 py-0.5 text-xs font-semibold"
                            style={{ background: `color-mix(in srgb, ${subject.color} 12%, transparent)`, color: subject.color }}
                          >
                            {code(lecture)}
                          </span>
                        </td>
                        <td className="w-14 py-3 pr-3 text-right tabular-nums text-ink-2 max-sm:hidden">{fmtPoints(r.points)}</td>
                        <td className="w-[9.5rem] py-3 pr-2 max-sm:hidden">
                          <StatusLabel color={status.color} label={status.label} seen={s?.seen ?? 0} />
                        </td>
                        <td className="w-12 py-2 pr-3 text-right">
                          <Link
                            href={practiceHref([r.q.id])}
                            onClick={(e) => e.stopPropagation()}
                            title="Nur diese Aufgabe üben"
                            aria-label={`${r.slot} üben`}
                            className="inline-grid size-9 place-items-center rounded-full text-ink-2 transition hover:bg-ink hover:text-bg"
                          >
                            <Play className="size-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>

      {/* Auswahlleiste */}
      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <button
              type="button"
              onClick={() => setSelected([])}
              className="inline-grid size-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink"
              aria-label="Auswahl leeren"
              title="Auswahl leeren"
            >
              <X className="size-5" />
            </button>
            <span className="min-w-0 flex-1 text-sm font-semibold">
              {pickedInOrder.length} {pickedInOrder.length === 1 ? "Aufgabe" : "Aufgaben"} ausgewählt
            </span>
            <ButtonLink href={practiceHref(pickedInOrder)}>
              <Play className="size-4" /> Auswahl üben
            </ButtonLink>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusLabel({ color, label, seen }: { color: string; label: string; seen: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className={cn(seen ? "font-medium text-ink-2" : "text-muted")}>{label}</span>
      {seen > 1 && <span className="text-muted tabular-nums">· {seen}×</span>}
    </span>
  );
}

function Box({ checked, mixed, onClick, label }: { checked: boolean; mixed?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? "mixed" : checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-md border transition",
        checked || mixed ? "border-ink bg-ink text-bg" : "border-line-strong bg-surface hover:border-ink-2",
      )}
    >
      {checked ? <Check className="size-3.5" strokeWidth={3} /> : mixed ? <Minus className="size-3.5" strokeWidth={3} /> : null}
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition",
        active ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}
