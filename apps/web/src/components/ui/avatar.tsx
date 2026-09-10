import * as React from "react";

import { cn } from "@/lib/utils";

export function Avatar({
  name,
  src,
  size = 40,
  className,
}: {
  name: string;
  src?: string | null;
  size?: 24 | 32 | 36 | 40 | 48 | 64 | 96 | 112 | 128;
  className?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "A";
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-container font-display font-light text-on-primary-container",
        className,
      )}
      aria-hidden={true}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}

export function Meter({
  label,
  value,
  max = 10,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const clamped = Math.max(0, Math.min(max, value));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-on-surface-variant">{clamped}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={max}
        className="h-1.5 overflow-hidden rounded-full bg-surface-container"
      >
        <div
          className="h-full bg-primary"
          style={{ width: `${(clamped / max) * 100}%` }}
        />
      </div>
    </div>
  );
}
