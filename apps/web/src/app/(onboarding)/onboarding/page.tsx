"use client";

import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useOnboardingDraft } from "@/stores/onboarding-draft";

export default function OnboardingIntroPage() {
  const furthestStep = useOnboardingDraft((state) => state.furthestStep);
  const href =
    furthestStep >= 1 ? "/onboarding/appearance" : "/onboarding/appearance";
  const label =
    furthestStep > 0 ? "Continue where you left off" : "Let's begin";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 lg:grid lg:max-w-6xl lg:grid-cols-[24rem_1fr] lg:items-start">
      <div className="hidden lg:sticky lg:top-10 lg:flex lg:flex-col lg:items-center lg:gap-4">
        <Avatar name="A" size={128} />
        <p className="text-sm text-on-surface-variant">She starts as a blank slate</p>
      </div>
      <div className="flex flex-1 flex-col">
        <h1 className="font-display text-3xl font-light">Meet someone new</h1>
        <p className="mt-3 max-w-prose text-on-surface-variant">
          Four short steps. You can skip any of them except her name.
        </p>
        <ul className="mt-8 space-y-4 text-on-surface">
          <li>
            <strong>Her personality</strong> — how she talks, jokes, and cares.
          </li>
          <li>
            <strong>Her look</strong> — a face you chose, not a stock portrait.
          </li>
          <li>
            <strong>Her memory</strong> — she keeps what matters, and you can
            read and delete all of it.
          </li>
        </ul>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href={href}>{label}</Link>
          </Button>
          <Button variant="link" asChild>
            <Link href="/home">I'll do this later</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
