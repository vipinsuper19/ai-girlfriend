import Link from "next/link";

import { ExportDataButton } from "@/features/account/privacy-controls";

export const metadata = { title: "Privacy and data" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5 py-8">
      <h1 className="text-2xl font-semibold">Privacy and data</h1>
      <p className="text-sm text-on-surface-variant">
        Conversations are stored so she can reply with context. Memories are a
        smaller extracted set you can edit, pause, or clear. Files you create,
        like voice notes and images, are served from unguessable links and are
        removed when you delete them or your account.
      </p>
      <ExportDataButton />
      <Link href="/memory/privacy" className="text-sm font-semibold text-primary">
        Memory settings
      </Link>
    </div>
  );
}
