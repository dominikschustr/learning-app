/**
 * Formel in Unicode mit Tief- und Hochstellung: r_{E}, r_E, σ_annual → Index; σ^{2}, σ^2, (1 + R)^(1/n) → Exponent.
 * Ohne Klammern gilt das folgende Wort (Buchstaben/Ziffern) als Index bzw. Exponent.
 */
export function FormulaText({ text, className }: { text: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  const re = /([_^])(?:\{([^}]*)\}|\(([^)]*)\)|([\p{L}\p{N}]+))/gu;
  let last = 0;
  for (const m of text.matchAll(re)) {
    // „_(“ ist kein Index (kommt in Fließtext nicht als Formel vor)
    if (m[1] === "_" && m[3] !== undefined) continue;
    if (m.index > last) parts.push(text.slice(last, m.index));
    const inner = m[2] ?? m[3] ?? m[4];
    parts.push(m[1] === "_" ? <sub key={m.index}>{inner}</sub> : <sup key={m.index}>{inner}</sup>);
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <span className={className}>{parts}</span>;
}
