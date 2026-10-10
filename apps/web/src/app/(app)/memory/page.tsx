import Link from "next/link";

import { EmptyState } from "@/components/ui/surfaces";
import { AddMemoryForm } from "@/features/memory/add-memory-form";
import { cn, formatRelativeTime } from "@/lib/utils";
import { serverApi } from "@/lib/server/api";
import type { Companion, Memory, MemoryType } from "@/types/api";

export const metadata = { title: "Memory" };

const TYPES: Array<{ id?: MemoryType; label: string }> = [
  { label: "All" },
  { id: "PROFILE", label: "Profile" },
  { id: "PREFERENCE", label: "Preference" },
  { id: "RELATIONSHIP", label: "Relationship" },
  { id: "CONVERSATION", label: "Conversation" },
  { id: "FACT", label: "Fact" },
];

const TYPE_CLASS: Record<MemoryType, string> = {
  PROFILE: "bg-primary-container text-on-primary-container",
  PREFERENCE: "bg-tertiary-container text-on-tertiary-container",
  RELATIONSHIP: "bg-success-container text-on-success-container",
  CONVERSATION: "bg-surface-container-high text-on-surface",
  FACT: "bg-secondary-container text-on-secondary-container",
};

function importanceLabel(value: number): string {
  if (value >= 9) return `${value} — she'll bring this up unprompted`;
  if (value >= 7) return `${value} — likely to come up`;
  if (value >= 4) return `${value} — useful context`;
  return `${value} — background`;
}

export default async function MemoryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const query = type ? `?type=${encodeURIComponent(type)}&limit=50` : "?limit=50";
  const [memories, companions] = await Promise.all([
    serverApi<Memory[]>(`/memories${query}`).catch(() => []),
    serverApi<Companion[]>("/avatars").catch(() => []),
  ]);
  const companion = companions.find((item) => item.status === "ACTIVE");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Memory</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          {memories.length} things she remembers about you. Edit or delete
          anything here — she'll forget it immediately.
        </p>
      </div>
      {companion ? <AddMemoryForm companionId={companion.id} companionName={companion.name} /> : null}
      <div className="flex flex-wrap gap-2">
        {TYPES.map((item) => {
          const href = item.id ? `/memory?type=${item.id}` : "/memory";
          const active = item.id ? type === item.id : !type;
          return (
            <Link
              key={item.label}
              href={href}
              className={cn(
                "rounded-xs px-3 py-2 text-sm font-semibold",
                active
                  ? "bg-secondary-container text-on-secondary-container"
                  : "border border-outline-variant",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      {memories.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="Memory comes from talking to her, or from anything you tell her to remember above."
        />
      ) : (
        <ul className="space-y-3">
          {memories.map((memory) => (
            <li key={memory.id}>
              <Link
                href={`/memory/${memory.id}`}
                className="block rounded-lg bg-surface-container-low p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "rounded-xs px-2 py-0.5 text-[11px] font-semibold",
                      TYPE_CLASS[memory.type],
                    )}
                  >
                    {memory.type}
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    {formatRelativeTime(memory.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm">{memory.content}</p>
                <p className="mt-2 text-xs text-on-surface-variant">
                  {importanceLabel(memory.importance)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/memory/privacy" className="text-sm font-semibold text-primary">
        Memory and privacy
      </Link>
    </div>
  );
}
