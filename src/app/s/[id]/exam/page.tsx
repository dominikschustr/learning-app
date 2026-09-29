import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Exam } from "@/components/Exam";
import { Skeleton } from "@/components/ui";
import { getAllContent, getSubjectContent } from "@/lib/content";

export const metadata = { title: "Simulation" };

export function generateStaticParams() {
  return getAllContent().map((c) => ({ id: c.subject.id }));
}

export default async function Page({ params }: PageProps<"/s/[id]/exam">) {
  const { id } = await params;
  const content = getSubjectContent(id);
  if (!content) notFound();
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Exam content={content} />
    </Suspense>
  );
}
