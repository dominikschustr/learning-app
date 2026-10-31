import { notFound } from "next/navigation";
import { FormulaOverview } from "@/components/FormulaOverview";
import { getAllContent, getFormulas, getSubjectContent } from "@/lib/content";

export const metadata = { title: "Formelübersicht" };

export function generateStaticParams() {
  return getAllContent()
    .filter((c) => getFormulas(c.subject.id).length)
    .map((c) => ({ id: c.subject.id }));
}

export default async function Page({ params }: PageProps<"/s/[id]/formulas">) {
  const { id } = await params;
  const content = getSubjectContent(id);
  const formulas = getFormulas(id);
  if (!content || !formulas.length) notFound();
  return <FormulaOverview subject={content.subject} formulas={formulas} />;
}
