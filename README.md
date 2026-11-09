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
   **Veröffentlichen**. Später übernimmt das der Deploy-Workflow automatisch (siehe 3., Secret `FIREBASE_SERVICE_ACCOUNT`).
5. Zahnrad → **Projekteinstellungen → Meine Apps → Web-App hinzufügen**, `projectId` und `apiKey` in
   `src/config.ts` eintragen.

Was die Regeln sicherstellen: Den Lernstand (`progress/{uid}`) kann nur das eigene Konto lesen und schreiben;
die Rangliste (`users/{uid}`: Name, XP, Tagesstand, Tagesziel, Streak) sehen alle Angemeldeten, ändern kann
jedes Konto nur den eigenen Eintrag.

### 3. Mitteilungen (Tagesziel und Rangliste)

Unter *Einstellungen → Mitteilungen* (oder über den Hinweis auf der Startseite) gibt es pro Gerät zwei Schalter:

- **Erinnerung ans Tagesziel**: abends zur gewählten Uhrzeit eine Mitteilung, falls das Tagesziel noch offen ist.
- **Rangliste**: eine Mitteilung, wenn jemand aus der Rangliste gerade lernt („Anna lernt gerade – schon 12
  Antworten heute“). Pro lernender Person höchstens alle drei Stunden, nur zwischen 7 und 22 Uhr; mehrere
  Lernende werden zusammengefasst. Tippen öffnet die Rangliste.

Das Gerät speichert sein Push-Abo mit beiden Schaltern in Firestore (`push/{id}`). Der Workflow
[`remind.yml`](.github/workflows/remind.yml) läuft tagsüber alle 10 Minuten (angestoßen von cron-job.org, siehe
Schritt 4 unten), liest Abos und Ranglisten-Stand mit einem Dienstkonto und verschickt die Mitteilungen
([`scripts/reminders.mjs`](scripts/reminders.mjs)). Wer seit dem letzten Lauf gelernt hat, erkennt er am Stand
in `users/{uid}`; den gemerkten Stand legt er in `notify/activity` ab (für Konten gesperrt).

**`firestore.rules` werden automatisch veröffentlicht:** Bei jedem Push auf `main` testet der Deploy-Workflow
die Regeln im Emulator und spielt sie mit dem Dienstkonto ins Firebase-Projekt ([`scripts/deploy-rules.mjs`](scripts/deploy-rules.mjs)).
Einfügen in der Konsole ist nicht mehr nötig.

Einmalig einrichten:

1. Firebase-Konsole → Projekteinstellungen → **Dienstkonten** → **Neuen privaten Schlüssel generieren**.
2. GitHub → Repository → Settings → Secrets and variables → **Actions** → zwei Secrets anlegen:
   - `FIREBASE_SERVICE_ACCOUNT`: kompletter Inhalt der heruntergeladenen JSON-Datei
   - `VAPID_PRIVATE_KEY`: privater Web-Push-Schlüssel (Gegenstück zu `PUSH.vapidPublicKey` in [`src/config.ts`](src/config.ts))
3. Actions → **Deploy** → **Run workflow** (veröffentlicht die Regeln), danach Actions → **Remind** → **Run workflow**.
4. **Takt von außen** – GitHubs eigener Zeitplan (`schedule`) startet den Workflow bei diesem Repository nur alle
   4–12 Stunden, die Mitteilungen kämen dann Stunden zu spät. Deshalb stößt ihn ein kostenloser Cron-Dienst an:
   1. GitHub → Settings → Developer settings → **Fine-grained tokens** → *Generate new token*: Name `remind-trigger`,
      Ablauf z. B. 1 Jahr, *Only select repositories* → `learning-app`, *Permissions* → **Actions: Read and write**
      (sonst nichts). Token kopieren.
   2. [cron-job.org](https://cron-job.org) → Konto anlegen → **Create cronjob**:
      - URL: `https://api.github.com/repos/dominikschustr/learning-app/actions/workflows/remind.yml/dispatches`
      - Zeitplan: *Custom* → Minuten `*/10` (bzw. „alle 10 Minuten“), Stunden 6–23, Zeitzone Europe/Berlin
      - Reiter *Advanced*: Request method **POST**, Request body `{"ref":"main"}`, Headers
        `Accept: application/vnd.github+json`, `Authorization: Bearer <Token>`, `X-GitHub-Api-Version: 2022-11-28`
      - *Notify on failure* einschalten (meldet z. B. einen abgelaufenen Token)
   3. *Test run* → Antwort **204** heißt: Lauf gestartet, unter Actions → Remind sichtbar (Ereignis `workflow_dispatch`).

   Der Token kann nur Workflows dieses Repositorys starten, keinen Code lesen oder ändern. Läuft er ab: neuen erzeugen
   und im Cronjob den `Authorization`-Header ersetzen.

Auf dem iPhone kommen Mitteilungen nur an die Home-Bildschirm-App (Safari → Teilen → Zum Home-Bildschirm, iOS 16.4+).
Neue Schlüssel: `npx web-push generate-vapid-keys`, öffentlichen in `src/config.ts`, privaten als Secret.

### 4. Optional: KI-Bewertung der Kurzantworten

Jede Person kann unter *Einstellungen → KI-Bewertung* einen eigenen, kostenlosen API-Key aus
[Google AI Studio](https://aistudio.google.com/apikey) eintragen (keine Abrechnung aktivieren). Der Key bleibt
nur in diesem Browser. Ohne Key bewertet man Kurzantworten selbst anhand der Kernpunkte.

## Konto, Synchronisation und Rangliste

Beim ersten Öffnen registriert man sich mit Name, E-Mail-Adresse und Passwort (oder meldet sich an; „Passwort
vergessen?“ schickt einen Link per E-Mail). Der Lernstand gehört zum Konto: Auf jedem Gerät anmelden, dann gleicht
er sich automatisch ab (nach Änderungen, beim Wechsel zurück in die App, wenn das Gerät wieder online ist).
Beim Abmelden wird der Stand zuerst hochgeladen und dann vom Gerät entfernt.

Unter *Rangliste* (Pokal-Symbol oben) stehen alle Konten mit Level/XP, Antworten heute (mit Tagesziel) und
Streak sowie die **Wochenliga** (XP von Montag bis Sonntag, Neustart jeden Montag um 0 Uhr) – dazu Siegertreppchen, Ligen nach Level (Bronze bis Legende), Streak-Abzeichen, „Dein Duell“ mit den Plätzen
vor und hinter dir, ein gemeinsames Tagesziel aller, Auf-/Abstiegspfeile und Überhol-Meldungen seit dem letzten Besuch
(gemerkt auf dem Gerät) sowie vier Ranglisten-Achievements. Für die Wochenliga meldet jedes Konto zusätzlich `weekXp` und `week` (Montag der
Woche); die XP je Tag werden dafür pro Gerät mitgezählt und synchronisiert. Solange die veröffentlichten
`firestore.rules` die Wochenfelder nicht kennen, meldet die App automatisch ohne sie weiter. Gemeldet wird höchstens einmal pro Minute beim Lernen und beim Verlassen der App (nur bei Änderungen),
geladen nur beim Öffnen der Rangliste. Name ändern, abmelden und Konto löschen unter *Einstellungen*.

## Umzug von der alten Vercel-Adresse

Der Lernstand liegt im Browser und hängt an der Adresse. Auf der alten Seite
(lernwerk-app.vercel.app) unter *Einstellungen → Backup → Exportieren* sichern, auf der neuen Seite unter
*Importieren* einlesen, nachdem du dich angemeldet hast – der importierte Stand wird mit deinem Konto zusammengeführt.
