import "server-only";
import type { LiteraturePaper } from "./literature";
import { researchApiHeaders } from "./research-api";
import { trihexagonalChatId } from "./research-chat-links";

export async function getSavedResearchChat(id: string): Promise<LiteraturePaper | undefined> {
  if (id !== trihexagonalChatId) return undefined;
  const origin = (process.env.RESEARCH_API_URL ?? "http://localhost:3010").replace(/\/$/, "");
  const response = await fetch(`${origin}/research/saved-chats/${encodeURIComponent(id)}`, {
    headers: researchApiHeaders(), cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Saved research is temporarily unavailable. Please try again.");
  return response.json() as Promise<LiteraturePaper>;
}
