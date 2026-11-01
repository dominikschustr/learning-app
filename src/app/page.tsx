import { Dashboard } from "@/components/Dashboard";
import { getCalendar, getSummaries } from "@/lib/content";

export default function Home() {
  return <Dashboard summaries={getSummaries()} calendar={getCalendar()} />;
}
