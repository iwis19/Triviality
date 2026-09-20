import { redirect } from "next/navigation";
import { trihexagonalChatHref } from "@/lib/research-chat-links";

export default function LegacyResearchPage() {
  redirect(trihexagonalChatHref);
}
