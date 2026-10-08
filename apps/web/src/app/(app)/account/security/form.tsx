"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/input";
import { Banner } from "@/components/ui/surfaces";
import { changeEmailSchema } from "@/features/auth/schemas";
import { api } from "@/lib/api";
import { isApiError } from "@/lib/api-error";
import type { User } from "@/types/api";

export function SecurityForm({ user }: { user: User }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordNote, setPasswordNote] = useState<string | null>(null);
  const [passwordFailed, setPasswordFailed] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [email, setEmail] = useState(user.email);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailNote, setEmailNote] = useState<string | null>(null);
  const [emailFailed, setEmailFailed] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);

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

  async function changePassword() {
    setPasswordFailed(false);
    setPasswordNote(null);
    if (!currentPassword) {
      setPasswordFailed(true);
      setPasswordNote("Enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordFailed(true);
      setPasswordNote("Use at least 8 characters.");
      return;
    }
    if (newPassword.length > 128) {
      setPasswordFailed(true);
      setPasswordNote("Keep the password under 128 characters.");
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordFailed(true);
      setPasswordNote("Choose a different password.");
      return;
    }
    setChangingPassword(true);
    try {
      await api("/auth/password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      setPasswordNote("Password updated.");
    } catch (error) {
      setPasswordFailed(true);
      setPasswordNote(isApiError(error) ? error.message : "Couldn't change your password.");
    } finally {
      setChangingPassword(false);
    }
  }

  async function changeEmail() {
    setEmailFailed(false);
    setEmailNote(null);
    const parsed = changeEmailSchema.safeParse({ newEmail, password: emailPassword });
    if (!parsed.success) {
      setEmailFailed(true);
      setEmailNote(parsed.error.issues[0]?.message ?? "Check the email and password.");
      return;
    }
    if (parsed.data.newEmail === email.toLowerCase()) {
      setEmailFailed(true);
      setEmailNote("That is already your email.");
      return;
    }
    setChangingEmail(true);
    try {
      const updated = await api<{ email: string }>("/auth/email", {
        method: "POST",
        body: parsed.data,
      });
      setEmail(updated.email);
      setNewEmail("");
      setEmailPassword("");
      setEmailNote("Email updated. Other devices were signed out.");
      router.refresh();
    } catch (error) {
      setEmailFailed(true);
      setEmailNote(isApiError(error) ? error.message : "Couldn't change your email.");
    } finally {
      setChangingEmail(false);
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
      <section className="flex flex-col gap-2 rounded-lg bg-surface-container-low p-4">
        <div className="text-sm font-semibold">Email</div>
        <div className="text-sm text-on-surface-variant">{email}</div>
        <TextField
          label="New email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={newEmail}
          onChange={(event) => setNewEmail(event.target.value)}
        />
        <PasswordField
          label="Password to confirm"
          autoComplete="current-password"
          value={emailPassword}
          onChange={(event) => setEmailPassword(event.target.value)}
          errorText={emailFailed ? emailNote ?? undefined : undefined}
          helperText={!emailFailed ? emailNote ?? undefined : undefined}
        />
        <Button variant="secondary" onClick={changeEmail} loading={changingEmail}>
          Change email
        </Button>
      </section>
      <PasswordField
        label="Current password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
      />
      <PasswordField
        label="New password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        errorText={passwordFailed ? passwordNote ?? undefined : undefined}
        helperText={!passwordFailed ? passwordNote ?? undefined : undefined}
      />
      <Button onClick={changePassword} loading={changingPassword}>
        Change password
      </Button>
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
