import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Practice } from "@/components/Practice";
import { Skeleton } from "@/components/ui";
import { getAllContent, getSubjectContent } from "@/lib/content";

export const metadata = { title: "Üben" };

export function generateStaticParams() {
  return getAllContent().map((c) => ({ id: c.subject.id }));
}

export default async function PracticePage({ params }: PageProps<"/s/[id]/practice">) {
  const { id } = await params;
  const content = getSubjectContent(id);
  if (!content) notFound();
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Practice content={content} />
    </Suspense>
  );
}
