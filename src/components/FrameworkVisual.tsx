import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, X } from "lucide-react";
import type { Framework } from "@/lib/schema";
import { alpha, cn } from "@/lib/utils";

type Part = Framework["parts"][number];
type Visual = NonNullable<Framework["visual"]>;
type Props = { parts: Part[]; visual: Visual; color: string; hidden: boolean; accent?: string };

/** Grafische Darstellung eines Frameworks. Verdeckt (`hidden`) bleibt die Form stehen, Begriffe werden zu „?“. */
export function FrameworkVisual(props: Props) {
  const View = VIEWS[props.visual.type];
  return (
    <div className="mt-5" aria-label="Diagramm">
      <View {...props} />
    </div>
  );
}

/** Wie viele Bausteine das Diagramm zeigt – der Rest erscheint als Kacheln darunter. */
export function visualCount(f: Framework): number {
  if (!f.visual) return 0;
  if (f.visual.count !== undefined) return f.visual.count;
  return ["hump", "vertical"].includes(f.visual.type) ? 0 : f.parts.length;
}

const q = (hidden: boolean, s: string) => (hidden ? "?" : s);

function Points({ points, hidden, className }: { points: string[]; hidden: boolean; className?: string }) {
  if (hidden || !points.length) return null;
  return (
    <ul className={cn("mt-1.5 space-y-1 text-[0.8rem] leading-snug text-ink-2", className)}>
      {points.map((p, i) => (
        <li key={i}>{p}</li>
      ))}
    </ul>
  );
}

/** Kasten mit Überschrift und Unterpunkten – Grundbaustein der meisten Diagramme. */
function Box({
  part,
  color,
  hidden,
  strong,
  accent,
  className,
  children,
}: {
  part: Part;
  color: string;
  hidden: boolean;
  strong?: boolean;
  /** Folien-Look: Kästen in der Akzentfarbe (ESCP-Gold) mit Rahmen in `color` */
  accent?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn("relative border p-3", accent ? "rounded-md" : "rounded-2xl", className)}
      style={
        accent
          ? { borderColor: alpha(color, strong ? 0.9 : 0.45), background: alpha(accent, strong ? 0.95 : 0.3) }
          : { borderColor: alpha(color, strong ? 0.6 : 0.25), background: strong ? alpha(color, 0.14) : alpha(color, 0.05) }
      }
    >
      {children}
      <p className="text-sm font-semibold leading-snug" style={{ color }}>
        {q(hidden, part.label)}
      </p>
      <Points points={part.points} hidden={hidden} />
    </div>
  );
}

/** Five Forces als Kreuz: Rivalität in der Mitte, die anderen Kräfte drücken von außen darauf. */
function Forces({ parts, color, hidden, accent }: Props) {
  const [center, top, bottom, right, left] = parts;
  const arrow = "absolute z-10 grid size-6 place-items-center rounded-full bg-surface text-muted shadow-sm";
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {top && (
        <Box accent={accent} part={top} color={color} hidden={hidden} className="sm:col-start-2">
          <span className={cn(arrow, "-bottom-3 left-1/2 hidden -translate-x-1/2 sm:grid")}>
            <ArrowDown className="size-3.5" />
          </span>
        </Box>
      )}
      {left && (
        <Box accent={accent} part={left} color={color} hidden={hidden} className="sm:col-start-1 sm:row-start-2">
          <span className={cn(arrow, "-right-3 top-1/2 hidden -translate-y-1/2 sm:grid")}>
            <ArrowRight className="size-3.5" />
          </span>
        </Box>
      )}
      <Box accent={accent} part={center} color={color} hidden={hidden} strong className="sm:col-start-2 sm:row-start-2 sm:self-center" />
      {right && (
        <Box accent={accent} part={right} color={color} hidden={hidden} className="sm:col-start-3 sm:row-start-2">
          <span className={cn(arrow, "-left-3 top-1/2 hidden -translate-y-1/2 sm:grid")}>
            <ArrowLeft className="size-3.5" />
          </span>
        </Box>
      )}
      {bottom && (
        <Box accent={accent} part={bottom} color={color} hidden={hidden} className="sm:col-start-2 sm:row-start-3">
          <span className={cn(arrow, "-top-3 left-1/2 hidden -translate-x-1/2 sm:grid")}>
            <ArrowUp className="size-3.5" />
          </span>
        </Box>
      )}
    </div>
  );
}

