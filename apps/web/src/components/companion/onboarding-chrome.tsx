"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = [
  { href: "/onboarding/appearance", label: "Look" },
  { href: "/onboarding/personality", label: "Personality" },
  { href: "/onboarding/voice", label: "Voice" },
  { href: "/onboarding/finalize", label: "Name" },
];

export function OnboardingChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const index = STEPS.findIndex((step) => pathname.startsWith(step.href));
  const current = index + 1;

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="px-5 pt-6 md:px-8">
        {current > 0 ? (
          <div
            className="mx-auto flex max-w-3xl gap-2"
            aria-label={`Step ${current} of 4`}
          >
            {STEPS.map((step, i) => (
              <Link
                key={step.href}
                href={step.href}
                aria-current={i === index ? "step" : undefined}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  i <= index ? "bg-primary" : "bg-surface-container-high",
                )}
              />
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

export function StepActions({
  backHref,
  continueHref,
  continueLabel = "Continue",
  onContinue,
  skipHref,
  disableContinue,
  loading,
}: {
  backHref?: string;
  continueHref?: string;
  continueLabel?: string;
  onContinue?: () => void;
  skipHref?: string;
  disableContinue?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-8">
      {backHref ? (
        <Button variant="ghost" asChild>
          <Link href={backHref}>Back</Link>
        </Button>
      ) : (
        <span />
      )}
      <div className="flex gap-3">
        {skipHref ? (
          <Button variant="outline" asChild>
            <Link href={skipHref}>Skip for now</Link>
          </Button>
        ) : null}
        {onContinue ? (
          <Button onClick={onContinue} loading={loading} disabled={disableContinue}>
            {continueLabel}
          </Button>
        ) : (
          <Button asChild disabled={disableContinue}>
            <Link href={continueHref ?? "#"}>{continueLabel}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
