"use client";

import { useEffect } from "react";

import { StepActions } from "@/components/companion/onboarding-chrome";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/surfaces";
import {
  EYES,
  HAIR,
  SKIN,
  STYLE_OPTIONS,
  useOnboardingDraft,
} from "@/stores/onboarding-draft";
import { cn } from "@/lib/utils";

export default function AppearanceStep() {
  const draft = useOnboardingDraft();

  useEffect(() => {
    if (draft.furthestStep < 1) draft.set({ furthestStep: 1 });
  }, [draft]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 lg:grid lg:max-w-6xl lg:grid-cols-[24rem_1fr]">
      <div className="flex justify-center lg:sticky lg:top-10 lg:block">
        <Avatar name={draft.name || "A"} size={128} />
      </div>
      <div className="flex flex-1 flex-col">
        <p className="text-sm text-on-surface-variant">Step 1 of 4</p>
        <h1 className="font-display mt-1 text-3xl font-light">Her look</h1>
        <section className="mt-8 space-y-6">
          <div>
            <h2 className="mb-3 text-sm font-semibold">Style</h2>
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map((style) => (
                <Chip
                  key={style}
                  selected={draft.style === style}
                  onClick={() => draft.set({ style })}
                >
                  {style}
                </Chip>
              ))}
            </div>
          </div>
          <SwatchRow
            label="Hair"
            values={HAIR}
            value={draft.hairColor}
            onChange={(hairColor) => draft.set({ hairColor })}
          />
          <SwatchRow
            label="Eyes"
            values={EYES}
            value={draft.eyeColor}
            onChange={(eyeColor) => draft.set({ eyeColor })}
          />
          <SwatchRow
            label="Skin"
            values={SKIN}
            value={draft.skinTone}
            onChange={(skinTone) => draft.set({ skinTone })}
          />
        </section>
        <StepActions
          backHref="/onboarding"
          continueHref="/onboarding/personality"
          skipHref="/onboarding/personality"
        />
      </div>
    </main>
  );
}

function SwatchRow({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((item) => (
          <button
            key={item}
            type="button"
            aria-label={item}
            aria-pressed={value === item}
            onClick={() => onChange(item)}
            className={cn(
              "flex size-10 items-center justify-center rounded-full border text-[10px] font-semibold",
              value === item
                ? "border-2 border-primary"
                : "border-outline-variant",
            )}
          >
            {item.slice(0, 1)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
