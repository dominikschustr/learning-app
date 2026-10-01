/** Level n → n+1 braucht 100·n XP. */
export function levelInfo(xp: number) {
  let level = 1;
  let rest = Math.max(0, Math.floor(xp));
  while (rest >= level * 100) {
    rest -= level * 100;
    level++;
  }
  const needed = level * 100;
  return { level, into: rest, needed, progress: rest / needed };
}

export const XP = {
  correct: 10,
  hardBonus: 5,
  card: 2,
  cardKnown: 3,
  examCorrect: 5,
  examFinish: 50,
  blitzCorrect: 4,
} as const;

/** Combo-Bonus ab 3 richtigen Antworten in Folge, gedeckelt. */
export function comboBonus(combo: number): number {
  return combo >= 3 ? Math.min(10, (combo - 2) * 2) : 0;
}

export function answerXp(opts: { correct: boolean; difficulty: number; combo: number }): number {
  if (!opts.correct) return 1;
  return XP.correct + (opts.difficulty >= 3 ? XP.hardBonus : 0) + comboBonus(opts.combo);
}

export type Title = { minLevel: number; name: string };

export const TITLES: Title[] = [
  { minLevel: 1, name: "Erstsemester" },
  { minLevel: 3, name: "Tutorium-Stammgast" },
  { minLevel: 5, name: "Bibliotheks-Profi" },
  { minLevel: 8, name: "Controlling-Nerd" },
  { minLevel: 12, name: "Prüfungsschreck" },
  { minLevel: 17, name: "Lehrstuhl-Legende" },
];

export function titleFor(level: number): string {
  return [...TITLES].reverse().find((t) => level >= t.minLevel)!.name;
}

export type AchievementDef = {
  id: string;
  title: string;
  /** Was erreicht wurde (Toast, freigeschaltete Kachel) */
  description: string;
  /** Wie man es erreicht (gesperrte Kachel) */
  howTo: string;
  icon: string;
  /** Zielwert für die Fortschrittsanzeige; unit "%" = Prozentwert */
  target: number;
  unit?: "%";
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-answer", title: "Erste Schritte", description: "Erste Frage beantwortet", howTo: "Beantworte deine erste Frage oder Karteikarte.", icon: "footprints", target: 1 },
  { id: "combo-5", title: "Im Flow", description: "5 richtige Antworten in Folge", howTo: "Beantworte beim Üben 5 Fragen hintereinander richtig.", icon: "waves", target: 5 },
  { id: "combo-10", title: "Unaufhaltsam", description: "10 richtige Antworten in Folge", howTo: "Beantworte beim Üben 10 Fragen hintereinander richtig.", icon: "zap", target: 10 },
  { id: "daily-goal", title: "Tagessoll", description: "Tagesziel erreicht", howTo: "Schaffe an einem Tag dein Tagesziel an Fragen und Karten.", icon: "target", target: 1 },
  { id: "streak-3", title: "Dranbleiber", description: "3 Tage Streak", howTo: "Lerne an 3 Tagen hintereinander.", icon: "flame", target: 3 },
  { id: "streak-7", title: "Wochenwerk", description: "7 Tage Streak", howTo: "Lerne an 7 Tagen hintereinander.", icon: "calendar-check", target: 7 },
  { id: "cards-50", title: "Kartenstapler", description: "50 Karteikarten gelernt", howTo: "Bewerte insgesamt 50 Karteikarten mit „Gewusst“.", icon: "layers", target: 50 },
  { id: "mastered-25", title: "Sitzt!", description: "25 Fragen sicher gelernt", howTo: "Beantworte 25 Fragen so oft über mehrere Tage richtig, dass sie als sicher gelten (Box 4+).", icon: "brain", target: 25 },
  { id: "chapter-test", title: "Kapitel geknackt", description: "Kapiteltest mit mindestens 80 %", howTo: "Schaffe in einem Kapiteltest mindestens 80 %.", icon: "file-check", target: 80, unit: "%" },
  { id: "exam-1", title: "Generalprobe", description: "Ersten Abschlusstest abgeschlossen", howTo: "Schließe einen Abschlusstest über alle Kapitel ab.", icon: "file-check", target: 1 },
  { id: "exam-80", title: "Prüfungsreif", description: "Abschlusstest mit mindestens 80 %", howTo: "Schaffe im Abschlusstest mindestens 80 %.", icon: "trophy", target: 80, unit: "%" },
  { id: "blitz-15", title: "Blitzmerker", description: "15 richtige in einer Blitzrunde", howTo: "Beantworte in einer Blitzrunde (60 Sek.) 15 Aussagen richtig.", icon: "timer", target: 15 },
  { id: "level-5", title: "Aufsteiger", description: "Level 5 erreicht", howTo: "Sammle XP bis Level 5 – jede Antwort zählt.", icon: "trending-up", target: 5 },
];
