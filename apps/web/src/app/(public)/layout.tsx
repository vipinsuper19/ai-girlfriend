import Link from "next/link";

import { APP_NAME } from "@/lib/utils";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-4 md:px-8">
        <Link href="/" className="font-display text-2xl font-light tracking-tight">
          {APP_NAME}
        </Link>
        <Link
          href="/login"
          className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="px-5 py-6 text-center text-xs text-on-surface-variant md:px-8">
        <Link href="/login" className="hover:underline">
          Terms
        </Link>
        {" · "}
        <Link href="/login" className="hover:underline">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
