import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubjectOverview } from "@/components/SubjectOverview";
import { getAllContent, getSummaries } from "@/lib/content";

export function generateStaticParams() {
  return getAllContent().map((c) => ({ id: c.subject.id }));
}

export async function generateMetadata({ params }: PageProps<"/s/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: getSummaries().find((s) => s.subject.id === id)?.subject.name };
}

export default async function SubjectPage({ params }: PageProps<"/s/[id]">) {
  const { id } = await params;
  const summary = getSummaries().find((s) => s.subject.id === id);
  if (!summary) notFound();
  return <SubjectOverview summary={summary} />;
}
