"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MessageCircle,
  Brain,
  UserRound,
} from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import type { Companion, User } from "@/types/api";
import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/home",
    label: "Home",
    icon: Home,
  },
  {
    href: "/chat",
    label: "Chat",
    icon: MessageCircle,
  },
  {
    href: "/memory",
    label: "Memory",
    icon: Brain,
  },
  {
    href: "/account",
    label: "You",
    icon: UserRound,
  },
] as const;

export function AppShell({
  user,
  companion,
  children,
}: {
  user: User;
  companion: Companion | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hideNav =
    pathname.startsWith("/chat/") &&
    !pathname.endsWith("/history") &&
    pathname !== "/chat";

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[72px] flex-col border-r border-outline-variant bg-surface md:flex lg:w-[264px]">
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1 p-3">
          {TABS.map((tab) => {
            const active =
              tab.href === "/chat"
                ? pathname.startsWith("/chat")
                : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center gap-3 rounded-full px-3 py-3 text-sm font-semibold",
                  active
                    ? "bg-secondary-container text-on-secondary-container"
                    : "text-on-surface-variant hover:bg-[var(--state-hover)]",
                )}
              >
                <Icon className="size-5" />
                <span className="hidden lg:inline">{tab.label}</span>
              </Link>
            );
          })}
        </nav>
        {companion ? (
          <Link
            href={`/companion/${companion.id}`}
            className="m-3 flex items-center gap-3 rounded-lg p-2 hover:bg-[var(--state-hover)]"
          >
            <Avatar name={companion.name} src={companion.appearance?.avatarUrl} size={40} />
            <div className="hidden min-w-0 lg:block">
              <div className="truncate font-semibold">{companion.name}</div>
              <div className="text-xs text-on-surface-variant">Active now</div>
            </div>
          </Link>
        ) : (
          <div className="hidden p-4 text-xs text-on-surface-variant lg:block">
            {user.displayName}
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:p-2"
        >
          Skip to main content
        </a>
        <main id="main" className="flex min-h-0 flex-1 flex-col">
          {children}
        </main>
        {!hideNav ? (
          <nav
            aria-label="Main"
            className="sticky bottom-0 z-20 flex border-t border-outline-variant bg-surface-container pb-[env(safe-area-inset-bottom)] md:hidden"
          >
            {TABS.map((tab) => {
              const active =
                tab.href === "/chat"
                  ? pathname.startsWith("/chat")
                  : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 py-2 text-[0.6875rem] font-semibold",
                    active ? "text-on-secondary-container" : "text-on-surface-variant",
                  )}
                >
                  <span
                    className={cn(
                      "rounded-full px-4 py-1",
                      active && "bg-secondary-container",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
