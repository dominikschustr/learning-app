import { ArrowLeft, ArrowRight, BookOpen, FileText, Layers, Lightbulb, ScrollText } from "lucide-react";
import Link from "next/link";
import type { LectureText, Subject } from "@/lib/schema";
import { alpha } from "@/lib/utils";
import { ButtonLink } from "./ui";

type Section = LectureText["sections"][number];

function kindOf(heading: string): "key" | "def" | "further" | "other" {
  const h = heading.toLowerCase();
  if (h.startsWith("key")) return "key";
  if (h.startsWith("definition")) return "def";
  if (h.includes("further")) return "further";
  return "other";
}

const LABEL = { key: "Key Messages", def: "Definitionen", further: "Zum Weiterdenken", other: "" };

function slug(heading: string, i: number) {
  return `${kindOf(heading)}-${i}`;
}

/** Originaltext eines Key-Messages-Dokuments, zum Nachlesen aufbereitet (Server Component). */
export function ReadingView({
  subject,
  text,
  chapterIndex,
}: {
  subject: Subject;
  text: LectureText;
  chapterIndex: number;
}) {
  const lecture = subject.lectures[chapterIndex];
  const chapterHref = `/s/${subject.id}/c/${lecture.id}`;
  const base = `/s/${subject.id}`;
  const title = text.title.replace(/^Sessions?\s+[\w&]+\s*-\s*/i, "");
  const color = subject.color;

  return (
    <article className="mx-auto max-w-2xl">
      <Link href={chapterHref} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {lecture.title}
      </Link>

      <header className="mt-8">
        <p className="eyebrow flex items-center gap-2">
          <ScrollText className="size-3.5" /> Kapitel {chapterIndex + 1} · Nachlesen
        </p>
        <h1 className="display text-4xl sm:text-5xl mt-2">{title}</h1>
        <p className="mt-3 text-sm text-muted">Originaltext aus „{text.source}“</p>
      </header>

      <nav className="sticky top-14 z-20 -mx-4 mt-8 flex gap-2 overflow-x-auto border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-full sm:border sm:px-2 sm:py-1.5">
        {text.sections.map((s, i) => (
          <a
            key={i}
            href={`#${slug(s.heading, i)}`}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface-2"
          >
            {LABEL[kindOf(s.heading)] || s.heading}
          </a>
        ))}
      </nav>

      <div className="mt-10 space-y-14">
        {text.sections.map((s, i) => (
          <SectionView key={i} id={slug(s.heading, i)} section={s} color={color} />
        ))}
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

      {subject.lectures[chapterIndex + 1] && (
        <div className="mt-6 flex justify-end">
          <Link
            href={`${base}/c/${subject.lectures[chapterIndex + 1].id}/text`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink"
          >
            Weiterlesen: {subject.lectures[chapterIndex + 1].title} <ArrowRight className="size-4" />
          </Link>
        </div>
      )}
    </article>
  );
}

function SectionView({ id, section, color }: { id: string; section: Section; color: string }) {
  const kind = kindOf(section.heading);
  const heading = LABEL[kind] || section.heading;

  if (kind === "def") {
    return (
      <section id={id} className="scroll-mt-32">
        <h2 className="display text-2xl">{heading}</h2>
        <dl className="mt-6 grid gap-3">
          {section.blocks.map((b, i) => (
            <div
              key={i}
              className="rounded-2xl border border-line bg-surface p-4 sm:p-5"
              style={{ borderLeft: `4px solid ${color}` }}
            >
              {b.term && <dt className="font-semibold text-ink">{b.term}</dt>}
              <dd className="mt-1 leading-relaxed text-ink-2">{b.text}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }

  if (kind === "further") {
    return (
      <section id={id} className="scroll-mt-32">
        <h2 className="display text-2xl">{heading}</h2>
        <ul className="mt-6 space-y-3">
          {section.blocks.map((b, i) => (
            <li key={i} className="flex gap-3 rounded-2xl bg-surface-2 p-4 leading-relaxed text-ink-2">
              <Lightbulb className="mt-1 size-4 shrink-0 text-warn" />
              {b.text}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  let n = 0;
  return (
    <section id={id} className="scroll-mt-32">
      <h2 className="display text-2xl">{heading}</h2>
      <div className="mt-6 space-y-5">
        {section.blocks.map((b, i) =>
          b.kind === "para" ? (
            <p key={i} className="text-[1.05rem] font-medium leading-relaxed text-ink">
              {b.text}
            </p>
          ) : (
            <div key={i} className="flex gap-4">
              <span
                className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums"
                style={{ background: alpha(color, 0.12), color }}
              >
                {++n}
              </span>
              <div className="min-w-0">
                <p className="text-[1.05rem] leading-relaxed text-ink">{b.text}</p>
                {b.children && (
                  <ul className="mt-3 space-y-2 border-l-2 border-line pl-4">
                    {b.children.map((c, j) => (
                      <li key={j} className="leading-relaxed text-ink-2">
                        <Highlight text={c} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

/** Hebt „Begriff:“ am Anfang eines Unterpunkts hervor. */
function Highlight({ text }: { text: string }) {
  const m = text.match(/^([^:]{2,60}):\s*(.*)$/);
  if (!m) return <>{text}</>;
  return (
    <>
      <strong className="font-semibold text-ink">{m[1]}:</strong> {m[2]}
    </>
  );
}
