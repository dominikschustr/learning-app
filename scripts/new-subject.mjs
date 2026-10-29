#!/usr/bin/env node
/**
 * Legt ein neues Fach an: npm run new-subject -- <id> "<Name>" <Kürzel>
 * Beispiel:              npm run new-subject -- corporate-finance "Corporate Finance" CF
 *
 * Erzeugt content/subjects/<id>/ mit subject.json (als Entwurf), leeren Fragen/Karten und einem
 * Ordner sources/ für die Vorlesungsdokumente. Nächste Schritte stehen in content/README.md.
 */
import fs from "node:fs";
import path from "node:path";

const [id, name, short] = process.argv.slice(2);
if (!id || !name || !short) {
  console.error('Aufruf: npm run new-subject -- <id> "<Name>" <Kürzel>\nBeispiel: npm run new-subject -- corporate-finance "Corporate Finance" CF');
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(id)) {
  console.error("Die id darf nur a-z, 0-9 und - enthalten (z. B. corporate-finance).");
  process.exit(1);
}
if (short.length > 4) {
  console.error("Das Kürzel darf höchstens 4 Zeichen haben.");
  process.exit(1);
}

const root = path.join("content", "subjects");
const dir = path.join(root, id);
if (fs.existsSync(dir)) {
  console.error(`${dir} gibt es schon.`);
  process.exit(1);
}

// Farbe, die noch kein anderes Fach hat
const used = new Set(
  fs
    .readdirSync(root)
    .map((d) => path.join(root, d, "subject.json"))
    .filter((f) => fs.existsSync(f))
    .map((f) => JSON.parse(fs.readFileSync(f, "utf8")).color?.toUpperCase()),
);
const palette = ["#2F5BEA", "#16865B", "#C2410C", "#7C3AED", "#DB2777", "#0E7490", "#B45309", "#4D7C0F"];
const color = palette.find((c) => !used.has(c)) ?? palette[used.size % palette.length];

const subject = {
  id,
  name,
  short,
  color,
  description: "",
  draft: true,
  lectures: [{ id: "l01", title: "L01 · Erste Vorlesung" }],
  examFormat: { name: "Klausur", minutes: 60, short: 1, mc: 10, tf: 5 },
};

for (const sub of ["questions", "cards", "texts", "sources"]) fs.mkdirSync(path.join(dir, sub), { recursive: true });
fs.writeFileSync(path.join(dir, "subject.json"), JSON.stringify(subject, null, 2) + "\n");
fs.writeFileSync(path.join(dir, "questions", "l01.json"), "[]\n");
fs.writeFileSync(path.join(dir, "cards", "l01.json"), "[]\n");
fs.writeFileSync(path.join(dir, "sources", ".gitkeep"), "");
fs.writeFileSync(path.join(dir, "texts", ".gitkeep"), "");

console.log(`Angelegt: ${dir} (Entwurf, Farbe ${color})

Nächste Schritte (Details in content/README.md):
  1. Vorlesungsdokumente (.docx) nach ${path.join(dir, "sources")} legen, z. B. "l01 Einführung.docx"
  2. In subject.json Kapitel (lectures), Beschreibung und Prüfungsformat (examFormat) eintragen
  3. Claude bitten, aus den Dokumenten Fragen und Karteikarten zu erstellen
  4. Optional Lesetexte erzeugen: python3 scripts/import_texts.py ${id}
  5. "draft": false setzen, npm test, committen und pushen – fertig.`);
