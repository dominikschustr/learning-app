import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Flashcards } from "@/components/Flashcards";
import { Skeleton } from "@/components/ui";
import { getAllContent, getSubjectContent } from "@/lib/content";

export const metadata = { title: "Karteikarten" };

export function generateStaticParams() {
  return getAllContent().map((c) => ({ id: c.subject.id }));
}

export default async function Page({ params }: PageProps<"/s/[id]/cards">) {
  const { id } = await params;
  const content = getSubjectContent(id);
  if (!content) notFound();
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Flashcards content={content} />
    </Suspense>
  );
}
