"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/surfaces";
import { api } from "@/lib/api";
import { isApiError } from "@/lib/api-error";
import type { User } from "@/types/api";

export function PauseMemoriesToggle({ initiallyPaused }: { initiallyPaused: boolean }) {
  const [paused, setPaused] = useState(initiallyPaused);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setSaving(true);
    setError(null);
    try {
      const user = await api<User>("/users/me", {
        method: "PATCH",
        body: { memoryPaused: !paused },
      });
      setPaused(Boolean(user.memoryPaused));
    } catch (failure) {
      setError(isApiError(failure) ? failure.message : "Couldn't update this setting.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg bg-surface-container-low p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">Save new memories</div>
          <p className="text-sm text-on-surface-variant">
            {paused
              ? "Paused. She keeps what she already knows and saves nothing new from your chats."
              : "On. She saves a few important facts from your chats."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!paused}
          aria-label="Save new memories"
          disabled={saving}
          onClick={toggle}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-[0.38] ${
            paused ? "bg-surface-container-highest" : "bg-primary"
          }`}
        >
          <span
            className={`absolute top-1 size-6 rounded-full bg-on-primary transition-[left] ${
              paused ? "left-1" : "left-7"
            }`}
          />
        </button>
      </div>
      {error ? <Banner>{error}</Banner> : null}
    </section>
  );
}

export function ExportDataButton() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setExporting(true);
    setError(null);
    try {
      const data = await api<unknown>("/users/me/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (failure) {
      setError(isApiError(failure) ? failure.message : "Couldn't prepare your export.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" onClick={download} loading={exporting} className="self-start">
        Export my data
      </Button>
      <p className="text-xs text-on-surface-variant">
        A JSON file with your profile, companions, conversations, memories, images, and usage.
        Passwords and tokens stay out.
      </p>
      {error ? <Banner>{error}</Banner> : null}
    </div>
  );
}
