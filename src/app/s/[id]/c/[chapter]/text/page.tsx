import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadingView } from "@/components/ReadingView";
import { getAllContent, getSubjectContent, getText, getTexts } from "@/lib/content";

export function generateStaticParams() {
  return getAllContent().flatMap((c) => getTexts(c.subject.id).map((t) => ({ id: c.subject.id, chapter: t.lecture })));
}

export async function generateMetadata({ params }: PageProps<"/s/[id]/c/[chapter]/text">): Promise<Metadata> {
  const { id, chapter } = await params;
  const lecture = getSubjectContent(id)?.subject.lectures.find((l) => l.id === chapter);
  return { title: lecture ? `Nachlesen · ${lecture.title}` : "Nachlesen" };
}

export default async function TextPage({ params }: PageProps<"/s/[id]/c/[chapter]/text">) {
  const { id, chapter } = await params;
  const content = getSubjectContent(id);
  const text = getText(id, chapter);
  const index = content?.subject.lectures.findIndex((l) => l.id === chapter) ?? -1;
  if (!content || !text || index < 0) notFound();
  return <ReadingView subject={content.subject} text={text} chapterIndex={index} />;
}
