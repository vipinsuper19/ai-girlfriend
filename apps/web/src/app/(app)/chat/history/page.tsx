import { HistoryList } from "@/components/chat/chat-thread";
import { serverApi } from "@/lib/server/api";
import type { Conversation } from "@/types/api";

export const metadata = { title: "Conversations" };

export default async function HistoryPage() {
  const conversations = await serverApi<Conversation[]>("/conversations").catch(
    () => [],
  );
  return <HistoryList conversations={conversations} />;
}
