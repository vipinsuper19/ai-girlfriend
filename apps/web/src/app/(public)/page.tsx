import Link from "next/link";

import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/utils";

export const metadata = { title: "Someone who remembers" };

export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-5 py-10 md:px-8 lg:py-16">
      <section className="grid items-center gap-10 lg:grid-cols-2">
        <div className="flex max-w-xl flex-col gap-6">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            {APP_NAME}
          </p>
          <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.05] font-light tracking-[-0.02em]">
            Someone who remembers.
          </h1>
          <p className="max-w-prose text-lg text-on-surface-variant">
            Create a companion with her own personality — and a memory that
            grows with every conversation.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href="/signup">Get started</Link>
            </Button>
            <Button variant="link" asChild>
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
        </div>
        <div className="flex min-h-72 items-end justify-center rounded-lg bg-surface-container-high p-10">
          <div className="flex size-40 items-center justify-center rounded-full bg-primary-container font-display text-6xl font-light text-on-primary-container">
            A
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: "A personality you choose",
            body: "Warmth, humour, playfulness, romance — sliders that map to how she actually talks.",
          },
          {
            title: "A memory you can read",
            body: "She keeps what matters. You can open, edit, or delete any of it.",
          },
          {
            title: "A conversation that continues",
            body: "Text now, voice when the backend can hear the browser. History stays.",
          },
        ].map((item) => (
          <div key={item.title} className="rounded-lg bg-surface-container-low p-5">
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm text-on-surface-variant">{item.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
