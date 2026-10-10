import { redirect } from "next/navigation";

import { AppShell } from "@/components/shared/app-shell";
import { serverApi } from "@/lib/server/api";
import { isApiError } from "@/lib/api-error";
import type { Companion, User } from "@/types/api";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user: User;
  try {
    user = await serverApi<User>("/users/me");
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      redirect("/api/bff/auth/logout");
    }
    throw error;
  }

  let companions: Companion[] = [];
  try {
    companions = await serverApi<Companion[]>("/avatars");
  } catch {
    companions = [];
  }

  const companion = companions[0] ?? null;

  return (
    <AppShell user={user} companion={companion}>
      {children}
    </AppShell>
  );
}
