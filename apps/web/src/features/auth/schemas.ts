import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter a valid email address")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password").max(128, "Enter your password"),
});

export const registerSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Your name needs at least 2 characters")
    .max(100, "Your name needs at least 2 characters"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter a valid email address")
    .email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(128, "Use at least 8 characters"),
  acceptTerms: z
    .boolean()
    .refine((value) => value === true, "Please accept the Terms to continue"),
});

export const forgotPasswordSchema = z.object({
  email: loginSchema.shape.email,
});

export const resetPasswordSchema = z
  .object({
    newPassword: registerSchema.shape.password,
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Both passwords need to match",
  });

export const changeEmailSchema = z.object({
  newEmail: loginSchema.shape.email,
  password: loginSchema.shape.password,
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;

export function passwordStrength(password: string): "weak" | "fair" | "strong" {
  if (password.length >= 12) return "strong";
  if (password.length >= 8) return "fair";
  return "weak";
}
