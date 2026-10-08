"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Chip } from "@/components/ui/surfaces";
import { api } from "@/lib/api";
import type { Memory, MemoryType } from "@/types/api";

const TYPES: MemoryType[] = [
  "PROFILE",
  "PREFERENCE",
  "RELATIONSHIP",
  "CONVERSATION",
  "FACT",
];

export function MemoryEditor({ memory }: { memory: Memory }) {
  const router = useRouter();
  const [content, setContent] = useState(memory.content);
  const [type, setType] = useState<MemoryType>(memory.type);
  const [importance, setImportance] = useState(
    Math.min(10, Math.max(1, memory.importance || 5)),
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api(`/memories/${memory.id}`, {
        method: "PATCH",
        body: { content, type, importance },
      });
      router.push("/memory");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    await api(`/memories/${memory.id}`, { method: "DELETE" });
    router.push("/memory");
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-8">
      <h1 className="text-2xl font-semibold">Memory</h1>
      <TextArea label="What she remembers" value={content} onChange={(e) => setContent(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {TYPES.map((item) => (
          <Chip key={item} selected={type === item} onClick={() => setType(item)}>
            {item}
          </Chip>
        ))}
      </div>
      <Slider label="Importance" value={importance} onValueChange={setImportance} />
      <dl className="rounded-lg bg-surface-container-low p-4 text-sm">
        <div className="flex justify-between py-1">
          <dt className="text-on-surface-variant">Source</dt>
          <dd>{memory.source ?? "—"}</dd>
        </div>
        <div className="flex justify-between py-1">
          <dt className="text-on-surface-variant">First remembered</dt>
          <dd>{new Date(memory.createdAt).toLocaleDateString()}</dd>
        </div>
        <div className="flex justify-between py-1">
          <dt className="text-on-surface-variant">Confidence</dt>
          <dd>{memory.confidence}</dd>
        </div>
      </dl>
      <div className="flex gap-3">
        <Button onClick={save} loading={saving}>
          Save
        </Button>
        <Button variant="destructive" onClick={remove}>
          Delete
        </Button>
      </div>
    </div>
  );
}
