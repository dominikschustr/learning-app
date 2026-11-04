import { cn } from "@/lib/utils";

/** Folienblatt im Look der Vorlesungsfolien: lila Rahmen, gelbe Titelbox, Fußzeile mit Quelle und Nummer. */
export function SlideFrame({
  title,
  source,
  number,
  id,
  className,
  children,
}: {
  title: React.ReactNode;
  source?: string;
  number?: number | string;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article id={id} className={cn("slide scroll-mt-32", className)}>
      <div className="px-4 pt-4 sm:px-6 sm:pt-5">
        <h3 className="slide-title text-lg sm:text-xl">{title}</h3>
      </div>
      <div className="px-4 pb-4 pt-1 sm:px-6 sm:pb-5">{children}</div>
      {(source || number !== undefined) && (
        <footer className="flex items-end justify-between gap-4 border-t border-line px-4 py-2 text-[0.7rem] text-muted sm:px-6">
          <span>{source && <>Source: {source}</>}</span>
          {number !== undefined && <span className="tabular-nums">{number}</span>}
        </footer>
      )}
    </article>
  );
}

/** Titelfolie: lila Fläche mit goldener Serifen-Überschrift, wie der Deckblatt-Slide jeder Session. */
export function TitleSlide({
  eyebrow,
  title,
  subtitle,
  footer,
  className,
  children,
}: {
  /** links in der Fußzeile, z. B. der Fachname */
  footer?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("slide-cover px-5 py-7 sm:px-8 sm:py-10", className)}>
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">{eyebrow}</p>}
      <h2 className="slide-cover-title mt-2 text-3xl sm:text-5xl">{title}</h2>
      {subtitle && <p className="mt-3 max-w-2xl text-white/90 sm:text-lg">{subtitle}</p>}
      {children}
      <div className="mt-6 flex items-center justify-between border-t border-white/40 pt-2 text-[0.65rem] uppercase tracking-[0.14em] text-white/70">
        <span>{footer}</span>
        <span>Lernwerk</span>
      </div>
    </div>
  );
}
