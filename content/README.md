# Inhalte und neue Fächer

Jedes Fach ist ein Ordner unter `content/subjects/<id>/`. Code muss für ein neues Fach nicht geändert werden.

```
content/subjects/<id>/
  subject.json        Name, Kürzel, Farbe, Kapitel, Prüfungsformat
  sources/            Vorlesungsdokumente (.docx) – Grundlage für Fragen, Karten und Lesetexte
  questions/<kap>.json  Übungs- und Prüfungsfragen je Kapitel
  cards/<kap>.json      Karteikarten je Kapitel
  texts/<kap>.json      Lesetext je Kapitel (optional, aus sources/ erzeugt)
```

## Neues Fach in 5 Schritten

1. **Anlegen:** `npm run new-subject -- corporate-finance "Corporate Finance" CF`
   (id nur `a-z`, `0-9`, `-`; Kürzel höchstens 4 Zeichen). Das Fach startet als **Entwurf**
   (`"draft": true`): Es wird geprüft, erscheint aber noch nicht in der App.
2. **Dokumente ablegen:** Vorlesungsdokumente nach `sources/`. Am einfachsten beginnt der Dateiname mit
   der Kapitel-id, z. B. `l01 Einführung.docx`, `l02 Kapitalkosten.docx`.
3. **`subject.json` ausfüllen:** Kapitel (`lectures`), Beschreibung, Prüfungsformat (`examFormat`:
   Dauer in Minuten und Anzahl Kurzantwort-, Multiple-Choice- und Wahr/Falsch-Fragen der echten Prüfung).
4. **Fragen und Karten erstellen lassen**, z. B. mit diesem Auftrag an Claude:
   > Erstelle für das Fach `corporate-finance` aus den Dokumenten in `sources/` je Kapitel Fragen und
   > Karteikarten nach content/README.md und dem Beispiel management-control. Erzeuge die Lesetexte mit
   > `python3 scripts/import_texts.py corporate-finance`, prüfe mit `npm test` und setze danach `"draft": false`.
5. **Veröffentlichen:** `"draft": false`, `npm test`, committen und auf `main` pushen. GitHub baut die Seite
   neu, nach ca. 2 Minuten ist das Fach online.

Tipp: Pro Kapitel etwa 6–10 Multiple Choice, 5–8 Wahr/Falsch, 1–3 Kurzantworten und 8–15 Karteikarten.
Für die Prüfungssimulation braucht ein sichtbares Fach mindestens so viele Fragen jeder Art, wie
`examFormat` verlangt – sonst bricht `npm test` mit einer genauen Meldung ab.

## Formate

`subject.json`

```json
{
  "id": "corporate-finance",
  "name": "Corporate Finance",
  "short": "CF",
  "color": "#16865B",
  "description": "Klausur: Kapitalkosten, Bewertung, Kapitalstruktur.",
  "draft": false,
  "lectures": [
    { "id": "l01", "title": "L01 · Einführung" },
    { "id": "l02", "title": "L02 · Kapitalkosten" }
  ],
  "examFormat": { "name": "Klausur", "minutes": 60, "short": 1, "mc": 10, "tf": 5 }
}
```

`questions/l01.json` – drei Fragetypen, ids im ganzen Fach eindeutig, `lecture` = Kapitel-id:

```json
[
  {
    "type": "mc", "id": "mc-l01-01", "lecture": "l01", "difficulty": 2,
    "prompt": "Welche Aussagen sind richtig?",
    "options": [{ "id": "a", "text": "…" }, { "id": "b", "text": "…" }, { "id": "c", "text": "…" }],
    "correct": ["a", "c"],
    "explanation": "Warum a und c stimmen."
  },
  { "type": "tf", "id": "tf-l01-01", "lecture": "l01", "statement": "…", "answer": false, "explanation": "…" },
  {
    "type": "short", "id": "sa-l01-01", "lecture": "l01", "verb": "define",
    "prompt": "Define …", "modelAnswer": "…", "keyPoints": ["Kernpunkt 1", "Kernpunkt 2"]
  }
]
```

`difficulty` 1–3 (3 gibt Bonus-XP), `verb` ist `define`, `state`, `explain` oder `calculate`.
MC-Fragen mit `"single": true` sind Single Choice (genau eine richtige Option, Radio-Buttons).

`cases/l01.json` – optional: Fallbeschreibungen mit Tabellen wie in der Prüfung. Fragen verweisen mit
`"case": "<id>"` darauf; der Fall steht dann über der Frage, im Test folgen Fragen desselben Falls direkt
aufeinander, und die KI-Bewertung bekommt den Fall mitgeliefert.

```json
[{
  "id": "viu-chips", "title": "Value-in-use: chips",
  "text": ["Absatz 1 …", "Absatz 2 …"],
  "tables": [{ "caption": "optional", "head": ["", "Version A", "Version B"], "rows": [["Visitors", "20,000", "20,000"]] }]
}]
```

Die Reihenfolge der Teile im Abschlusstest legt `examFormat.order` fest (Standard `["short", "mc", "tf"]`,
Marketing z. B. `["tf", "mc", "short"]` wie die echte Klausur).

`cards/l01.json`

```json
[{ "id": "c-l01-01", "lecture": "l01", "front": "Begriff", "back": "Erklärung" }]
```

Die genauen Regeln stehen in `src/lib/schema.ts`; `npm test` meldet Fehler mit Datei und Grund.
