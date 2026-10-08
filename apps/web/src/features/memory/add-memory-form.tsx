"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/input";
import { Banner, Chip } from "@/components/ui/surfaces";
import { api } from "@/lib/api";
import { isApiError } from "@/lib/api-error";
import type { MemoryType } from "@/types/api";

const MEMORY_CONTENT_MAX = 2000;
const TYPES: MemoryType[] = ["PROFILE", "PREFERENCE", "RELATIONSHIP", "FACT"];

export function AddMemoryForm({ companionId, companionName }: { companionId: number; companionName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [type, setType] = useState<MemoryType>("FACT");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="self-start">
        Tell {companionName} something to remember
      </Button>
    );
  }

  async function save() {
    if (!content.trim()) {
      setError("Write what she should remember.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api("/memories", {
        method: "POST",
        body: { companionId, content: content.trim(), type },
      });
      setContent("");
      setOpen(false);
      router.refresh();
    } catch (failure) {
      setError(isApiError(failure) ? failure.message : "Couldn't save that memory.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg bg-surface-container-low p-4">
      {error ? <Banner>{error}</Banner> : null}
      <TextArea
        label={`What should ${companionName} remember?`}
        value={content}
        maxLength={MEMORY_CONTENT_MAX}
        onChange={(event) => setContent(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {TYPES.map((item) => (
          <Chip key={item} selected={type === item} onClick={() => setType(item)}>
            {item}
          </Chip>
        ))}
      </div>
      <div className="flex gap-2">
        <Button onClick={save} loading={saving}>
          Save memory
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
