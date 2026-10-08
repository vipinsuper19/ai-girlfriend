import { redirect } from "next/navigation";

import { NoCompanion } from "@/components/shared/no-companion";
import { serverApi } from "@/lib/server/api";
import type { Companion, Conversation } from "@/types/api";

export default async function ChatIndexPage() {
  const companions = await serverApi<Companion[]>("/avatars").catch(() => []);
  const companion = companions[0];
  if (!companion) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-8">
        <NoCompanion
          title="No one to talk to yet"
          description="Create a companion first — then this tab opens the latest conversation."
        />
      </div>
    );
  }

  const conversations = await serverApi<Conversation[]>("/conversations").catch(
    () => [],
  );
  const latest = conversations[0];
  if (latest) {
    redirect(`/chat/${latest.id}`);
  }

  const created = await serverApi<Conversation>("/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companionId: companion.id }),
  });
  redirect(`/chat/${created.id}`);
}
