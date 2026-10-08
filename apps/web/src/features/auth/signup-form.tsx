"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/input";
import { Banner } from "@/components/ui/surfaces";
import { passwordStrength, registerSchema } from "@/features/auth/schemas";
import { api } from "@/lib/api";
import { isApiError } from "@/lib/api-error";

export function SignupForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = registerSchema.safeParse({
      displayName,
      email,
      password,
      acceptTerms,
    });
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        nextErrors[key] ??= issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await api("/auth/register", {
        method: "POST",
        body: {
          email: parsed.data.email,
          password: parsed.data.password,
          displayName: parsed.data.displayName,
        },
      });
      router.replace("/onboarding");
      router.refresh();
    } catch (error) {
      if (isApiError(error) && error.status === 409) {
        setFieldErrors({
          email: "That email is already registered.",
        });
      } else {
        setFormError("Something went wrong on our end. You can retry.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-2">
      {formError ? <Banner>{formError}</Banner> : null}
      <TextField
        label="Name"
        autoComplete="name"
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        errorText={fieldErrors.displayName}
      />
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        errorText={fieldErrors.email}
      />
      {fieldErrors.email?.includes("already") ? (
        <Link
          href={`/login`}
          className="text-sm font-semibold text-primary"
        >
          Log in instead
        </Link>
      ) : null}
      <PasswordField
        label="Password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        errorText={fieldErrors.password}
        strength={password ? passwordStrength(password) : undefined}
        helperText="Use at least 8 characters."
      />
      <label className="mt-1 flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-[var(--primary)]"
          checked={acceptTerms}
          onChange={(event) => setAcceptTerms(event.target.checked)}
        />
        <span>
          I accept the Terms. Pre-checking this would not be consent.
        </span>
      </label>
      {fieldErrors.acceptTerms ? (
        <p role="alert" className="text-xs text-error">
          {fieldErrors.acceptTerms}
        </p>
      ) : null}
      <Button type="submit" loading={submitting} className="mt-2 w-full">
        Create account
      </Button>
      <p className="mt-4 text-center text-sm text-on-surface-variant">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary">
          Log in
        </Link>
      </p>
    </form>
  );
}
