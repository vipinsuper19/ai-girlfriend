"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/input";
import { Banner } from "@/components/ui/surfaces";
import { loginSchema } from "@/features/auth/schemas";
import { api } from "@/lib/api";
import { isApiError } from "@/lib/api-error";
import { safeNextPath } from "@/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password });
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
      await api("/auth/login", {
        method: "POST",
        body: parsed.data,
      });
      router.replace(next ?? "/home");
      router.refresh();
    } catch (error) {
      if (isApiError(error) && error.status === 401) {
        setFormError("Email or password is incorrect.");
        setPassword("");
      } else if (!navigator.onLine) {
        setOffline(true);
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
      {offline ? (
        <Banner tone="warning">You're offline. Logging in needs a connection.</Banner>
      ) : null}
      {formError ? <Banner>{formError}</Banner> : null}
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
      <PasswordField
        label="Password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        errorText={fieldErrors.password}
      />
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-semibold text-primary">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" loading={submitting} className="mt-2 w-full">
        Log in
      </Button>
      <p className="mt-4 text-center text-sm text-on-surface-variant">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-primary">
          Create an account
        </Link>
      </p>
    </form>
  );
}
