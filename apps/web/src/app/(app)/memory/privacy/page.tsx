import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/surfaces";
import { ExportDataButton, PauseMemoriesToggle } from "@/features/account/privacy-controls";
import { serverApi } from "@/lib/server/api";
import type { User } from "@/types/api";

export const metadata = { title: "Memory and privacy" };

export default async function MemoryPrivacyPage() {
  const user = await serverApi<User>("/users/me");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-8">
      <h1 className="text-2xl font-semibold">Memory and privacy</h1>
      <Banner tone="info">
        She doesn't store your conversations as memories. She extracts a few
        important facts, and you can read or delete every one of them.
      </Banner>
      <PauseMemoriesToggle initiallyPaused={Boolean(user.memoryPaused)} />
      <ExportDataButton />
      <form
        action={async () => {
          "use server";
          await serverApi("/memories", { method: "DELETE" });
          redirect("/memory");
        }}
      >
        <Button variant="destructive" type="submit">
          Clear all memories
        </Button>
      </form>
      <Link href="/memory" className="font-semibold text-primary">
        Back to memories
      </Link>
    </div>
  );
}
