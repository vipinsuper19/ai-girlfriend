import { notFound } from "next/navigation";

import { ChatThread } from "@/components/chat/chat-thread";
import { NoCompanion } from "@/components/shared/no-companion";
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
  if (!companionSummary) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-8">
        <NoCompanion
          title="No one to talk to yet"
          description="Create a companion first — then this tab opens the latest conversation."
        />
      </div>
    );
  }

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
