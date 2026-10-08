import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-start px-5 py-8 md:justify-center">
      <h1 className="mb-2 text-2xl font-semibold">Reset your password</h1>
      <p className="mb-6 text-on-surface-variant">
        Enter the email you signed up with and we'll send you a link.
      </p>
      <ForgotPasswordForm />
    </main>
  );
}
