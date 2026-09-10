import Link from "next/link";

import { Banner } from "@/components/ui/surfaces";

export const metadata = { title: "Memory and privacy" };

export default function MemoryPrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-8">
      <h1 className="text-2xl font-semibold">Memory and privacy</h1>
      <Banner tone="info">
        She doesn't store your conversations as memories. She extracts a few
        important facts, and you can read or delete every one of them.
      </Banner>
      <p className="text-sm text-on-surface-variant">
        Pause new memories and export are not available yet — there is no
        backend for either. Clear-all would issue one delete per memory; that
        control stays off until a bulk endpoint exists.
      </p>
      <Link href="/memory" className="font-semibold text-primary">
        Back to memories
      </Link>
    </div>
  );
}
