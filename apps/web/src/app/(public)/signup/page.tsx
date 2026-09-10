import { SignupForm } from "@/features/auth/signup-form";

export const metadata = { title: "Create your account" };

export default function SignupPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-start px-5 py-8 md:justify-center">
      <h1 className="mb-2 text-2xl font-semibold">Create your account</h1>
      <p className="mb-6 text-on-surface-variant">
        A name, an email, a password. Then you meet her.
      </p>
      <SignupForm />
    </main>
  );
}
