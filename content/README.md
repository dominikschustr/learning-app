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

`"examDate": "2026-12-16"` (optional) – Klausurtermin. Daraus entstehen der Countdown auf Fach- und Startseite und der
**Prüfungsplan**: alle Klausuren nach Datum, mit Priorität und Anteil der Lernzeit heute (was bis 85 % Readiness fehlt,
geteilt durch die verbleibenden Tage). Prüfungen ohne eigenes Fach in der App stehen in `content/calendar.json`
(`[{ "name": "Human Resource", "date": "2026-11-26" }]`) und erscheinen nur im Plan.

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
Fragen mit `"checkup": true` stammen aus dem Check-up-Quiz am Ende einer Vorlesung. Hat ein Fach solche Fragen,
bekommen Fach- und Kapitelseite die Kachel „Check-up-Fragen“, die nur diese Fragen übt (`practice?mode=checkup`).

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

`exams/*.json` – optional: feste **Probeklausuren** im Aufbau der echten Prüfung. Hat ein Fach Probeklausuren,
ersetzen sie den zufällig gezogenen Abschlusstest (Kapiteltests bleiben). Jede Klausur besteht aus Teilen, die
Teile aus Aufgaben, die Aufgaben aus Fragen (ids aus `questions/`) mit Punkten. Bewertet wird nach Punkten:
True/False und Multiple Choice ganz oder gar nicht, Kurzantworten anteilig nach der Bewertung.

```json
[{
  "id": "mock-2526", "title": "Mock exam 2025/26", "subtitle": "…", "minutes": 90,
  "parts": [
    { "title": "Part A – True/false questions", "instructions": "[2 points in total]",
      "sections": [{ "items": [{ "q": "tf-s01-03", "points": 0.25 }] }] },
    { "title": "Part B – Short exercises", "instructions": "[10 points in total]",
      "sections": [{ "title": "Exercise 1 – Regression", "items": [{ "q": "mc-s09-01", "points": 0.5 }, { "q": "mc-s09-02", "points": 1 }] }] }
  ]
}]
```

Aufgaben mit mehreren Fragen werden a), b), … nummeriert, Aussagen ohne Aufgabentitel 1), 2), ….

Die Reihenfolge der Teile im zufälligen Abschlusstest legt `examFormat.order` fest (Standard `["short", "mc", "tf"]`,
Marketing z. B. `["tf", "mc", "short"]` wie die echte Klausur).

`frameworks/l01.json` – optional: **Framework-Steckbriefe** zum Auswendiglernen. Hat ein Fach welche, bekommt es die Seite
„Framework-Übersicht“ (mit Abfrage-Modus, der die Bausteine verdeckt) und jedes betroffene Kapitel eine Kachel dorthin.

```json
[{
  "id": "five-forces", "lecture": "l01", "name": "Five Forces", "origin": "Porter",
  "purpose": "How attractive is the industry?",
  "parts": [{ "label": "Rivalry", "points": ["Low growth", "High fixed costs"] }],
  "apply": ["Rate each force with case facts"], "pitfalls": ["Growth ≠ attractiveness"],
  "example": "Vacuum cleaners (Dyson case) …"
}]
```

Diagrammtypen für `visual.type`: `forces`, `quad`, `flow`, `pillars`, `layers`, `letters`, `curve`, `valuechain`, `vrio`,
`versus`, `spectrum`, `hump`, `vertical` sowie (seit HR) `venn` (drei Kreise), `triangle` (Spannungsdreieck), `harvard`
(Harvard-Modell, 5 Bausteine), `branch` (Quelle → Stapel → Ziel, `marks[0]` = Kasten über der Quelle), `diamond`
(oben → zwei Seiten → unten), `expectancy` (Effort → Performance → Outcome) und `sliders` (Label „A vs B“ wird zu zwei Polen).
Die Bedeutung steht in `src/lib/schema.ts`.

**Folien-Look:** `"look": "slides"` und `"accent": "#FEC33F"` in `subject.json` lassen Framework-Übersicht und Lesetexte wie
die Vorlesungsfolien aussehen: Titelfolie je Kapitel, Folienblatt mit Rahmen in Lila und Titelbox in `accent`, Diagramme in
den Folienfarben. Die Folien bleiben auch im Dark Mode hell. Beispiel: HR.

