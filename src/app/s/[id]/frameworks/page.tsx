import { notFound } from "next/navigation";
import { FrameworkOverview } from "@/components/FrameworkOverview";
import { getAllContent, getFrameworks, getSubjectContent } from "@/lib/content";

export const metadata = { title: "Framework-Übersicht" };

export function generateStaticParams() {
  return getAllContent()
    .filter((c) => getFrameworks(c.subject.id).length)
    .map((c) => ({ id: c.subject.id }));
}

export default async function Page({ params }: PageProps<"/s/[id]/frameworks">) {
  const { id } = await params;
  const content = getSubjectContent(id);
  const frameworks = getFrameworks(id);
  if (!content || !frameworks.length) notFound();
  return <FrameworkOverview subject={content.subject} frameworks={frameworks} />;
}
