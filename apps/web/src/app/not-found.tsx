import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="font-display text-4xl font-light">This page isn't here</h1>
      <p className="text-on-surface-variant">
        The link may be old. You can go home, or back to the last conversation.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/home">Go home</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/chat">Open chat</Link>
        </Button>
      </div>
    </main>
  );
}
