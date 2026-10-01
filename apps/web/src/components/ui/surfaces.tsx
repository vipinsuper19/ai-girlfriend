import * as React from "react";

import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-lg bg-surface-container-low p-4",
        className,
      )}
      {...props}
    />
  );
}

export function Banner({
  tone = "error",
  children,
  className,
}: {
  tone?: "error" | "warning" | "info";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md px-4 py-3 text-sm",
        tone === "error" && "bg-error-container text-on-error-container",
        tone === "warning" && "bg-warning-container text-on-warning-container",
        tone === "info" && "bg-tertiary-container text-on-tertiary-container",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Chip({
  selected,
  children,
  className,
  ...props
}: React.ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-9 items-center gap-1 rounded-xs px-3 text-[0.8125rem] font-semibold",
        selected
          ? "bg-secondary-container text-on-secondary-container"
          : "border border-outline-variant text-on-surface hover:bg-[var(--state-hover)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <h2 className="font-sans text-xl font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-on-surface-variant">{description}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-surface-container-high",
        className,
      )}
    />
  );
}
