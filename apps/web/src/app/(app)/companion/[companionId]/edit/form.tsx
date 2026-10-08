"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Banner, Chip } from "@/components/ui/surfaces";
import { api } from "@/lib/api";
import { TRAIT_OPTIONS } from "@/stores/onboarding-draft";
import type { Companion } from "@/types/api";

export function CompanionEditForm({ companion }: { companion: Companion }) {
  const router = useRouter();
  const [name, setName] = useState(companion.name);
  const [traits, setTraits] = useState<string[]>(
    Array.isArray(companion.personality?.traits)
      ? companion.personality.traits.map(String)
      : [],
  );
  const [empathyLevel, setEmpathy] = useState(companion.personality?.empathyLevel ?? 7);
  const [humorLevel, setHumor] = useState(companion.personality?.humorLevel ?? 5);
  const [flirtLevel, setFlirt] = useState(companion.personality?.flirtLevel ?? 5);
  const [romanceLevel, setRomance] = useState(companion.personality?.romanceLevel ?? 5);
  const [saving, setSaving] = useState(false);

  function toggle(trait: string) {
    setTraits((current) =>
      current.includes(trait)
        ? current.filter((item) => item !== trait)
        : current.length >= 4
          ? current
          : [...current, trait],
    );
  }

  async function save() {
    setSaving(true);
    try {
      await api(`/avatars/${companion.id}`, {
        method: "PATCH",
        body: {
          name: name.trim(),
          personality: {
            traits,
            humorLevel,
            flirtLevel,
            empathyLevel,
            romanceLevel,
          },
        },
      });
      router.push(`/companion/${companion.id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-8">
      <h1 className="text-2xl font-semibold">Edit {companion.name}</h1>
      <Banner tone="info">
        Changing her personality affects how she talks from here on. Everything
        she already remembers stays.
      </Banner>
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {TRAIT_OPTIONS.map((trait) => (
          <Chip
            key={trait}
            selected={traits.includes(trait)}
            onClick={() => toggle(trait)}
          >
            {trait}
          </Chip>
        ))}
      </div>
      <Slider label="Warmth" value={empathyLevel} onValueChange={setEmpathy} />
      <Slider label="Humour" value={humorLevel} onValueChange={setHumor} />
      <Slider label="Playfulness" value={flirtLevel} onValueChange={setFlirt} />
      <Slider label="Romance" value={romanceLevel} onValueChange={setRomance} />
      <Button onClick={save} loading={saving}>
        Save
      </Button>
    </div>
  );
}
