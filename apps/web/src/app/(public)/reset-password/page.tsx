import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { nestRequest, parseEnvelope } from "@/lib/server/nest";

export const metadata = { title: "Choose a new password", referrer: "no-referrer" as const };
export const dynamic = "force-dynamic";

async function tokenIsValid(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const response = await nestRequest("/auth/password/reset/check", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    return (await parseEnvelope<{ valid: boolean }>(response)).valid === true;
  } catch {
    return false;
  }
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : "";
  const valid = await tokenIsValid(token);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-start px-5 py-8 md:justify-center">
      <h1 className="mb-2 text-2xl font-semibold">Choose a new password</h1>
      <p className="mb-6 text-on-surface-variant">
        Use at least 8 characters. You'll log in again on every device afterwards.
      </p>
      <ResetPasswordForm token={valid ? token : null} />
    </main>
  );
}
