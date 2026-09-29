import {
  Brain,
  CalendarCheck,
  FileCheck,
  Flame,
  Footprints,
  Layers,
  Sparkles,
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
  "file-check": FileCheck,
  flame: Flame,
  footprints: Footprints,
  layers: Layers,
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