/** 2×2-Matrix mit optionalen Spalten- und Zeilenköpfen (SWOT, generische Strategien, Ansoff, ERRC). */
function Quad({ parts, visual, color, hidden, accent }: Props) {
  const x = visual.x ?? [];
  const y = visual.y ?? [];
  const head = "text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted";
  return (
    <div className={cn("grid gap-2", y.length ? "grid-cols-[auto_1fr_1fr]" : "grid-cols-2")}>
      {x.length > 0 && (
        <>
          {y.length > 0 && <span />}
          {x.slice(0, 2).map((h) => (
            <p key={h} className={cn(head, "px-1 text-center")}>
              {h}
            </p>
          ))}
        </>
      )}
      {[0, 1].map((row) => (
        <Row key={row} label={y[row]} head={head}>
          {parts.slice(row * 2, row * 2 + 2).map((p, i) => (
            <Box key={i} accent={accent} part={p} color={color} hidden={hidden} className="h-full" />
          ))}
        </Row>
      ))}
    </div>
  );
}

function Row({ label, head, children }: { label?: string; head: string; children: React.ReactNode }) {
  return (
    <>
      {label !== undefined && (
        <p className={cn(head, "flex items-center justify-center [writing-mode:vertical-rl] rotate-180")}>{label}</p>
      )}
      {children}
    </>
  );
}

