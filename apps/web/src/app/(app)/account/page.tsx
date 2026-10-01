import { AccountHome } from "./account-client";
import { serverApi } from "@/lib/server/api";
import type { Companion, User } from "@/types/api";

export const metadata = { title: "You" };

export default async function AccountPage() {
  const user = await serverApi<User>("/users/me");
  const companions = await serverApi<Companion[]>("/avatars").catch(() => []);
  return <AccountHome user={user} companion={companions[0] ?? null} />;
}
