"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import type { Companion, User } from "@/types/api";

export function AccountHome({
  user,
  companion,
}: {
  user: User;
  companion: Companion | null;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/bff/auth/logout", { method: "POST", credentials: "include" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-8">
      <h1 className="text-2xl font-semibold">You</h1>
      <div className="rounded-lg bg-surface-container-low p-4">
        <div className="font-semibold">{user.displayName}</div>
        <div className="text-sm text-on-surface-variant">{user.email}</div>
      </div>
      <Section title="Companion">
        {companion ? (
          <Row href={`/companion/${companion.id}`} label={companion.name} value="Profile" />
        ) : (
          <Row href="/onboarding" label="Create companion" value="" />
        )}
      </Section>
      <Section title="Account">
        <Row href="/account/security" label="Account and security" value="" />
        <Row href="/account/subscription" label="Subscription" value="Free" />
        <Row href="/account/appearance" label="Appearance" value="" />
        <Row href="/account/privacy" label="Privacy and data" value="" />
      </Section>
      <Button variant="outline" onClick={logout}>
        Log out
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-on-surface-variant">{title}</h2>
      <div className="overflow-hidden rounded-lg bg-surface-container-low">{children}</div>
    </section>
  );
}

function Row({
  href,
  label,
  value,
  disabled,
}: {
  href?: string;
  label: string;
  value: string;
  disabled?: boolean;
}) {
  const inner = (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <span>{label}</span>
      <span className="text-on-surface-variant">{value}</span>
    </div>
  );
  if (disabled || !href) {
    return <div className="opacity-[0.38]">{inner}</div>;
  }
  return <Link href={href}>{inner}</Link>;
}

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5 py-8">
      <h1 className="text-2xl font-semibold">Appearance</h1>
      <div className="flex gap-2">
        {(["light", "dark", "system"] as const).map((value) => (
          <Button
            key={value}
            variant={theme === value ? "primary" : "outline"}
            onClick={() => setTheme(value)}
          >
            {value}
          </Button>
        ))}
      </div>
    </div>
  );
}