/** Schritte mit Pfeilen – auf dem Handy untereinander. */
function Flow({ parts, color, hidden, accent }: Props) {
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row">
      {parts.map((p, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-2 sm:flex-row">
          <Box accent={accent} part={p} color={color} hidden={hidden} className="w-full flex-1 self-stretch">
            <span
              className="mb-1 inline-grid size-6 place-items-center rounded-full text-xs font-bold text-white"
              style={{ background: color }}
            >
              {i + 1}
            </span>
          </Box>
          {i < parts.length - 1 && (
            <>
              <ArrowDown className="size-4 shrink-0 text-muted sm:hidden" />
              <ArrowRight className="hidden size-4 shrink-0 text-muted sm:block" />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

const PILLAR_COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "sm:grid-cols-5",
};

/** Gleichrangige Säulen nebeneinander. */
function Pillars({ parts, color, hidden, accent }: Props) {
  return (
    <div className={cn("grid gap-2", PILLAR_COLS[parts.length] ?? "sm:grid-cols-3")}>
      {parts.map((p, i) => (
        <Box key={i} accent={accent} part={p} color={color} hidden={hidden} className="border-t-4" />
      ))}
    </div>
  );
}

/** Ebenen von breit (oben) nach schmal (unten). */
function Layers({ parts, color, hidden }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      {parts.map((p, i) => (
        <div
          key={i}
          className="w-full rounded-2xl p-3 text-center"
          style={{ maxWidth: `${100 - i * 14}%`, background: alpha(color, 0.18 - i * 0.04) }}
        >
          <p className="text-sm font-semibold" style={{ color }}>
            {q(hidden, p.label)}
          </p>
          <Points points={p.points} hidden={hidden} />
        </div>
      ))}
    </div>
  );
}

/** Kacheln mit großem Anfangsbuchstaben – der Buchstabe bleibt im Abfrage-Modus als Gedächtnisstütze. */
function Letters({ parts, color, hidden }: Props) {
  return (
    <div className={cn("grid grid-cols-2 gap-2", parts.length === 6 ? "sm:grid-cols-3" : "sm:grid-cols-4")}>
      {parts.map((p, i) => (
        <div key={i} className="flex gap-3 rounded-2xl border p-3" style={{ borderColor: alpha(color, 0.25), background: alpha(color, 0.05) }}>
          <span className="display text-4xl leading-none" style={{ color }}>
            {p.label.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug">{hidden ? "…" : p.label}</p>
            <Points points={p.points} hidden={hidden} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Lebenszyklus: Kurve über den Phasen, darunter je Phase die Kräfte. */
function Curve({ parts, color, hidden }: Props) {
  const n = parts.length;
  return (
    <div>
      <svg viewBox="0 0 500 130" className="h-auto w-full" role="img" aria-label="Lebenszykluskurve">
        {parts.slice(1).map((_, i) => (
          <line key={i} x1={((i + 1) * 500) / n} x2={((i + 1) * 500) / n} y1="8" y2="122" stroke="var(--line-strong)" strokeDasharray="3 4" />
        ))}
        <path d="M0,118 C60,116 90,108 120,90 S180,30 250,22 S360,20 400,34 S470,72 500,88" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
        <line x1="0" x2="500" y1="124" y2="124" stroke="var(--line-strong)" />
      </svg>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {parts.map((p, i) => (
          <div key={i} className="min-w-0 text-center">
            <p className="text-[0.78rem] font-semibold leading-tight sm:text-sm" style={{ color }}>
              {q(hidden, p.label)}
            </p>
            <Points points={p.points} hidden={hidden} className="text-[0.7rem] sm:text-[0.78rem]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Porters Wertkette: unterstützende Aktivitäten als Balken, primäre als Pfeilkette, Marge an der Spitze. */
function ValueChain({ parts, color, hidden }: Props) {
  const [primary, support, margin] = parts;
  const chevron = "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)";
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1 space-y-1.5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted">{q(hidden, support.label)}</p>
          {support.points.map((s, i) => (
            <div key={i} className="rounded-lg px-3 py-1.5 text-[0.8rem] font-medium" style={{ background: alpha(color, 0.1 + i * 0.02) }}>
              {q(hidden, s)}
            </div>
          ))}
        </div>
        {margin && (
          <div
            className="hidden w-16 shrink-0 items-center justify-center rounded-r-full text-xs font-bold text-white sm:flex"
            style={{ background: color }}
          >
            {q(hidden, margin.label)}
          </div>
        )}
      </div>
      <div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted">{q(hidden, primary.label)}</p>
        <div className="mt-1.5 flex flex-col gap-1.5 sm:flex-row sm:gap-0">
          {primary.points.map((s, i) => (
            <div
              key={i}
              className="flex min-h-12 flex-1 items-center justify-center px-5 py-2 text-center text-[0.78rem] font-semibold leading-tight text-white sm:-ml-1.5 sm:first:ml-0"
              style={{ background: color, opacity: 0.7 + i * 0.075, clipPath: chevron }}
            >
              {q(hidden, s)}
            </div>
          ))}
        </div>
      </div>
      {margin && <Points points={margin.points} hidden={hidden} className="sm:hidden" />}
    </div>
  );
}

/** VRIO als Treppe: bei „nein“ fällt man auf ein Ergebnis, bei „ja“ geht es eine Stufe weiter. */
function Vrio({ parts, color, hidden }: Props) {
  const steps = parts.slice(0, 4);
  const outcomes = parts[4]?.points ?? [];
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-4">
        {steps.map((p, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="flex-1 rounded-2xl border p-3" style={{ borderColor: alpha(color, 0.3), background: alpha(color, 0.06) }}>
              <div className="flex items-center gap-2">
                <span className="display grid size-9 shrink-0 place-items-center rounded-full text-lg text-white" style={{ background: color }}>
                  {p.label.charAt(0)}
                </span>
                <p className="text-sm font-semibold leading-snug">{q(hidden, p.label.replace(/^[A-Z] – /, ""))}</p>
              </div>
              <Points points={p.points} hidden={hidden} />
            </div>
            {outcomes[i] && (
              <div className="flex items-center gap-1.5 rounded-xl bg-bad/10 px-2.5 py-1.5 text-[0.78rem] font-medium text-bad">
                <X className="size-3.5 shrink-0" />
                <span>Nein → {q(hidden, outcomes[i])}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      {outcomes[4] && (
        <div className="flex items-center gap-2 rounded-2xl bg-good/10 px-4 py-3 text-sm font-semibold text-good">
          <Check className="size-4 shrink-0" /> Alle vier ja → {q(hidden, outcomes[4])}
        </div>
      )}
    </div>
  );
}

/** Pro und Contra nebeneinander. */
function Versus({ parts, hidden }: Props) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {parts.slice(0, 2).map((p, i) => {
        const good = i === 0;
        return (
          <div key={i} className={cn("rounded-2xl p-3", good ? "bg-good/10" : "bg-bad/10")}>
            <p className={cn("flex items-center gap-1.5 text-sm font-semibold", good ? "text-good" : "text-bad")}>
              {good ? <Check className="size-4" /> : <X className="size-4" />} {q(hidden, p.label)}
            </p>
            <Points points={p.points} hidden={hidden} />
          </div>
        );
      })}
    </div>
  );
}

/** Bausteine auf einer Skala (z. B. langsame bis schnelle Märkte). */
function Spectrum({ parts, visual, color, hidden, accent }: Props) {
  const [from = "", to = ""] = visual.x ?? [];
  return (
    <div>
      <div className="flex items-center justify-between text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted">
        <span>{from}</span>
        <span>{to}</span>
      </div>
      <div className="mt-1.5 h-2.5 rounded-full" style={{ background: `linear-gradient(90deg, ${alpha(color, 0.15)}, ${color})` }} />
      <div className={cn("mt-3 grid gap-2", PILLAR_COLS[parts.length] ?? "sm:grid-cols-3")}>
        {parts.map((p, i) => (
          <Box key={i} accent={accent} part={p} color={color} hidden={hidden} />
        ))}
      </div>
    </div>
  );
}

/** Umgekehrtes U mit drei Markierungen (optimale Distinktheit, Middle-status conformity). */
function Hump({ visual, color, hidden }: Props) {
  const [left = "", peak = "", right = ""] = visual.marks ?? [];
  const [xl = ""] = visual.x ?? [];
  const [yl = ""] = visual.y ?? [];
  return (
    <figure>
      <svg viewBox="0 0 500 190" className="h-auto w-full" role="img" aria-label={`${yl} über ${xl}`}>
        <line x1="40" x2="490" y1="160" y2="160" stroke="var(--line-strong)" />
        <line x1="40" x2="40" y1="10" y2="160" stroke="var(--line-strong)" />
        <path d="M50,150 C150,145 180,30 265,30 S380,145 480,150" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="265" cy="30" r="6" fill={color} />
        <text x="265" y="180" textAnchor="middle" fontSize="13" fill="var(--muted)">
          {xl}
        </text>
        <text x="16" y="85" textAnchor="middle" fontSize="13" fill="var(--muted)" transform="rotate(-90 16 85)">
          {yl}
        </text>
      </svg>
      <div className="grid grid-cols-3 gap-2 text-center text-[0.78rem] leading-snug sm:text-sm">
        <p className="text-ink-2">{q(hidden, left)}</p>
        <p className="font-semibold" style={{ color }}>
          {q(hidden, peak)}
        </p>
        <p className="text-ink-2">{q(hidden, right)}</p>
      </div>
    </figure>
  );
}

/** Wertsystem: Lieferant ← Firma → Kunde, mit Rückwärts- und Vorwärtsintegration. */
function Vertical({ visual, color, hidden }: Props) {
  const [up = "Suppliers", firm = "Firm", down = "Buyers"] = visual.marks ?? [];
  const node = "rounded-2xl px-3 py-3 text-center text-sm font-semibold";
  return (
    <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1.5 sm:gap-3">
      <div className={node} style={{ background: alpha(color, 0.08) }}>
        {up}
      </div>
      <Arrow label={q(hidden, "backward")} dir="left" />
      <div className={cn(node, "text-white")} style={{ background: color }}>
        {firm}
      </div>
      <Arrow label={q(hidden, "forward")} dir="right" />
      <div className={node} style={{ background: alpha(color, 0.08) }}>
        {down}
      </div>
    </div>
  );
}

function Arrow({ label, dir }: { label: string; dir: "left" | "right" }) {
  const Icon = dir === "left" ? ArrowLeft : ArrowRight;
  return (
    <div className="flex flex-col items-center text-[0.68rem] font-semibold uppercase tracking-wide text-muted">
      <Icon className="size-4" />
      {label}
    </div>
  );
}

/** Drei überlappende Kreise (Triple Bottom Line); Unterpunkte je Kreis darunter. */
function Venn({ parts, color, hidden, accent }: Props) {
  const stroke = accent ?? color;
  const circles = [
    { cx: 250, cy: 92, tx: 250, ty: 62 },
    { cx: 192, cy: 182, tx: 150, ty: 205 },
    { cx: 308, cy: 182, tx: 350, ty: 205 },
  ];
  return (
    <div>
      <svg viewBox="0 0 500 290" className="mx-auto h-auto w-full max-w-md" role="img" aria-label="Venn-Diagramm">
        {circles.map((c, i) => (
          <circle key={i} cx={c.cx} cy={c.cy} r="88" fill={alpha(stroke, 0.1)} stroke={stroke} strokeWidth="2.5" />
        ))}
        {parts.slice(0, 3).map((p, i) => (
          <text key={i} x={circles[i].tx} y={circles[i].ty} textAnchor="middle" fontSize="17" fontWeight="700" fill={color}>
            {q(hidden, p.label)}
          </text>
        ))}
      </svg>
      {!hidden && (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {parts.slice(0, 3).map((p, i) => (
            <div key={i} className="text-center">
              <p className="text-sm font-semibold" style={{ color }}>
                {p.label}
              </p>
              <Points points={p.points} hidden={hidden} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Dreieck mit drei Ecken – ein Spannungsfeld, in dem jede Verbesserung an einer Ecke eine andere kostet. */
function Triangle({ parts, color, hidden, accent }: Props) {
  const [top, left, right] = parts;
  const label = accent ? "#b0124f" : color;
  return (
    <div>
      <svg viewBox="0 0 500 250" className="mx-auto h-auto w-full max-w-md" role="img" aria-label="Dreieck">
        <polygon points="250,40 70,215 430,215" fill={alpha(accent ?? color, 0.12)} stroke={color} strokeWidth="2" strokeLinejoin="round" />
        <polyline points="250,40 250,150 70,215" fill="none" stroke={color} strokeWidth="1.5" opacity="0.6" />
        <line x1="250" y1="150" x2="430" y2="215" stroke={color} strokeWidth="1.5" opacity="0.6" />
        {[
          [top, 250, 26, "middle"],
          [left, 70, 240, "start"],
          [right, 430, 240, "end"],
        ].map(([p, x, y, anchor], i) =>
          p ? (
            <text key={i} x={x as number} y={y as number} textAnchor={anchor as "middle"} fontSize="18" fontWeight="700" fill={label}>
              {q(hidden, (p as Part).label)}
            </text>
          ) : null,
        )}
      </svg>
      {!hidden && (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {[left, top, right].filter(Boolean).map((p, i) => (
            <div key={i} className="rounded-md p-3" style={{ background: alpha(accent ?? color, 0.12) }}>
              <p className="text-sm font-semibold" style={{ color: label }}>
                {p!.label}
              </p>
              <Points points={p!.points} hidden={hidden} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepArrow({ className }: { className?: string }) {
  return (
    <span className={cn("grid place-items-center text-muted", className)}>
      <ArrowDown className="size-4 sm:hidden" />
      <ArrowRight className="hidden size-4 sm:block" />
    </span>
  );
}

/** Harvard-Modell (Beer et al.): Stakeholder & Situation → Policy choices → HR outcomes → Long-term consequences. */
function Harvard({ parts, color, hidden, accent }: Props) {
  const [stake, situation, policy, outcomes, consequences] = parts;
  const box = { color, hidden, accent };
  return (
    <div>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-2 sm:w-[30%]">
          {stake && <Box part={stake} {...box} />}
          {situation && <Box part={situation} {...box} />}
        </div>
        <StepArrow />
        {policy && <Box part={policy} {...box} strong className="sm:flex-1" />}
        <StepArrow />
        {outcomes && <Box part={outcomes} {...box} className="sm:flex-1" />}
        <StepArrow />
        {consequences && <Box part={consequences} {...box} className="sm:flex-1" />}
      </div>
      <p className="mt-2 flex items-center justify-center gap-2 border-t border-dashed pt-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-muted" style={{ borderColor: alpha(color, 0.5) }}>
        <ArrowLeft className="size-3.5" /> {q(hidden, "Feedback: consequences change stakeholder interests and situational factors")}
      </p>
    </div>
  );
}

/** Quelle links → Stapel in der Mitte → Ziel rechts (individueller HR-Zyklus). */
function Branch({ parts, visual, color, hidden, accent }: Props) {
  const source = parts[0];
  const middle = parts.slice(1, -1);
  const sink = parts.length > 2 ? parts[parts.length - 1] : undefined;
  const pre = visual.marks?.[0];
  const box = { color, hidden, accent };
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      <div className="flex flex-col gap-2 sm:w-1/3">
        {pre && (
          <div className="rounded-md border px-3 py-2 text-sm font-semibold" style={{ borderColor: alpha(color, 0.45), background: alpha(accent ?? color, 0.6), color }}>
            {q(hidden, pre)}
          </div>
        )}
        {source && <Box part={source} {...box} strong />}
      </div>
      <StepArrow />
      <div className="flex flex-col gap-2 sm:flex-1">
        {middle.map((p, i) => (
          <Box key={i} part={p} {...box} />
        ))}
      </div>
      {sink && (
        <>
          <StepArrow />
          <Box part={sink} {...box} className="sm:w-1/4" />
        </>
      )}
    </div>
  );
}

/** Raute: oben → zwei Seiten → unten (Job analysis → IC & EC → Salary structure). */
function Diamond({ parts, color, hidden, accent }: Props) {
  const [top, left, right, bottom] = parts;
  const box = { color, hidden, accent };
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-2">
      {top && <Box part={top} {...box} strong className="w-full text-center sm:w-2/3" />}
      <div className="flex w-full justify-around text-muted">
        <ArrowDown className="size-4 -rotate-[30deg]" />
        <ArrowDown className="size-4 rotate-[30deg]" />
      </div>
      <div className="grid w-full grid-cols-2 gap-2">
        {left && <Box part={left} {...box} />}
        {right && <Box part={right} {...box} />}
      </div>
      <div className="flex w-full justify-around text-muted">
        <ArrowDown className="size-4 rotate-[30deg]" />
        <ArrowDown className="size-4 -rotate-[30deg]" />
      </div>
      {bottom && <Box part={bottom} {...box} strong className="w-full text-center sm:w-2/3" />}
    </div>
  );
}

/** Vroom: Effort → Performance → Outcome, die drei Verbindungen als Beschriftung, darunter die Motivation. */
function Expectancy({ parts, color, hidden, accent }: Props) {
  const nodes = ["Effort", "Performance", "Outcome"];
  const fill = accent ?? color;
  const node = "rounded-md border px-3 py-3 text-center text-sm font-bold";
  return (
    <div className="space-y-3">
      <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto]">
        {nodes.map((n, i) => (
          <div key={n} className="contents">
            <div className={node} style={{ borderColor: alpha(color, 0.5), background: alpha(fill, 0.35), color }}>
              {n}
            </div>
            <div className="flex flex-col items-center px-1 text-center">
              {i < 2 ? <StepArrow /> : <span className="text-lg font-bold text-muted">✓</span>}
              <span className="text-[0.72rem] font-bold uppercase tracking-wide" style={{ color }}>
                {q(hidden, parts[i]?.label ?? "")}
              </span>
            </div>
          </div>
        ))}
      </div>
      {!hidden && (
        <div className="grid gap-2 sm:grid-cols-3">
          {parts.slice(0, 3).map((p, i) => (
            <p key={i} className="rounded-md px-3 py-2 text-[0.8rem] italic leading-snug text-ink-2" style={{ background: alpha(color, 0.05) }}>
              {p.points[p.points.length - 1]}
            </p>
          ))}
        </div>
      )}
      <div className="rounded-md px-4 py-2.5 text-center text-sm font-bold text-white" style={{ background: color }}>
        Motivation = {q(hidden, "Expectancy × Instrumentality × Valence")}
      </div>
    </div>
  );
}

/** Entscheidungsachsen: „A vs B“ wird zu zwei Polen mit Regler dazwischen. */
function Sliders({ parts, color, hidden, accent }: Props) {
  return (
    <div className="space-y-3">
      {parts.map((p, i) => {
        const [a, b = ""] = p.label.split(/\s+vs\.?\s+/i);
        return (
          <div key={i}>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(3rem,2fr)_minmax(0,1fr)] items-center gap-2 sm:gap-3">
              <p className="text-right text-sm font-semibold leading-tight" style={{ color }}>
                {q(hidden, a)}
              </p>
              <div className="relative h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${alpha(color, 0.7)}, ${alpha(accent ?? color, 0.7)})` }}>
                <span className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-surface" style={{ borderColor: color }} />
              </div>
              <p className="text-sm font-semibold leading-tight" style={{ color }}>
                {q(hidden, b)}
              </p>
            </div>
            <Points points={p.points} hidden={hidden} className="text-center" />
          </div>
        );
      })}
    </div>
  );
}

const VIEWS: Record<Visual["type"], (p: Props) => React.ReactNode> = {
  forces: Forces,
  quad: Quad,
  flow: Flow,
  pillars: Pillars,
  layers: Layers,
  letters: Letters,
  curve: Curve,
  valuechain: ValueChain,
  vrio: Vrio,
  versus: Versus,
  spectrum: Spectrum,
  hump: Hump,
  vertical: Vertical,
  venn: Venn,
  triangle: Triangle,
  harvard: Harvard,
  branch: Branch,
  diamond: Diamond,
  expectancy: Expectancy,
  sliders: Sliders,
};
