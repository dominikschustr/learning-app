import katex from "katex";
import type { Formula } from "./schema";

/** LaTeX → HTML (KaTeX). Wirft bei Syntaxfehlern, damit kaputte Formeln schon beim Build auffallen. */
export function tex(source: string, display = false): string {
  return katex.renderToString(source, { displayMode: display, throwOnError: true, strict: "error" });
}

export type RenderedFormula = Omit<Formula, "vars"> & {
  html: string;
  vars: (Formula["vars"][number] & { html: string })[];
};

/** Formel samt Symbolen vorab rendern – im Browser landet nur fertiges HTML, kein KaTeX. */
export function renderFormula(f: Formula): RenderedFormula {
  return { ...f, html: tex(f.formula, true), vars: f.vars.map((v) => ({ ...v, html: tex(v.symbol) })) };
}
