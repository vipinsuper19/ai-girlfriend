import { notFound } from "next/navigation";

import { CompanionEditForm } from "./form";
import { serverApi } from "@/lib/server/api";
import type { Companion } from "@/types/api";

export default async function CompanionEditPage({
  params,
}: {
  params: Promise<{ companionId: string }>;
}) {
  const { companionId } = await params;
  try {
    const companion = await serverApi<Companion>(`/avatars/${companionId}`);
    return <CompanionEditForm companion={companion} />;
  } catch {
    notFound();
  }
}
