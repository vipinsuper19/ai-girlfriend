import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Avatar, Meter } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/surfaces";
import { weeksTogether } from "@/lib/utils";
import { serverApi } from "@/lib/server/api";
import type { Companion } from "@/types/api";

export default async function CompanionPage({
  params,
}: {
  params: Promise<{ companionId: string }>;
}) {
  const { companionId } = await params;
  let companion: Companion;
  try {
    companion = await serverApi<Companion>(`/avatars/${companionId}`);
  } catch {
    notFound();
  }

  const traits = Array.isArray(companion.personality?.traits)
    ? companion.personality.traits.map(String)
    : [];
  const relationship =
    (companion.personality?.metadata?.relationshipType as string | undefined) ??
    "companion";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8">
      <div className="flex flex-col items-start gap-3">
        <Avatar name={companion.name} src={companion.appearance?.avatarUrl} size={112} />
        <h1 className="font-display text-3xl font-light">{companion.name}</h1>
        <p className="text-on-surface-variant">
          Your {relationship} · {weeksTogether(companion.createdAt)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {traits.map((trait) => (
          <Chip key={trait} selected>
            {trait}
          </Chip>
        ))}
      </div>
      <div className="space-y-3 rounded-lg bg-surface-container-low p-4">
        <Meter label="Warmth" value={companion.personality?.empathyLevel ?? 7} />
        <Meter label="Humour" value={companion.personality?.humorLevel ?? 5} />
        <Meter label="Playfulness" value={companion.personality?.flirtLevel ?? 5} />
        <Meter label="Romance" value={companion.personality?.romanceLevel ?? 5} />
      </div>
      <Button asChild>
        <Link href={`/companion/${companion.id}/edit`}>Edit</Link>
      </Button>
      <ArchiveButton id={companion.id} name={companion.name} />
    </div>
  );
}

function ArchiveButton({ id, name }: { id: number; name: string }) {
  return (
    <form
      action={async () => {
        "use server";
        const { serverApi } = await import("@/lib/server/api");
        await serverApi(`/avatars/${id}`, { method: "DELETE" });
        redirect("/onboarding");
      }}
    >
      <Button variant="link" className="text-error" type="submit">
        Archive {name}
      </Button>
    </form>
  );
}
