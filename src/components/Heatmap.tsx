"use client";

import { addDays, dayKey } from "@/lib/utils";

const WEEKS = 18;

export function Heatmap({ activity, goal }: { activity: Record<string, number>; goal: number }) {
  const today = new Date();
  // Start am Montag vor (WEEKS-1) Wochen
  const mondayOffset = (today.getDay() + 6) % 7;
  const start = addDays(today, -mondayOffset - (WEEKS - 1) * 7);

  const weeks = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, w * 7 + d);
      const key = dayKey(date);
      return { key, count: activity[key] ?? 0, future: date > today };
    }),
  );

  const level = (n: number) => (n === 0 ? 0 : n < goal * 0.34 ? 1 : n < goal * 0.67 ? 2 : n < goal ? 3 : 4);
  const opacity = [0, 0.25, 0.45, 0.7, 1];

  return (
    <div>
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {weeks.map((week, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {week.map((day) => (
              <div
                key={day.key}
                title={`${day.key}: ${day.count} Antworten`}
                className="size-3 rounded-[3px] sm:size-3.5"
                style={{
                  background: day.future
                    ? "transparent"
                    : day.count === 0
                      ? "var(--surface-2)"
                      : `color-mix(in srgb, var(--good) ${opacity[level(day.count)] * 100}%, var(--surface-2))`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        weniger
        {opacity.map((o, i) => (
          <span
            key={i}
            className="size-3 rounded-[3px]"
            style={{ background: i === 0 ? "var(--surface-2)" : `color-mix(in srgb, var(--good) ${o * 100}%, var(--surface-2))` }}
          />
        ))}
        Tagesziel
      </div>
    </div>
  );
}
