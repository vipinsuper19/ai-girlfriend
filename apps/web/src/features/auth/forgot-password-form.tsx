"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Banner } from "@/components/ui/surfaces";
import { forgotPasswordSchema } from "@/features/auth/schemas";
import { api } from "@/lib/api";

const RESEND_AFTER_MS = 60_000;

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (sentAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [sentAt]);

  const waitSeconds = sentAt === null
    ? 0
    : Math.max(0, Math.ceil((sentAt + RESEND_AFTER_MS - now) / 1000));

  async function send(address: string) {
    setFormError(null);
    setSubmitting(true);
    try {
      await api("/auth/password/forgot", { method: "POST", body: { email: address } });
      setSentTo(address);
      setSentAt(Date.now());
      setNow(Date.now());
    } catch {
      setFormError(
        navigator.onLine
          ? "Something went wrong on our end."
          : "You're offline. Connect and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    await send(parsed.data.email);
  }

  if (sentTo) {
    return (
      <div className="flex w-full max-w-md flex-col gap-4">
        {formError ? <Banner>{formError}</Banner> : null}
        <Banner tone="info">
          If an account exists for {sentTo}, we've sent a link to reset your password. It expires in
          30 minutes.
        </Banner>
        <Button
          variant="secondary"
          loading={submitting}
          disabled={waitSeconds > 0}
          onClick={() => send(sentTo)}
          className="w-full"
        >
          {waitSeconds > 0 ? `Send again in ${waitSeconds}s` : "Send again"}
        </Button>
        <Link href="/login" className="text-center text-sm font-semibold text-primary">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-2">
      {formError ? <Banner>{formError}</Banner> : null}
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        errorText={fieldError}
      />
      <Button type="submit" loading={submitting} className="mt-2 w-full">
        Send reset link
      </Button>
      <p className="mt-4 text-center text-sm text-on-surface-variant">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-primary">
          Back to log in
        </Link>
      </p>
    </form>
  );
}
