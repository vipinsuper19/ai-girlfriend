"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-on-surface-variant">
        The page hit an unexpected error. Your conversations and memories are
        safe.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
