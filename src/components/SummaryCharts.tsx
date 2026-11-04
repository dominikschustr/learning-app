import { ArrowDownLeft, ArrowDownRight, ArrowLeftRight, ArrowRight } from "lucide-react";
import type { SummaryBlock } from "@/lib/summary";
import { Fragment } from "react";
import { alpha, cn } from "@/lib/utils";

/** **fett** im Fließtext */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold text-ink">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

/** Diagramm-Bausteine der Zusammenfassungen (reine Server-Komponenten, SVG bzw. CSS). */

type Of<T extends SummaryBlock["type"]> = Extract<SummaryBlock, { type: T }>;

/** Farben für Gruppen (Cluster, Datenreihen); Gruppe 0 = Fachfarbe */
export function groupColor(color: string, i: number) {
  return [color, "#0f9d8a", "#e8833a", "#3b82f6", "#e0457b", "#8a8378"][i % 6];
}

const fmt = (v: number, unit = "") => {
  const abs = Math.abs(v);
  const s = abs >= 1000 ? abs.toLocaleString("en-US", { maximumFractionDigits: 0 }) : String(Math.round(abs * 100) / 100);
  return `${v < 0 ? "−" : ""}${s}${unit}`;
};

function Figure({ title, caption, children }: { title?: string; caption?: string; children: React.ReactNode }) {
  return (
    <figure className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      {title && <figcaption className="mb-3 text-sm font-semibold text-ink">{title}</figcaption>}
      {children}
      {caption && (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          <Rich text={caption} />
        </p>
      )}
    </figure>
  );
}

/* ---------- Streudiagramm mit Regressionsgerade ---------- */

/** Runde Achsenschritte (1, 2, 2.5, 5 × 10^n), die den Bereich lo–hi abdecken */
function niceTicks(lo: number, hi: number, count = 4): number[] {
  const raw = (hi - lo || 1) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const start = Math.floor(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + step * 0.999; v += step) out.push(Math.round(v / step) * step);
  return out;
}

