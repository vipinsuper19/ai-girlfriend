import Link from "next/link";
import { redirect } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/surfaces";
import { firstName, formatRelativeTime, weeksTogether } from "@/lib/utils";
import { serverApi } from "@/lib/server/api";
import type { Companion, Conversation, Memory, Message, User } from "@/types/api";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const user = await serverApi<User>("/users/me");
  const companions = await serverApi<Companion[]>("/avatars").catch(() => []);
  const companionSummary = companions[0];
  if (!companionSummary) {
    redirect("/onboarding");
  }

  const companion = await serverApi<Companion>(
    `/avatars/${companionSummary.id}`,
  ).catch(() => companionSummary);

  const conversations = await serverApi<Conversation[]>("/conversations").catch(
    () => [],
  );
  const latest = conversations[0];
  let lastMessage: Message | null = null;
  if (latest) {
    const messages = await serverApi<Message[]>(
      `/conversations/${latest.id}/messages`,
    ).catch(() => []);
    lastMessage = messages.at(-1) ?? null;
  }

  const memories = await serverApi<Memory[]>("/memories?limit=1").catch(
    () => [],
  );
  const highlight = memories[0];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-5 py-8 lg:grid lg:grid-cols-[1.4fr_1fr] lg:items-start">
      <section className="flex flex-col gap-5">
        <Greeting name={firstName(user.displayName)} />
        <div className="flex flex-col items-start gap-3 lg:hidden">
          <Avatar
            name={companion.name}
            src={companion.appearance?.avatarUrl}
            size={128}
          />
          <h1 className="font-display text-3xl font-light">{companion.name}</h1>
          <p className="text-sm text-on-surface-variant">
            Active now · {weeksTogether(companion.createdAt)}
          </p>
        </div>
        <div className="hidden lg:block">
          <h1 className="font-display text-3xl font-light">{companion.name}</h1>
          <p className="text-sm text-on-surface-variant">
            {weeksTogether(companion.createdAt)}
          </p>
        </div>
        <div className="max-w-[68ch] rounded-lg rounded-bl-sm bg-bubble-incoming px-4 py-3 text-on-bubble-incoming">
          {lastMessage?.content ||
            companion.greeting ||
            "Whenever you're ready."}
        </div>
        <Button asChild>
          <Link href={latest ? `/chat/${latest.id}` : "/chat"}>
            {lastMessage ? "Continue talking" : "Say hello"}
          </Link>
        </Button>
        {lastMessage ? (
          <p className="text-xs text-on-surface-variant">
            Last message {formatRelativeTime(lastMessage.createdAt)}
          </p>
        ) : null}
      </section>
      <aside className="flex flex-col gap-4">
        {highlight ? (
          <Link
            href={`/memory/${highlight.id}`}
            className="rounded-lg bg-tertiary-container p-4 text-on-tertiary-container"
          >
            <p className="text-xs font-semibold tracking-wide uppercase">
              Memory
            </p>
            <p className="mt-2 text-sm">{highlight.content}</p>
          </Link>
        ) : null}
        <UsageHint />
      </aside>
    </div>
  );
}

function Greeting({ name }: { name: string }) {
  return (
    <p suppressHydrationWarning className="text-sm text-on-surface-variant">
      {timeOfDay()}, {name}
    </p>
  );
}

function timeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function UsageHint() {
  return (
    <Banner tone="info">
      Free includes 100 messages a month. Usage metering is not wired on the
      server yet, so this stays informational.
    </Banner>
  );
}
