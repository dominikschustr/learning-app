import { Dashboard } from "@/components/Dashboard";
import { getSummaries } from "@/lib/content";

export default function Home() {
  return <Dashboard summaries={getSummaries()} />;
}
