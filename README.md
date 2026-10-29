# Lernwerk

Lern-App für meine Uni-Fächer: Kapitel mit Level, Karteikarten, Übungsfragen mit Spaced Repetition,
Kapiteltests, ein Abschlusstest im Prüfungsformat und eine Rangliste. Konzept: [KONZEPT.md](KONZEPT.md).

**Live:** https://dominikschustr.github.io/learning-app/ – jede Person hat ihren eigenen Lernstand im eigenen Browser.

Die App ist eine statische Seite auf **GitHub Pages**: Jeder Push auf `main` baut sie über GitHub Actions neu
und veröffentlicht sie. Für öffentliche Repos ist das kostenlos und ohne Kontingent. Konten, Synchronisation und
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
| `npm run test:rules` | Konten und Firestore-Regeln in den lokalen Firebase-Emulatoren testen (braucht Java und `firebase-tools`; läuft auch automatisch in GitHub Actions) |

## Inhalte und neue Fächer

Pro Fach ein Ordner unter `content/subjects/<fach>/` mit `subject.json`, Fragen, Karteikarten, Lesetexten und den
Vorlesungsdokumenten in `sources/`. Ein neues Fach braucht keine Code-Änderung – Anleitung, Formate und ein
fertiger Auftrag für Claude stehen in **[content/README.md](content/README.md)**.

## Einrichtung (einmalig)

### 1. GitHub Pages einschalten

Im Repository: **Settings → Pages → Build and deployment → Source: „GitHub Actions“**. Danach veröffentlicht
jeder Push auf `main` die App (Fortschritt unter *Actions → Deploy*, dauert ca. 2 Minuten). Manuell neu
veröffentlichen: *Actions → Deploy → Run workflow*.

### 2. Firebase einrichten (Konten, Synchronisation, Rangliste)

Die App läuft nur mit Konto. Konten, Lernstände und Rangliste liegen in einem kostenlosen Firebase-Projekt
(Spark-Plan: keine Kreditkarte, ohne Abrechnungskonto keine Kosten). Das Projekt ist in
[`src/config.ts`](src/config.ts) eingetragen (`projectId`, `apiKey` – nicht geheim, geschützt wird über die Regeln).

1. Auf [console.firebase.google.com](https://console.firebase.google.com) ein Projekt erstellen.
2. **Authentication → Jetzt starten → Anmeldemethode → E-Mail-Adresse/Passwort** einschalten und speichern.
3. **Firestore Database → Datenbank erstellen**: Standort in Europa, **Produktionsmodus**.
4. Im Firestore-Tab **Regeln** den gesamten Inhalt von [`firestore.rules`](firestore.rules) einfügen und
   **Veröffentlichen**. Nach jeder Änderung an `firestore.rules` hier erneut einfügen.
5. Zahnrad → **Projekteinstellungen → Meine Apps → Web-App hinzufügen**, `projectId` und `apiKey` in
   `src/config.ts` eintragen.

Was die Regeln sicherstellen: Den Lernstand (`progress/{uid}`) kann nur das eigene Konto lesen und schreiben;
die Rangliste (`users/{uid}`: Name, XP, Tagesstand, Tagesziel, Streak) sehen alle Angemeldeten, ändern kann
jedes Konto nur den eigenen Eintrag.

### 3. Optional: KI-Bewertung der Kurzantworten

Jede Person kann unter *Einstellungen → KI-Bewertung* einen eigenen, kostenlosen API-Key aus
[Google AI Studio](https://aistudio.google.com/apikey) eintragen (keine Abrechnung aktivieren). Der Key bleibt
nur in diesem Browser. Ohne Key bewertet man Kurzantworten selbst anhand der Kernpunkte.

## Konto, Synchronisation und Rangliste

Beim ersten Öffnen registriert man sich mit Name, E-Mail-Adresse und Passwort (oder meldet sich an; „Passwort
vergessen?“ schickt einen Link per E-Mail). Der Lernstand gehört zum Konto: Auf jedem Gerät anmelden, dann gleicht
er sich automatisch ab (nach Änderungen, beim Wechsel zurück in die App, wenn das Gerät wieder online ist).
Beim Abmelden wird der Stand zuerst hochgeladen und dann vom Gerät entfernt.

Unter *Rangliste* (Pokal-Symbol oben) stehen alle Konten mit Level/XP, Antworten heute (mit Tagesziel) und
Streak – dazu Siegertreppchen, Ligen nach Level (Bronze bis Legende), Streak-Abzeichen, „Dein Duell“ mit den Plätzen
vor und hinter dir, ein gemeinsames Tagesziel aller, Auf-/Abstiegspfeile und Überhol-Meldungen seit dem letzten Besuch
(gemerkt auf dem Gerät) sowie drei Ranglisten-Achievements. Dafür werden keine zusätzlichen Daten gespeichert. Gemeldet wird höchstens einmal pro Minute beim Lernen und beim Verlassen der App (nur bei Änderungen),
geladen nur beim Öffnen der Rangliste. Name ändern, abmelden und Konto löschen unter *Einstellungen*.

## Umzug von der alten Vercel-Adresse

Der Lernstand liegt im Browser und hängt an der Adresse. Auf der alten Seite
(lernwerk-app.vercel.app) unter *Einstellungen → Backup → Exportieren* sichern, auf der neuen Seite unter
*Importieren* einlesen, nachdem du dich angemeldet hast – der importierte Stand wird mit deinem Konto zusammengeführt.
