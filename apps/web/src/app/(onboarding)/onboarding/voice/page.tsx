"use client";

import { useEffect } from "react";

import { StepActions } from "@/components/companion/onboarding-chrome";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/surfaces";
import {
  RELATIONSHIPS,
  VOICES,
  useOnboardingDraft,
} from "@/stores/onboarding-draft";
import { cn } from "@/lib/utils";

export default function VoiceStep() {
  const draft = useOnboardingDraft();

  useEffect(() => {
    if (draft.furthestStep < 3) draft.set({ furthestStep: 3 });
  }, [draft]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 lg:grid lg:max-w-6xl lg:grid-cols-[24rem_1fr]">
      <div className="flex justify-center lg:sticky lg:top-10 lg:block">
        <Avatar name={draft.name || "A"} size={128} />
      </div>
      <div className="flex flex-1 flex-col">
        <p className="text-sm text-on-surface-variant">Step 3 of 4</p>
        <h1 className="font-display mt-1 text-3xl font-light">Voice and framing</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Samples ship later. The choice still writes a real voice row — skipping
          without one would break speech.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {VOICES.map((voice) => (
            <button
              key={voice.id}
              type="button"
              onClick={() => draft.set({ voiceId: voice.id })}
              className={cn(
                "rounded-lg border p-4 text-left",
                draft.voiceId === voice.id
                  ? "border-2 border-primary bg-primary-container"
                  : "border-outline-variant bg-surface-container-low",
              )}
            >
              <div className="font-semibold">{voice.label}</div>
              <div className="text-sm text-on-surface-variant">
                {voice.description}
              </div>
            </button>
          ))}
        </div>
        <h2 className="mt-8 mb-3 text-sm font-semibold">She is your</h2>
        <div className="flex flex-wrap gap-2">
          {RELATIONSHIPS.map((item) => (
            <Chip
              key={item}
              selected={draft.relationshipType === item}
              onClick={() => draft.set({ relationshipType: item })}
            >
              {item}
            </Chip>
          ))}
        </div>
        <StepActions
          backHref="/onboarding/personality"
          continueHref="/onboarding/finalize"
          skipHref="/onboarding/finalize"
        />
      </div>
    </main>
  );
}
