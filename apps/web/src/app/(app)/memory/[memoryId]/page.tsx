import { notFound } from "next/navigation";

import { MemoryEditor } from "./editor";
import { serverApi } from "@/lib/server/api";
import type { Memory } from "@/types/api";

export default async function MemoryDetailPage({
  params,
}: {
  params: Promise<{ memoryId: string }>;
}) {
  const { memoryId } = await params;
  try {
    const memory = await serverApi<Memory>(`/memories/${memoryId}`);
    return <MemoryEditor memory={memory} />;
  } catch {
    notFound();
  }
}
