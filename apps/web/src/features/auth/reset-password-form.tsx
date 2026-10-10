"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/input";
import { Banner } from "@/components/ui/surfaces";
import { passwordStrength, resetPasswordSchema } from "@/features/auth/schemas";
import { api } from "@/lib/api";
import { isApiError } from "@/lib/api-error";

export function ResetPasswordForm({ token }: { token: string | null }) {
  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(null, "", "/reset-password");
    }
  }, []);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return (
      <div className="flex w-full max-w-md flex-col gap-4">
        <Banner tone="warning">
          This link has expired or was already used. Reset links work once, for 30 minutes.
        </Banner>
        <Link href="/forgot-password" className="text-center text-sm font-semibold text-primary">
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex w-full max-w-md flex-col gap-4">
        <Banner tone="info">Your password is updated. Every device was signed out, so log in again.</Banner>
        <Link href="/login" className="text-center text-sm font-semibold text-primary">
          Log in
        </Link>
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = resetPasswordSchema.safeParse({ newPassword, confirmPassword });
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        nextErrors[String(issue.path[0])] ??= issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await api("/auth/password/reset", {
        method: "POST",
        body: { token, newPassword: parsed.data.newPassword },
      });
      setDone(true);
    } catch (error) {
      if (isApiError(error) && error.status === 400) {
        setFormError("This link has expired or was already used. Request a new one.");
      } else if (!navigator.onLine) {
        setFormError("You're offline. Connect and try again.");
      } else {
        setFormError("Something went wrong on our end.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-2">
      {formError ? (
        <Banner>
          {formError}{" "}
          <Link href="/forgot-password" className="font-semibold underline">
            Send a new link
          </Link>
        </Banner>
      ) : null}
      <PasswordField
        label="New password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        errorText={fieldErrors.newPassword}
        strength={newPassword ? passwordStrength(newPassword) : undefined}
      />
      <PasswordField
        label="Confirm new password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        errorText={fieldErrors.confirmPassword}
      />
      <Button type="submit" loading={submitting} className="mt-2 w-full">
        Save new password
      </Button>
    </form>
  );
}
