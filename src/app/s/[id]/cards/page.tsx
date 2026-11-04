import "katex/dist/katex.min.css";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Flashcards } from "@/components/Flashcards";
import { Skeleton } from "@/components/ui";
import { getAllContent, getCardFormulas, getSubjectContent } from "@/lib/content";
import { renderFormula, type RenderedFormula } from "@/lib/tex";

export const metadata = { title: "Karteikarten" };

export function generateStaticParams() {
  return getAllContent().map((c) => ({ id: c.subject.id }));
}

export default async function Page({ params }: PageProps<"/s/[id]/cards">) {
  const { id } = await params;
  const content = getSubjectContent(id);
  if (!content) notFound();
  // Formelkarten (z. B. Corporate Finance) zeigen die Formel wie in der Formelübersicht, gesetzt mit KaTeX
  const formulas: Record<string, RenderedFormula> = Object.fromEntries(
    Object.entries(getCardFormulas(id)).map(([cardId, f]) => [cardId, renderFormula(f)]),
  );
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Flashcards content={content} formulas={formulas} />
    </Suspense>
  );
}
