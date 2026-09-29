import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Blitz } from "@/components/Blitz";
import { Skeleton } from "@/components/ui";
import { getAllContent, getSubjectContent } from "@/lib/content";

export const metadata = { title: "Blitzrunde" };

export function generateStaticParams() {
  return getAllContent().map((c) => ({ id: c.subject.id }));
}

export default async function Page({ params }: PageProps<"/s/[id]/blitz">) {
  const { id } = await params;
  const content = getSubjectContent(id);
  if (!content) notFound();
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Blitz content={content} />
    </Suspense>
  );
}
