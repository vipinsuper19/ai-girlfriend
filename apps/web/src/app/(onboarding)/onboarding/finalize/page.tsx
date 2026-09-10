"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { StepActions } from "@/components/companion/onboarding-chrome";
import { Avatar } from "@/components/ui/avatar";
import { TextField } from "@/components/ui/input";
import { Banner } from "@/components/ui/surfaces";
import { api } from "@/lib/api";
import {
  composeGreeting,
  composeSystemPrompt,
  personalityLine,
  useOnboardingDraft,
} from "@/stores/onboarding-draft";

export default function FinalizeStep() {
  const router = useRouter();
  const draft = useOnboardingDraft();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nameError =
    draft.name.trim().length > 0 && draft.name.trim().length < 2
      ? "Her name needs at least 2 characters"
      : undefined;

  useEffect(() => {
    if (draft.furthestStep < 4) draft.set({ furthestStep: 4 });
  }, [draft]);

  async function create() {
    const name = draft.name.trim();
    if (name.length < 2 || name.length > 100) {
      setError("Her name needs at least 2 characters");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api("/avatars", {
        method: "POST",
        body: {
          name,
          gender: "FEMALE",
          systemPrompt: composeSystemPrompt({ ...draft, name }),
          greeting: composeGreeting({ ...draft, name }),
          appearance: {
            hairColor: draft.hairColor,
            eyeColor: draft.eyeColor,
            skinTone: draft.skinTone,
            hairStyle: draft.hairStyle || undefined,
            ethnicity: draft.ethnicity || undefined,
            bodyType: draft.bodyType || undefined,
            height: draft.height || undefined,
            clothingStyle: draft.clothingStyle || undefined,
            imagePrompt: `${draft.style} portrait, ${draft.hairColor} hair, ${draft.eyeColor} eyes, ${draft.skinTone} skin`,
            metadata: { style: draft.style },
          },
          personality: {
            traits: draft.traits,
            interests: [],
            humorLevel: draft.humorLevel,
            flirtLevel: draft.flirtLevel,
            empathyLevel: draft.empathyLevel,
            romanceLevel: draft.romanceLevel,
            metadata: { relationshipType: draft.relationshipType },
          },
          voice: {
            provider: "gemini",
            voiceId: draft.voiceId,
            language: "en",
          },
        },
      });
      draft.reset();
      router.replace("/home");
      router.refresh();
    } catch {
      setError("She couldn't be created just then. Your answers are still here.");
    } finally {
      setLoading(false);
    }
  }

  const liveName = draft.name.trim() || "her";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 lg:grid lg:max-w-6xl lg:grid-cols-[24rem_1fr]">
      <div className="flex flex-col items-center gap-3 lg:sticky lg:top-10">
        <Avatar name={liveName} size={128} />
        <p className="font-display text-2xl font-light">{liveName}</p>
        <p className="text-sm text-on-surface-variant">{personalityLine(draft)}</p>
      </div>
      <div className="flex flex-1 flex-col">
        <p className="text-sm text-on-surface-variant">Step 4 of 4</p>
        <h1 className="font-display mt-1 text-3xl font-light">Give her a name</h1>
        {error ? <Banner className="mt-4">{error}</Banner> : null}
        <div className="mt-6">
          <TextField
            label="Name"
            value={draft.name}
            onChange={(event) => draft.set({ name: event.target.value })}
            errorText={nameError}
          />
        </div>
        <StepActions
          backHref="/onboarding/voice"
          continueLabel={`Meet ${liveName === "her" ? "her" : liveName}`}
          onContinue={create}
          disableContinue={draft.name.trim().length < 2}
          loading={loading}
        />
      </div>
    </main>
  );
}
