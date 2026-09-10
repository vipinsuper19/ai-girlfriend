import { notFound, redirect } from "next/navigation";

import { ChatThread } from "@/components/chat/chat-thread";
import { serverApi } from "@/lib/server/api";
import type { Companion, Conversation, Message } from "@/types/api";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const companions = await serverApi<Companion[]>("/avatars").catch(() => []);
  const companionSummary = companions[0];
  if (!companionSummary) redirect("/onboarding");

  const companion = await serverApi<Companion>(
    `/avatars/${companionSummary.id}`,
  ).catch(() => companionSummary);

  const conversations = await serverApi<Conversation[]>("/conversations").catch(
    () => [],
  );
  const conversation = conversations.find(
    (item) => String(item.id) === conversationId,
  );
  if (!conversation) notFound();

  const messages = await serverApi<Message[]>(
    `/conversations/${conversationId}/messages`,
  ).catch(() => []);

  return (
    <ChatThread
      companion={companion}
      conversation={conversation}
      conversations={conversations}
      initialMessages={messages}
    />
  );
}
