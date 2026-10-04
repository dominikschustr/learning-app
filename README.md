# Lernwerk

Lern-App für meine Uni-Fächer: Kapitel mit Level, Karteikarten, Übungsfragen mit Spaced Repetition,
Kapiteltests und ein Abschlusstest im Prüfungsformat. Konzept: [KONZEPT.md](KONZEPT.md).

**Live:** https://learning-app-steel-delta.vercel.app

## Lokal starten

```bash
npm install
npm run dev
```

→ http://localhost:3000

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Produktions-Build (validiert alle Inhalte) |
| `npm test` | Tests für Bewertung, Spaced Repetition, Level und Inhalte |
| `npm run lint` | ESLint |

## Inhalte

Pro Fach ein Ordner unter `content/subjects/<fach>/`:

- `subject.json` – Name, Farbe, Kapitel (`lectures`), Prüfungsformat
- `questions/*.json` – Fragen (`mc`, `tf`, `short`), Schema in `src/lib/schema.ts`
- `cards/*.json` – Karteikarten
- `texts/<kapitel>.json` – Originaltext zum Nachlesen, erzeugt mit
  `python3 scripts/import_texts.py "Key Messages" content/subjects/management-control/texts`

Die Quelldokumente liegen in `Key Messages/`. Neue Dokumente → Claude erstellt daraus Fragen und Karten
als JSON → `npm test` prüft sie → commit.

## KI-Bewertung der Kurzantworten

Optional. Ohne Key bewertest du Kurzantworten selbst anhand der Kernpunkte.

1. In [Google AI Studio](https://aistudio.google.com/apikey) einen API-Key erstellen (Free Tier, keine Abrechnung aktivieren).
2. Lokal: `.env.local` mit `GEMINI_API_KEY=…` anlegen (siehe `.env.example`).
3. Auf Vercel: *Project → Settings → Environment Variables* → `GEMINI_API_KEY`.

## Deployment (Vercel)

Privates GitHub-Repo mit Vercel verbinden (*Add New → Project → Import*), Framework wird automatisch erkannt.
Jeder Push auf `main` deployt neu.

## Geräte synchronisieren

*Einstellungen → Geräte synchronisieren → Aktivieren* auf dem ersten Gerät, dann den QR-Code mit dem Handy
scannen und „Verbinden“ tippen. Danach gleicht sich der Lernstand automatisch ab (nach Änderungen, beim
Wechsel zurück in die App, wenn das Gerät wieder online ist). Speicher: Upstash Redis (Free-Plan über den
Vercel Marketplace, 500.000 Befehle/Monat; pro Synchronisation 1–2 Befehle), Variablen `KV_REST_API_URL` und
`KV_REST_API_TOKEN` (lokal via `vercel env pull .env.local`).

Einrichtung (einmalig, bestätigt die Upstash-Nutzungsbedingungen, ohne automatisches Hochstufen in einen Bezahlplan):

```bash
npx vercel@latest integration add upstash/upstash-kv --plan free --name learning-app-sync -m primaryRegion=fra1 -m autoUpgrade=false
```

Vorher lag der Stand in Vercel Blob; dessen Hobby-Kontingent (2.000 Schreibvorgänge/Monat) reichte für das
Speichern nach jeder Antwort nicht aus.
