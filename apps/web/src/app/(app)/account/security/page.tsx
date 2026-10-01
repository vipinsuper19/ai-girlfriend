import { SecurityForm } from "./form";
import { serverApi } from "@/lib/server/api";
import type { User } from "@/types/api";

export const metadata = { title: "Account and security" };

export default async function SecurityPage() {
  const user = await serverApi<User>("/users/me");
  return <SecurityForm user={user} />;
}
