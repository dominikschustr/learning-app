import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChapterView } from "@/components/ChapterView";
import { getAllContent, getSummaries } from "@/lib/content";

export function generateStaticParams() {
  return getAllContent().flatMap((c) => c.subject.lectures.map((l) => ({ id: c.subject.id, chapter: l.id })));
}

export async function generateMetadata({ params }: PageProps<"/s/[id]/c/[chapter]">): Promise<Metadata> {
  const { id, chapter } = await params;
  const s = getSummaries().find((x) => x.subject.id === id);
  return { title: s?.subject.lectures.find((l) => l.id === chapter)?.title };
}

export default async function ChapterPage({ params }: PageProps<"/s/[id]/c/[chapter]">) {
  const { id, chapter } = await params;
  const summary = getSummaries().find((s) => s.subject.id === id);
  if (!summary || !summary.subject.lectures.some((l) => l.id === chapter)) notFound();
  return <ChapterView summary={summary} chapterId={chapter} />;
}
