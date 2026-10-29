import {
  Brain,
  CalendarCheck,
  Crown,
  FileCheck,
  Flame,
  Footprints,
  Layers,
  Medal,
  Rocket,
  Sparkles,
  Swords,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Waves,
  Zap,
  type LucideProps,
} from "lucide-react";

const ICONS = {
  brain: Brain,
  "calendar-check": CalendarCheck,
  crown: Crown,
  "file-check": FileCheck,
  flame: Flame,
  footprints: Footprints,
  layers: Layers,
  medal: Medal,
  rocket: Rocket,
  swords: Swords,
  target: Target,
  timer: Timer,
  "trending-up": TrendingUp,
  trophy: Trophy,
  waves: Waves,
  zap: Zap,
} as const;

export function Icon({ name, ...props }: { name?: string } & LucideProps) {
  const Cmp = (name && ICONS[name as keyof typeof ICONS]) || Sparkles;
  return <Cmp {...props} />;
}
