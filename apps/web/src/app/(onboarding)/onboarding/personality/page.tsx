"use client";

import { useEffect } from "react";

import { StepActions } from "@/components/companion/onboarding-chrome";
import { Avatar } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";
import { Chip } from "@/components/ui/surfaces";
import {
  TRAIT_OPTIONS,
  personalityLine,
  useOnboardingDraft,
} from "@/stores/onboarding-draft";

export default function PersonalityStep() {
  const draft = useOnboardingDraft();

  useEffect(() => {
    if (draft.furthestStep < 2) draft.set({ furthestStep: 2 });
  }, [draft]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 lg:grid lg:max-w-6xl lg:grid-cols-[24rem_1fr]">
      <div className="flex flex-col items-center gap-3 lg:sticky lg:top-10">
        <Avatar name={draft.name || "A"} size={128} />
        <p className="text-sm text-on-surface-variant">{personalityLine(draft)}</p>
      </div>
      <div className="flex flex-1 flex-col">
        <p className="text-sm text-on-surface-variant">Step 2 of 4</p>
        <h1 className="font-display mt-1 text-3xl font-light">Her personality</h1>
        <div className="mt-8 flex flex-wrap gap-2">
          {TRAIT_OPTIONS.map((trait) => {
            const selected = draft.traits.includes(trait);
            const blocked = !selected && draft.traits.length >= 4;
            return (
              <Chip
                key={trait}
                selected={selected}
                aria-disabled={blocked}
                onClick={() => {
                  if (blocked) return;
                  draft.toggleTrait(trait);
                }}
              >
                {trait}
              </Chip>
            );
          })}
        </div>
        {draft.traits.length >= 4 ? (
          <p className="mt-2 text-xs text-on-surface-variant">
            Four is the limit — deselect one to change
          </p>
        ) : null}
        <div className="mt-8 space-y-5">
          <Slider
            label="Warmth"
            value={draft.empathyLevel}
            onValueChange={(empathyLevel) => draft.set({ empathyLevel })}
          />
          <Slider
            label="Humour"
            value={draft.humorLevel}
            onValueChange={(humorLevel) => draft.set({ humorLevel })}
          />
          <Slider
            label="Playfulness"
            value={draft.flirtLevel}
            onValueChange={(flirtLevel) => draft.set({ flirtLevel })}
          />
          <Slider
            label="Romance"
            value={draft.romanceLevel}
            onValueChange={(romanceLevel) => draft.set({ romanceLevel })}
          />
        </div>
        <StepActions
          backHref="/onboarding/appearance"
          continueHref="/onboarding/voice"
          skipHref="/onboarding/voice"
        />
      </div>
    </main>
  );
}
