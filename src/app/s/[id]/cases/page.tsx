import { notFound } from "next/navigation";
import { CasebookView } from "@/components/CasebookView";
import { getAllContent, getCasebook, getFrameworks, getSubjectContent } from "@/lib/content";

export const metadata = { title: "Case Studies" };

export function generateStaticParams() {
  return getAllContent()
    .filter((c) => getCasebook(c.subject.id).length)
    .map((c) => ({ id: c.subject.id }));
}

export default async function Page({ params }: PageProps<"/s/[id]/cases">) {
  const { id } = await params;
  const content = getSubjectContent(id);
  const casebook = getCasebook(id);
  if (!content || !casebook.length) notFound();
  const frameworks = Object.fromEntries(getFrameworks(id).map((f) => [f.id, f.name]));
  return <CasebookView subject={content.subject} casebook={casebook} frameworks={frameworks} />;
}
