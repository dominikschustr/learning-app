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
  description: string;
  icon: string;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-answer", title: "Erste Schritte", description: "Erste Frage beantwortet", icon: "footprints" },
  { id: "combo-5", title: "Im Flow", description: "5 richtige Antworten in Folge", icon: "waves" },
  { id: "combo-10", title: "Unaufhaltsam", description: "10 richtige Antworten in Folge", icon: "zap" },
  { id: "daily-goal", title: "Tagessoll", description: "Tagesziel erreicht", icon: "target" },
  { id: "streak-3", title: "Dranbleiber", description: "3 Tage Streak", icon: "flame" },
  { id: "streak-7", title: "Wochenwerk", description: "7 Tage Streak", icon: "calendar-check" },
  { id: "cards-50", title: "Kartenstapler", description: "50 Karteikarten gelernt", icon: "layers" },
  { id: "mastered-25", title: "Sitzt!", description: "25 Fragen in Box 4 oder höher", icon: "brain" },
  { id: "chapter-test", title: "Kapitel geknackt", description: "Kapiteltest mit mindestens 80 %", icon: "file-check" },
  { id: "exam-1", title: "Generalprobe", description: "Ersten Abschlusstest abgeschlossen", icon: "file-check" },
  { id: "exam-80", title: "Prüfungsreif", description: "Abschlusstest mit mindestens 80 %", icon: "trophy" },
  { id: "blitz-15", title: "Blitzmerker", description: "15 richtige in einer Blitzrunde", icon: "timer" },
  { id: "level-5", title: "Aufsteiger", description: "Level 5 erreicht", icon: "trending-up" },
];
