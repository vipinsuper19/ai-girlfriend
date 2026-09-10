import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const TRAIT_OPTIONS = [
  "Warm",
  "Playful",
  "Curious",
  "Calm",
  "Witty",
  "Direct",
  "Gentle",
  "Confident",
] as const;

export const STYLE_OPTIONS = ["warm", "soft", "cinematic", "natural"] as const;

export const HAIR = ["Black", "Brown", "Auburn", "Blonde", "Silver"] as const;
export const EYES = ["Brown", "Hazel", "Green", "Blue", "Grey"] as const;
export const SKIN = ["Fair", "Light", "Medium", "Tan", "Deep"] as const;

export const VOICES = [
  { id: "Aoede", label: "Aoede", description: "Warm, mid-range" },
  { id: "Kore", label: "Kore", description: "Clear and even" },
  { id: "Leda", label: "Leda", description: "Soft, lower" },
  { id: "Puck", label: "Puck", description: "Bright, playful" },
] as const;

export const RELATIONSHIPS = [
  "girlfriend",
  "partner",
  "companion",
  "friend",
] as const;

export type OnboardingDraft = {
  style: (typeof STYLE_OPTIONS)[number];
  hairColor: string;
  eyeColor: string;
  skinTone: string;
  hairStyle: string;
  ethnicity: string;
  bodyType: string;
  height: string;
  clothingStyle: string;
  traits: string[];
  empathyLevel: number;
  humorLevel: number;
  flirtLevel: number;
  romanceLevel: number;
  voiceId: string;
  relationshipType: (typeof RELATIONSHIPS)[number];
  name: string;
  furthestStep: number;
  set: (partial: Partial<OnboardingDraft>) => void;
  toggleTrait: (trait: string) => void;
  reset: () => void;
};

const defaults: Omit<OnboardingDraft, "set" | "toggleTrait" | "reset"> = {
  style: "warm",
  hairColor: "Brown",
  eyeColor: "Brown",
  skinTone: "Medium",
  hairStyle: "",
  ethnicity: "",
  bodyType: "",
  height: "",
  clothingStyle: "",
  traits: [],
  empathyLevel: 7,
  humorLevel: 5,
  flirtLevel: 5,
  romanceLevel: 5,
  voiceId: "Aoede",
  relationshipType: "girlfriend",
  name: "",
  furthestStep: 0,
};

export const useOnboardingDraft = create<OnboardingDraft>()(
  persist(
    (set, get) => ({
      ...defaults,
      set: (partial) => set(partial),
      toggleTrait: (trait) => {
        const current = get().traits;
        if (current.includes(trait)) {
          set({ traits: current.filter((item) => item !== trait) });
          return;
        }
        if (current.length >= 4) return;
        set({ traits: [...current, trait] });
      },
      reset: () => set(defaults),
    }),
    {
      name: "ag_onboarding_draft",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => {
        const { set: _set, toggleTrait: _toggle, reset: _reset, ...rest } = state;
        return rest;
      },
    },
  ),
);

export function composeSystemPrompt(draft: OnboardingDraft): string {
  const traits =
    draft.traits.length > 0 ? draft.traits.join(", ") : "warm and attentive";
  return [
    `COMPANION IDENTITY`,
    `You are ${draft.name.trim() || "her"}.`,
    ``,
    `PERSONALITY`,
    `You are ${traits}.`,
    `Warmth ${draft.empathyLevel}/10. Humour ${draft.humorLevel}/10. Playfulness ${draft.flirtLevel}/10. Romance ${draft.romanceLevel}/10.`,
    ``,
    `RELATIONSHIP`,
    `You are the user's AI ${draft.relationshipType}.`,
    ``,
    `APPEARANCE`,
    `${draft.hairColor} hair, ${draft.eyeColor} eyes, ${draft.skinTone} skin. Style: ${draft.style}.`,
    ``,
    `COMMUNICATION STYLE`,
    `Speak naturally and conversationally. Do not sound robotic. Show emotional awareness. Maintain personality consistency.`,
    ``,
    `MEMORY`,
    `Use relevant memories naturally. Do not list memories mechanically.`,
  ].join("\n");
}

export function composeGreeting(draft: OnboardingDraft): string {
  const name = draft.name.trim() || "me";
  return `Hey — I'm ${name}. I've been looking forward to this. Tell me something about your day?`;
}

export function personalityLine(draft: Pick<OnboardingDraft, "traits" | "empathyLevel" | "humorLevel">): string {
  const bits = [...draft.traits];
  if (draft.empathyLevel >= 7) bits.push("warm");
  if (draft.humorLevel >= 6) bits.push("funny");
  return bits.slice(0, 3).join(", ") || "Still finding her voice";
}
