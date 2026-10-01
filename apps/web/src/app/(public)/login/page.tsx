import { Suspense } from "react";

import { LoginForm } from "@/features/auth/login-form";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-start px-5 py-8 md:justify-center">
      <h1 className="mb-2 text-2xl font-semibold">Welcome back</h1>
      <p className="mb-6 text-on-surface-variant">
        Log in to continue the conversation.
      </p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
