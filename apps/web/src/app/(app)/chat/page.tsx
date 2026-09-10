import { redirect } from "next/navigation";

import { serverApi } from "@/lib/server/api";
import type { Companion, Conversation } from "@/types/api";

export default async function ChatIndexPage() {
  const companions = await serverApi<Companion[]>("/avatars").catch(() => []);
  const companion = companions[0];
  if (!companion) redirect("/onboarding");

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
