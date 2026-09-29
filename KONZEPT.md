# Lernwerk – Konzept

Eine Lern-App für meine Uni-Fächer. Aus den Key Messages der Vorlesungen entstehen
Aufgaben im Format der echten Prüfung. Die App fragt mich ab, merkt sich, was ich noch
nicht kann, wiederholt genau das, und zeigt mir jederzeit, wie prüfungsreif ich bin.

Erster Anwendungsfall: **Management Control – Midterm**.

---

## 1. Ziele

1. **Prüfungsnah üben** – dieselben Fragetypen, dieselbe Zeit (≈ 2 Min/Frage), dieselbe Gewichtung.
2. **Schnell lernen** – Spaced Repetition statt stumpfem Durchklicken; Schwächen zuerst.
3. **Stand sichtbar machen** – ein klarer Score („Exam-Readiness") pro Fach und pro Vorlesung.
4. **Motivation** – XP, Level, Streak, Tagesziel, Achievements.
5. **Mehrere Fächer** – jedes Fach ist ein Ordner mit JSON-Dateien; neue Fächer ohne Code-Änderung.

## 2. Prüfungsformat Management Control (Midterm)

| Teil | Anzahl | Typ |
| --- | --- | --- |
| Kurzantwort | 1 | *define*, *state* oder *explain* |
| Multiple Choice | 13 | mehrere Antworten können richtig sein |
| True / False | 6 | Aussage bewerten |
| **Summe** | **20** (laut Angabe 21 – Format in `subject.json` anpassbar) | **≈ 42 Minuten** |

Das Format ist pro Fach in `subject.json` hinterlegt (`examFormat`) und damit für andere
Fächer anpassbar.

## 3. Inhalte: vom Dokument zur Frage

Die App generiert **keine** Fragen selbst. Der Ablauf:

1. Ich gebe Claude (Claude Code) das Dokument mit den Key Messages einer Vorlesung.
2. Claude erstellt daraus Karteikarten und Fragen im Schema unten als JSON.
3. Die JSON-Dateien landen in `content/subjects/<fach>/…`, werden beim Build validiert (zod).
4. Commit + Push → Vercel deployt automatisch.

Ziel pro Vorlesung: ca. 6–10 MC, 5–8 True/False, 1–3 Kurzantworten, 8–15 Karteikarten.
Damit ist der Pool deutlich größer als 21, und jede Simulation sieht anders aus.

### Ordnerstruktur

```
content/subjects/management-control/
  subject.json            Name, Farbe, Vorlesungen, Prüfungsformat
  questions/l01.json      Fragen der Vorlesung 1
  cards/l01.json          Karteikarten der Vorlesung 1
```

### Schema

```jsonc
// subject.json
{
  "id": "management-control",
  "name": "Management Control",
  "short": "MC",
  "color": "#2F6BFF",
  "lectures": [{ "id": "l01", "title": "Introduction to Management Control" }],
  "examFormat": { "name": "Midterm", "minutes": 42, "short": 1, "mc": 13, "tf": 6 }
}

// Multiple Choice (mehrere richtige möglich)
{ "type": "mc", "id": "mc-l01-01", "lecture": "l01", "difficulty": 2,
  "prompt": "Which of the following are …?",
  "options": [{ "id": "a", "text": "…" }, { "id": "b", "text": "…" }],
  "correct": ["a", "c"],
  "explanation": "…" }

// True / False
{ "type": "tf", "id": "tf-l01-01", "lecture": "l01",
  "statement": "…", "answer": false, "explanation": "…" }

// Kurzantwort
{ "type": "short", "id": "sa-l01-01", "lecture": "l01", "verb": "define",
  "prompt": "Define management control.",
  "modelAnswer": "…",
  "keyPoints": ["…", "…"] }

// Karteikarte
{ "id": "c-l01-01", "lecture": "l01", "front": "…", "back": "…" }
```

## 4. Bewertung

- **Multiple Choice:** richtig nur bei exakt der richtigen Auswahl (wie in der Prüfung
  üblich). Nach der Antwort wird jede Option markiert: richtig gewählt, falsch gewählt,
  übersehen. Teilpunkte werden als Info angezeigt, zählen aber nicht als „richtig".
- **True / False:** binär.
- **Kurzantwort:** Ein kostenloses Modell (Google **Gemini Flash**, Free Tier) vergleicht
  meine Antwort mit Musterlösung und Kernpunkten und liefert
  `{ score 0–100, hit[], missed[], feedback }`. Ab 60 % gilt die Antwort als richtig.
  Der API-Key liegt nur serverseitig (`GEMINI_API_KEY`, Vercel-Env-Var).
  **Fallback** ohne Key oder bei Quota-Limit: Selbstbewertung – Musterlösung anzeigen,
  ich hake ab, welche Kernpunkte ich getroffen habe.

## 5. Kapitel, Level & Lernmodi

**Jedes Key-Messages-Dokument ist ein Kapitel** (S1a, S1b, S1c, S2a, S2b, S3&4) mit eigenem Level:

| Level | Name | Bedingung (Sicherheit = 80 % Fragen + 20 % Karteikarten) |
| --- | --- | --- |
| 0 | Neu | noch nichts beantwortet |
| 1 | Entdeckt | erste Antworten |
| 2 | Grundlagen | ≥ 30 % |
| 3 | Fortgeschritten | ≥ 50 % |
| 4 | Sicher | ≥ 70 % |
| 5 | Gemeistert | ≥ 85 % **und** Kapiteltest ≥ 80 % |

Die Fach-Seite zeigt einen **Lernpfad**: Kapitel 1–6, am Ende der **Abschlusstest** im Prüfungsformat,
der aus allen sechs Kapiteln Fragen zieht (gleichmäßig verteilt, jedes Kapitel ist vertreten).

Jede Kapitelseite bietet: **Nachlesen** (Originaltext des Dokuments mit Key Messages, Definitionen als Glossar und „To go further“), Karteikarten, Üben (nur dieses Kapitel) und einen **Kapiteltest**
(bis zu 1 Kurzantwort + 6 MC + 4 True/False, gleiche Zeit pro Frage wie in der Prüfung).

| Modus | Was passiert |
| --- | --- |
| **Karteikarten** | Key Concepts umdrehen, „Wusste ich" / „Noch nicht" → Spaced Repetition |
| **Üben nach Vorlesung** | Fragen einer Vorlesung, sofortiges Feedback mit Erklärung |
| **Wiederholung** | alle heute fälligen Fragen (Spaced Repetition) |
| **Schwächen-Training** | Fragen mit der niedrigsten Sicherheit / zuletzt falsch |
| **Kapiteltest** | Test nur aus einem Kapitel, ohne Feedback bis zur Abgabe; ≥ 80 % schaltet „Gemeistert“ frei |
| **Abschlusstest (Midterm)** | 1 + 13 + 6 Fragen aus allen Kapiteln, 42-Min-Countdown, markieren & springen, Auswertung pro Kapitel |
| **Blitzrunde** | 60 Sekunden True/False am Stück, Combo-Multiplikator |

## 6. Spaced Repetition & Score

- **Leitner-Boxen 1–5** pro Frage und Karteikarte. Intervalle: 0 / 1 / 3 / 7 / 14 Tage.
  Richtig → eine Box hoch, falsch → zurück in Box 1. Neue Items sind „ungesehen".
- **Mastery pro Item** = Box / 5 (ungesehen = 0).
- **Mastery pro Vorlesung** = Durchschnitt der Items.
- **Exam-Readiness** (prognostizierter Prüfungs-Score in %) = Mastery je Fragetyp,
  gewichtet mit dem Prüfungsformat (1 × Kurzantwort, 13 × MC, 6 × TF). Wird als Ring auf
  der Fach-Seite angezeigt, dazu die schwächsten Vorlesungen.

## 7. Gamification

- **XP:** +10 pro richtiger Antwort, +5 Bonus bei schweren Fragen, Combo-Bonus ab 3 in
  Folge, +2 für eine Karteikarte, Bonus für abgeschlossene Simulationen.
- **Level:** steigende XP-Kurve (Level n braucht 100 · n XP), Level-Up mit Konfetti.
- **Streak:** Tage in Folge mit mindestens einer Lerneinheit; **Tagesziel** (z. B. 30 Fragen).
- **Achievements:** z. B. „Erste Simulation", „10er-Combo", „Vorlesung gemeistert",
  „7-Tage-Streak", „Bestwert ≥ 80 %".
- **Aktivitäts-Heatmap** der letzten Wochen, **Bestenliste** meiner Simulationen.

## 8. Design

- **Hell & clean**, Editorial-Anmutung: viel Weißraum, warmes Off-White, eine kräftige
  Akzentfarbe pro Fach, feine Linien statt schwerer Schatten.
- **Typografie:** Serif für Headlines (Instrument Serif), Inter für UI und Fragen.
- **Dark Mode** per Umschalter (folgt standardmäßig dem System).
- **Bewegung:** dezent – Karten-Flip, weiche Übergänge zwischen Fragen, Fortschrittsringe,
  Konfetti nur bei echten Erfolgen.
- **Mobil zuerst nutzbar:** Üben auf dem Handy muss angenehm sein. Tastatur-Shortcuts am
  Desktop (1–6 für Optionen, T/F, Enter für Weiter).

## 9. Technik

- **Next.js (App Router) + TypeScript + Tailwind CSS**
- **Framer Motion** (Animation), **Zustand** mit `persist` (Fortschritt in localStorage),
  **zod** (Content-Validierung), **lucide-react** (Icons), **canvas-confetti**
- **API-Route** `/api/grade` → Gemini für Kurzantworten
- **Speicherung:** nur im Browser. Export/Import des Fortschritts als JSON-Datei (Backup,
  Gerätewechsel).
- **Deployment:** privates GitHub-Repo → Vercel. `GEMINI_API_KEY` als Env-Var.

## 10. Roadmap

1. Konzept (dieses Dokument)
2. Grundgerüst: Next.js, Design-System, Content-Loader, Store
3. Karteikarten + Üben + Feedback
4. Spaced Repetition, Mastery, Exam-Readiness
5. Midterm-Simulation mit Timer + Auswertung
6. Kurzantwort-Bewertung via Gemini (+ Fallback)
7. Gamification (XP, Level, Streak, Achievements, Blitzrunde)
8. Echte Inhalte aus den Key Messages S1a–S3&4 (118 Fragen, 78 Karten) ✓
9. Kapitel mit Level, Kapiteltests, Lernpfad mit Abschlusstest ✓
10. Deployment auf Vercel
