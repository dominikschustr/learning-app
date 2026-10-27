# Lernwerk

Lern-App für meine Uni-Fächer: Kapitel mit Level, Karteikarten, Übungsfragen mit Spaced Repetition,
Kapiteltests, ein Abschlusstest im Prüfungsformat und eine Rangliste. Konzept: [KONZEPT.md](KONZEPT.md).

**Live:** https://dominikschustr.github.io/learning-app/ – jede Person hat ihren eigenen Lernstand im eigenen Browser.

Die App ist eine statische Seite auf **GitHub Pages**: Jeder Push auf `main` baut sie über GitHub Actions neu
und veröffentlicht sie. Für öffentliche Repos ist das kostenlos und ohne Kontingent. Synchronisation und
Rangliste laufen über ein kostenloses Firebase-Projekt (siehe unten).

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
| `npm run build` | Statische Seite nach `out/` bauen (validiert alle Inhalte) |
| `npm test` | Tests für Bewertung, Spaced Repetition, Level, Rangliste und Inhalte |
| `npm run lint` | ESLint |
| `npm run new-subject -- <id> "<Name>" <Kürzel>` | Neues Fach anlegen (siehe [content/README.md](content/README.md)) |
| `npm run test:rules` | Firestore-Regeln im lokalen Emulator testen (braucht Java und `firebase-tools`; läuft auch automatisch in GitHub Actions) |

## Inhalte und neue Fächer

Pro Fach ein Ordner unter `content/subjects/<fach>/` mit `subject.json`, Fragen, Karteikarten, Lesetexten und den
Vorlesungsdokumenten in `sources/`. Ein neues Fach braucht keine Code-Änderung – Anleitung, Formate und ein
fertiger Auftrag für Claude stehen in **[content/README.md](content/README.md)**.

## Einrichtung (einmalig)

### 1. GitHub Pages einschalten

Im Repository: **Settings → Pages → Build and deployment → Source: „GitHub Actions“**. Danach veröffentlicht
jeder Push auf `main` die App (Fortschritt unter *Actions → Deploy*, dauert ca. 2 Minuten). Manuell neu
veröffentlichen: *Actions → Deploy → Run workflow*.

### 2. Synchronisation und Rangliste einrichten

Ohne diesen Schritt funktioniert alles außer Geräte-Synchronisation und Rangliste. Firebase ist im
Spark-Plan kostenlos, braucht keine Kreditkarte und kann ohne Abrechnungskonto keine Kosten verursachen.

1. Auf [console.firebase.google.com](https://console.firebase.google.com) ein Projekt erstellen (Name z. B.
   `lernwerk`, Google Analytics kann aus bleiben).
2. Links **Firestore Database → Datenbank erstellen**: Standort in Europa (z. B. `eur3`), **Produktionsmodus**.
3. Im Tab **Regeln** den gesamten Inhalt von [`firestore.rules`](firestore.rules) einfügen und **Veröffentlichen**.
4. Zahnrad → **Projekteinstellungen → Allgemein → Meine Apps → Web-App hinzufügen** (`</>`), Name egal,
   Firebase Hosting **nicht** aktivieren. Aus der angezeigten `firebaseConfig` braucht die App nur `projectId`
   und `apiKey`.
5. Beide Werte in [`src/config.ts`](src/config.ts) eintragen (auf GitHub: Datei öffnen → Stift → einfügen →
   *Commit changes* auf `main`). Die Werte sind nicht geheim; geschützt wird über die Regeln.

Was die Regeln sicherstellen: Lernstände lassen sich nur mit dem geheimen Sync-Schlüssel finden (kein
Auflisten), Ranglisten-Einträge kann nur ändern oder löschen, wem sie gehören.

### 3. Optional: KI-Bewertung der Kurzantworten

Jede Person kann unter *Einstellungen → KI-Bewertung* einen eigenen, kostenlosen API-Key aus
[Google AI Studio](https://aistudio.google.com/apikey) eintragen (keine Abrechnung aktivieren). Der Key bleibt
nur in diesem Browser. Ohne Key bewertet man Kurzantworten selbst anhand der Kernpunkte.

## Geräte synchronisieren

*Einstellungen → Geräte synchronisieren → Aktivieren* auf dem ersten Gerät, dann den QR-Code mit dem Handy
scannen und „Verbinden“ tippen. Danach gleicht sich der Lernstand automatisch ab (nach Änderungen, beim
Wechsel zurück in die App, wenn das Gerät wieder online ist).

## Rangliste

Unter *Rangliste* (Pokal-Symbol oben) vergleichen sich alle, die beitreten: Level/XP, Antworten heute
(mit Tagesziel) und Streak. Beitreten ist freiwillig und nur mit selbst gewähltem Namen; gemeldet wird nur
dieser kleine Eintrag, nicht der Lernstand. Bei aktiver Synchronisation gilt die Teilnahme für alle Geräte.
Gemeldet wird höchstens einmal pro Minute beim Lernen und beim Verlassen der App (nur bei Änderungen),
geladen nur beim Öffnen der Rangliste.

## Umzug von der alten Vercel-Adresse

Der Lernstand liegt im Browser und hängt an der Adresse. Auf der alten Seite
(lernwerk-app.vercel.app) unter *Einstellungen → Backup → Exportieren* sichern, auf der neuen Seite unter
*Importieren* einlesen. Danach die Synchronisation auf der neuen Seite neu aktivieren und die anderen Geräte
erneut koppeln.
