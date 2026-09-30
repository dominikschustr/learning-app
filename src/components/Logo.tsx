import { useId } from "react";
import { cn } from "@/lib/utils";

/** Bildmarke: „L“ mit Funkel-Stern – gleiche Form wie src/app/icon.svg. */
export function Logo({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4C7BFF" />
          <stop offset="1" stopColor="#6A3DE8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id}bg)`} />
      <path d="M20 14v30a6 6 0 0 0 6 6h18" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" />
      <path
        d="M44 12l2.6 6.4L53 21l-6.4 2.6L44 30l-2.6-6.4L35 21l6.4-2.6z"
        fill="#FFB547"
        className="origin-[44px_21px] transition-transform duration-500 group-hover:rotate-90 group-hover:scale-110"
      />
    </svg>
  );
}
