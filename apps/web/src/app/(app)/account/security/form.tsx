"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Banner } from "@/components/ui/surfaces";
import { api } from "@/lib/api";
import type { User } from "@/types/api";

export function SecurityForm({ user }: { user: User }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api("/users/me", {
        method: "PATCH",
        body: { displayName: displayName.trim() },
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function destroy() {
    if (confirm !== "DELETE") return;
    await api("/users/me", { method: "DELETE" });
    await fetch("/api/bff/auth/logout", { method: "POST", credentials: "include" });
    router.replace("/");
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-8">
      <h1 className="text-2xl font-semibold">Account and security</h1>
      <TextField
        label="Display name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
      <Button onClick={save} loading={saving}>
        Save name
      </Button>
      <div className="rounded-lg bg-surface-container-low p-4 opacity-[0.55]">
        <div className="text-sm font-semibold">Email</div>
        <div className="text-sm text-on-surface-variant">
          {user.email} — no change-email endpoint yet
        </div>
      </div>
      <div className="rounded-lg bg-surface-container-low p-4 opacity-[0.55]">
        <div className="text-sm font-semibold">Password</div>
        <div className="text-sm text-on-surface-variant">
          No change-password endpoint yet
        </div>
      </div>
      <Banner tone="warning">
        Deleting your account removes you, her, every conversation, and
        everything she remembers. Type DELETE to confirm.
      </Banner>
      <TextField
        label="Type DELETE"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <Button
        variant="destructive"
        disabled={confirm !== "DELETE"}
        onClick={destroy}
      >
        Delete account
      </Button>
    </div>
  );
}
