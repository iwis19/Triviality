import type { LiteraturePaper } from "./literature";
import { trihexagonalShellProof } from "./published-proofs";
import { trihexagonalChatId } from "./research-chat-links";

// Imported research results use the same opaque identifiers and route as runs.
const savedResearchChats = new Map<string, LiteraturePaper>([
  [trihexagonalChatId, trihexagonalShellProof],
]);

export function getSavedResearchChat(id: string) {
  return savedResearchChats.get(id);
}
