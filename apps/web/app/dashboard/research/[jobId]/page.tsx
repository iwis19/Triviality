import { LiteratureReader } from "@/components/literature-reader";
import { getSavedResearchChat } from "@/lib/saved-research-chats";
import ResearchEpisodePage from "./research-episode";

export default async function ResearchPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const saved = getSavedResearchChat(jobId);
  return saved ? <LiteratureReader paper={saved} workspace /> : <ResearchEpisodePage />;
}