Ein Fach kann auch ganz ohne Multiple Choice und True/False auskommen (`"mc": 0, "tf": 0` in `examFormat`, z. B. Strategy):
dann wird nur mit offenen Fragen geübt, Kapiteltests ziehen bis zu drei Kurzantworten, und die Blitzrunde entfällt.

**Rechenaufgaben:** Eine Kurzantwort mit `results` wird zur Rechenaufgabe. Je Ergebnis gibt es ein Eingabefeld; die App
prüft die Zahlen sofort und ohne KI (Toleranz: 0,5 % des Werts, mindestens 0,01, oder `tol` absolut) und zeigt danach
`modelAnswer` als Lösungsweg. Prozent werden als Prozentzahl hinterlegt (`13.8` mit `"unit": "%"`); `0.138` wird dann
ebenfalls als richtig erkannt. Beispiel: Corporate Finance.

```json
{
  "type": "short", "id": "cf-l4-01", "lecture": "l4", "verb": "calculate",
  "prompt": "rf = 3 %, market risk premium 6 %, beta 1.4. Required return?",
  "modelAnswer": "3% + 1.4 × 6% = 11.40%", "keyPoints": ["Required return 11.4 %"],
  "results": [{ "label": "Required return", "value": 11.4, "unit": "%" }]
}
```

`"paperOnly": true` – eine Frage erscheint nur in Probeklausuren, nicht beim Üben, in Kapiteltests, der Blitzrunde oder der
Readiness (z. B. der Multiple-Choice-Teil der Corporate-Finance-Klausur, während die Kapitel nur Rechenaufgaben haben).

`formulas/l01.json` – optional: **Formelübersicht**. Hat ein Fach welche, bekommt es die Seite „Formelübersicht“ (mit
Abfrage-Modus und Filter „Nur auswendig“) und jedes betroffene Kapitel eine Kachel „Formeln“. In `formula` werden `r_{E}`
bzw. `σ^{2}` tief- und hochgestellt; `sheet: true` heißt „steht auf dem Formelblatt der Klausur“.

```json
[{
  "id": "f-capm", "lecture": "l4", "name": "CAPM", "formula": "E(R_i) = r_f + β_i (E(R_M) − r_f)",
  "use": "Required return of any stock", "vars": ["E(R_M) − r_f = market risk premium"],
  "pitfall": "The premium, not E(R_M), multiplies beta.", "sheet": true
}]
```

**Grundlage und Lösungsweg** (alle Fragetypen, optional): `basis` nennt, woran sich eine Aufgabe orientiert – `kind` ist
`exam` (Altklausur, Midterm, Mock-Fragen), `slides` (Vorlesungsfolien), `case` (Übungsfall der Vorlesung), `quiz`
(Quiz der Vorlesung) oder `own` (selbst erstellte Aufgabe, z. B. „im Stil von Mock exam 2025/26, Exercise 1“; `source` dann
`"Eigene Aufgabe"`, die Anzeige zeigt nur `ref`). Die App zeigt
darüber „Orientiert an …“ und das Niveau (`difficulty` 1 = wie das Folien-Quiz, 2 = wie eine Einzelfrage der Klausur,
3 = wie ein ganzer Klausurteil). Kurzantworten und Multiple Choice können zusätzlich `steps` (Lösungsweg in Schritten:
`title`, Begründung `why`, Rechenzeilen `lines`, optional `table`, Ergebnis `result`) und `pitfalls` (typische Fehler)
haben; dann ersetzt der Lösungsweg die Musterlösung in der Anzeige. `modelAnswer` bleibt Pflicht (Grundlage der KI-Bewertung).

```json
{
  "basis": [{ "kind": "exam", "source": "Altklausur 2024", "ref": "Part 2 – Impairment" }, { "kind": "case", "source": "Übung T3", "ref": "Case 5 – Porto" }],
  "steps": [{ "title": "Goodwill first", "why": "IAS 36: …", "lines": ["Goodwill 200,000 → 0"], "result": "Remaining loss 70,000" }],
  "pitfalls": ["Taking the LOWER of value in use and fair value less costs to sell"]
}
```

`cards/l01.json`

```json
[{ "id": "c-l01-01", "lecture": "l01", "front": "Begriff", "back": "Erklärung" }]
```

Die genauen Regeln stehen in `src/lib/schema.ts`; `npm test` meldet Fehler mit Datei und Grund.