export function Scatter({ b, color }: { b: Of<"scatter">; color: string }) {
  const W = 420;
  const H = 260;
  const pad = { l: 64, r: 14, t: 14, b: 40 };
  const xs = b.points.map((p) => p[0]);
  const ys = b.points.map((p) => p[1]);
  const xt = niceTicks(Math.min(...xs), Math.max(...xs));
  const [x0, x1] = [xt[0], xt[xt.length - 1]];
  const lineYs = b.line ? [b.line[0] + b.line[1] * x0, b.line[0] + b.line[1] * x1] : [];
  const yt = niceTicks(Math.min(...ys, ...lineYs), Math.max(...ys, ...lineYs));
  const [y0, y1] = [yt[0], yt[yt.length - 1]];
  const sx = (x: number) => pad.l + ((x - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const sy = (y: number) => H - pad.b - ((y - y0) / (y1 - y0)) * (H - pad.t - pad.b);
  const r = b.residual !== undefined ? b.points[b.residual] : undefined;
  const yHat = r && b.line ? b.line[0] + b.line[1] * r[0] : undefined;
  const labelLeft = r ? sx(r[0]) > W * 0.65 : false;

  return (
    <Figure title={b.title} caption={b.caption}>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-xl" role="img" aria-label={b.title ?? "Streudiagramm"}>
        {yt.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke="var(--line)" />
            <text x={pad.l - 6} y={sy(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">
              {fmt(t)}
            </text>
          </g>
        ))}
        {xt.map((t, i) => (
          <text key={i} x={sx(t)} y={H - pad.b + 14} textAnchor="middle" fontSize="10" fill="var(--muted)">
            {fmt(t)}
          </text>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--line-strong)" />
        <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="var(--line-strong)" />
        <text x={(W + pad.l) / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--ink-2)" fontWeight="600">
          {b.xLabel}
        </text>
        <text
          x={14}
          y={(H - pad.b) / 2}
          textAnchor="middle"
          fontSize="11"
          fill="var(--ink-2)"
          fontWeight="600"
          transform={`rotate(-90 14 ${(H - pad.b) / 2})`}
        >
          {b.yLabel}
        </text>
        {b.line && (
          <line x1={sx(x0)} y1={sy(lineYs[0])} x2={sx(x1)} y2={sy(lineYs[1])} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        )}
        {b.points.map((p, i) => (
          <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r="4.5" fill={alpha(color, 0.25)} stroke={color} strokeWidth="1.5" />
        ))}
        {r && yHat !== undefined && (
          <g>
            <line x1={sx(r[0])} x2={sx(r[0])} y1={sy(r[1])} y2={sy(yHat)} stroke="var(--bad)" strokeWidth="2" strokeDasharray="4 3" />
            <text
              x={sx(r[0]) + (labelLeft ? -6 : 6)}
              y={(sy(r[1]) + sy(yHat)) / 2 + 3}
              textAnchor={labelLeft ? "end" : "start"}
              fontSize="10.5"
              fill="var(--bad)"
              fontWeight="600"
              stroke="var(--surface)"
              strokeWidth="3"
              paintOrder="stroke"
            >
              residual e = y − ŷ
            </text>
          </g>
        )}
      </svg>
    </Figure>
  );
}

/* ---------- Fünf Korrelationsmuster ---------- */

export function Correlation({ b, color }: { b: Of<"correlation">; color: string }) {
  // feste Pseudo-Zufallswerte, damit Server und Client dasselbe zeichnen
  const noise = [0.31, -0.42, 0.12, 0.47, -0.2, -0.36, 0.05, 0.4, -0.48, 0.22, -0.09, 0.33];
  const cases: { r: string; label: string; f: (x: number, i: number) => number }[] = [
    { r: "r = +1", label: "perfect positive", f: (x) => x },
    { r: "r > 0", label: "positive", f: (x, i) => x + noise[i] * 0.7 },
    { r: "r = 0", label: "no linear relation", f: (_x, i) => 0.5 + noise[(i * 5) % 12] * 1.6 },
    { r: "r < 0", label: "negative", f: (x, i) => 1 - x + noise[i] * 0.7 },
    { r: "r = −1", label: "perfect negative", f: (x) => 1 - x },
  ];
  return (
    <Figure caption={b.caption}>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {cases.map((c) => (
          <div key={c.r} className="text-center">
            <svg viewBox="0 0 100 100" className="w-full rounded-xl bg-surface-2">
              {noise.map((_, i) => {
                const x = i / 11;
                const y = Math.min(1, Math.max(0, c.f(x, i)));
                return <circle key={i} cx={10 + x * 80} cy={90 - y * 80} r="4" fill={color} opacity="0.75" />;
              })}
            </svg>
            <p className="mt-1.5 text-sm font-semibold tabular-nums text-ink">{c.r}</p>
            <p className="text-xs text-muted">{c.label}</p>
          </div>
        ))}
      </div>
    </Figure>
  );
}

/* ---------- Balken (auch negativ) ---------- */

export function Bars({ b, color }: { b: Of<"bars">; color: string }) {
  const max = Math.max(...b.items.map((i) => Math.abs(i.value)), 1e-9);
  const hasNeg = b.items.some((i) => i.value < 0);
  return (
    <Figure title={b.title} caption={b.caption}>
      <div className="space-y-2.5">
        {b.items.map((it, i) => {
          const w = (Math.abs(it.value) / max) * (hasNeg ? 42 : 84);
          const neg = it.value < 0;
          return (
            <div key={i} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
              <p className="text-sm leading-tight text-ink-2">
                {it.label}
                {it.note && <span className="block text-xs text-muted">{it.note}</span>}
              </p>
              <div className="relative h-7 rounded-lg bg-surface-2">
                {hasNeg && <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />}
                <span
                  className="absolute inset-y-1 rounded-md"
                  style={{
                    width: `${Math.max(w, 0.8)}%`,
                    left: hasNeg ? (neg ? `${50 - w}%` : "50%") : 0,
                    background: neg ? "var(--bad)" : color,
                    opacity: 0.85,
                  }}
                />
                <span
                  className="absolute inset-y-0 flex items-center px-1.5 text-xs font-semibold tabular-nums text-ink"
                  style={hasNeg ? (neg ? { right: "50%", marginRight: `${w}%` } : { left: `${50 + w}%` }) : { left: `${w}%` }}
                >
                  {fmt(it.value, b.unit)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Figure>
  );
}

/* ---------- Wasserfall ---------- */

export function Waterfall({ b, color }: { b: Of<"waterfall">; color: string }) {
  // laufende Summe: Summenbalken starten bei 0, alle anderen am Ende des vorigen Balkens
  const ends = b.items.reduce<number[]>((acc, it, i) => [...acc, it.total ? it.value : (acc[i - 1] ?? 0) + it.value], []);
  const bars = b.items.map((it, i) => {
    const start = it.total ? 0 : (ends[i - 1] ?? 0);
    const end = ends[i];
    return { ...it, lo: Math.min(start, end), hi: Math.max(start, end) };
  });
  const top = Math.max(...bars.map((x) => x.hi), 1e-9);
  const bottom = Math.min(0, ...bars.map((x) => x.lo));
  const range = top - bottom;
  return (
    <Figure title={b.title} caption={b.caption}>
      <div className="mt-6 flex h-56 items-stretch gap-2 sm:gap-3">
        {bars.map((x, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col">
            <div className="relative flex-1">
              <div
                className="absolute inset-x-0 rounded-md"
                style={{
                  bottom: `${((x.lo - bottom) / range) * 100}%`,
                  height: `${Math.max(((x.hi - x.lo) / range) * 100, 1)}%`,
                  background: x.total ? color : x.value < 0 ? "var(--bad)" : "var(--good)",
                  opacity: x.total ? 0.9 : 0.75,
                }}
              />
              <span
                className="absolute inset-x-0 text-center text-xs font-semibold tabular-nums text-ink"
                style={{ bottom: `calc(${((x.hi - bottom) / range) * 100}% + 2px)` }}
              >
                {x.total ? fmt(x.value, b.unit) : `${x.value >= 0 ? "+" : ""}${fmt(x.value, b.unit)}`}
              </span>
            </div>
            <p className="mt-2 min-h-8 text-center text-[0.72rem] leading-tight text-ink-2 sm:text-xs">{x.label}</p>
          </div>
        ))}
      </div>
    </Figure>
  );
}

/* ---------- Trichter ---------- */

export function Funnel({ b, color }: { b: Of<"funnel">; color: string }) {
  const n = b.stages.length;
  return (
    <Figure title={b.title} caption={b.caption}>
      <div className="space-y-1.5">
        {b.stages.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr] items-center gap-x-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div
              className="mx-auto rounded-xl px-3 py-2.5 text-center"
              style={{ width: `${100 - (i * 55) / Math.max(n - 1, 1)}%`, background: alpha(color, 0.1 + (i / n) * 0.3) }}
            >
              <p className="text-sm font-semibold" style={{ color }}>
                {s.label}
              </p>
              {s.tag && <p className="text-xs font-semibold tabular-nums text-ink">{s.tag}</p>}
            </div>
            {s.text && <p className="mt-1 text-sm leading-snug text-ink-2 sm:mt-0">{s.text}</p>}
          </div>
        ))}
      </div>
    </Figure>
  );
}

/* ---------- Positionierungs- / Cluster-Karte ---------- */

export function PositionMap({ b, color }: { b: Of<"map">; color: string }) {
  const S = 320;
  const m = 34;
  const px = (x: number) => S / 2 + x * (S / 2 - m);
  const py = (y: number) => S / 2 - y * (S / 2 - m);
  const groups = [...new Set(b.points.map((p) => p.group ?? 0))];
  const cent = groups.map((g) => {
    const ps = b.points.filter((p) => (p.group ?? 0) === g);
    const cx = ps.reduce((s, p) => s + p.x, 0) / ps.length;
    const cy = ps.reduce((s, p) => s + p.y, 0) / ps.length;
    const rad = Math.max(...ps.map((p) => Math.hypot(px(p.x) - px(cx), py(p.y) - py(cy)))) + 14;
    return { g, cx, cy, rad };
  });
  return (
    <Figure title={b.title} caption={b.caption}>
      <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto w-full max-w-md" role="img" aria-label={b.title ?? "Karte"}>
        <rect x="0" y="0" width={S} height={S} rx="16" fill="var(--surface-2)" />
        <line x1={m - 10} x2={S - m + 10} y1={S / 2} y2={S / 2} stroke="var(--line-strong)" />
        <line y1={m - 10} y2={S - m + 10} x1={S / 2} x2={S / 2} stroke="var(--line-strong)" />
        {(
          [
            [8, S / 2 + 15, "start", b.x[0]],
            [S - 8, S / 2 + 15, "end", b.x[1]],
            [S / 2 + 6, 16, "start", b.y[1]],
            [S / 2 + 6, S - 8, "start", b.y[0]],
          ] as const
        ).map(([x, y, anchor, label]) => (
          <text
            key={label + x}
            x={x}
            y={y}
            fontSize="10"
            fill="var(--muted)"
            fontWeight="600"
            textAnchor={anchor}
            stroke="var(--surface-2)"
            strokeWidth="4"
            paintOrder="stroke"
          >
            {label}
          </text>
        ))}
        {b.centroids &&
          cent.map((c) => (
            <g key={c.g}>
              <circle
                cx={px(c.cx)}
                cy={py(c.cy)}
                r={c.rad}
                fill={alpha(groupColor(color, c.g), 0.08)}
                stroke={groupColor(color, c.g)}
                strokeDasharray="4 4"
              />
              <path
                d={`M${px(c.cx) - 5} ${py(c.cy) - 5} l10 10 M${px(c.cx) + 5} ${py(c.cy) - 5} l-10 10`}
                stroke={groupColor(color, c.g)}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>
          ))}
        {b.points.map((p, i) => {
          const c = groupColor(color, p.group ?? 0);
          return (
            <g key={i}>
              <circle cx={px(p.x)} cy={py(p.y)} r={b.centroids ? 3.5 : 6} fill={c} />
              {p.label !== "·" && (
                <text
                  x={px(p.x) + 9}
                  y={py(p.y) + 4}
                  fontSize="11"
                  fill="var(--ink)"
                  fontWeight="600"
                  stroke="var(--surface-2)"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {b.groups.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {b.groups.map((g, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-sm text-ink-2">
              <span className="size-2.5 rounded-full" style={{ background: groupColor(color, i) }} />
              {g}
            </span>
          ))}
        </div>
      )}
    </Figure>
  );
}

/* ---------- Liniendiagramm ---------- */

export function LineChart({ b, color }: { b: Of<"line">; color: string }) {
  const W = 420;
  const H = 220;
  const pad = { l: 44, r: 30, t: 18, b: 30 };
  const yt = niceTicks(0, Math.max(...b.series.flatMap((s) => s.values), 1e-9));
  const max = yt[yt.length - 1];
  const n = b.xTicks.length;
  const sx = (i: number) => pad.l + 20 + (i / (n - 1)) * (W - pad.l - pad.r - 20);
  const sy = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);
  return (
    <Figure title={b.title} caption={b.caption}>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-xl" role="img" aria-label={b.title ?? "Liniendiagramm"}>
        {yt.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke="var(--line)" />
            <text x={pad.l - 6} y={sy(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">
              {fmt(t, b.unit)}
            </text>
          </g>
        ))}
        {b.xTicks.map((t, i) => (
          <text key={i} x={sx(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="var(--muted)">
            {t}
          </text>
        ))}
        {b.series.map((s, si) => {
          const c = groupColor(color, si);
          return (
            <g key={si}>
              <polyline
                points={s.values.map((v, i) => `${sx(i)},${sy(v)}`).join(" ")}
                fill="none"
                stroke={c}
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              {s.values.map((v, i) => (
                <g key={i}>
                  <circle cx={sx(i)} cy={sy(v)} r="4" fill="var(--surface)" stroke={c} strokeWidth="2" />
                  <text x={sx(i)} y={sy(v) - 9} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--ink)">
                    {fmt(v, b.unit)}
                  </text>
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      {b.series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {b.series.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-sm text-ink-2">
              <span className="h-0.5 w-4 rounded" style={{ background: groupColor(color, i) }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </Figure>
  );
}

/* ---------- Kausal-Diagramme ---------- */

function Node({ children, color, dashed }: { children: React.ReactNode; color: string; dashed?: boolean }) {
  return (
    <span
      className={cn("rounded-xl border px-2.5 py-1.5 text-center text-sm font-semibold leading-tight", dashed && "border-dashed")}
      style={{ borderColor: alpha(color, 0.5), background: alpha(color, 0.08), color }}
    >
      {children}
    </span>
  );
}

export function Causal({ b, color }: { b: Of<"causal">; color: string }) {
  return (
    <div className={cn("grid gap-3", b.items.length > 1 && "sm:grid-cols-2", b.items.length > 2 && "lg:grid-cols-3")}>
      {b.items.map((it, i) => (
        <figure key={i} className="flex flex-col rounded-2xl border border-line bg-surface p-4">
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-2">
            {it.variant === "confounder" ? (
              <>
                <Node color="var(--warn)" dashed>
                  {it.z}
                </Node>
                <div className="flex w-full max-w-56 justify-between px-6 text-warn">
                  <ArrowDownLeft className="size-5" />
                  <ArrowDownRight className="size-5" />
                </div>
                <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <Node color={color}>{it.x}</Node>
                  <span className="text-xs font-semibold text-muted">· · ·</span>
                  <Node color={color}>{it.y}</Node>
                </div>
              </>
            ) : (
              <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
                <Node color={color}>{it.x}</Node>
                {it.variant === "reverse" ? (
                  <ArrowLeftRight className="size-5 text-bad" />
                ) : (
                  <ArrowRight className="size-5" style={{ color }} />
                )}
                <Node color={color}>{it.y}</Node>
              </div>
            )}
          </div>
          <figcaption className="mt-3 border-t border-line pt-3 text-sm leading-snug text-ink-2">
            <Rich text={it.caption} />
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
