import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";

  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function weeksTogether(createdAt: string | Date | null | undefined): string {
  if (!createdAt) return "Just met";
  const date = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const weeks = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / (7 * 24 * 60 * 60 * 1000)),
  );
  if (weeks < 1) return "Just met";
  if (weeks === 1) return "1 week together";
  return `${weeks} weeks together`;
}

const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password"];

export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("://")) return null;
  return value;
}

export function safeAppPath(value: string | null | undefined): string {
  const next = safeNextPath(value);
  if (!next) return "/home";
  const pathOnly = next.split("?")[0] ?? next;
  if (pathOnly.startsWith("/api")) return "/home";
  if (AUTH_PAGES.includes(pathOnly)) return "/home";
  return next;
}

export function errorMessage(payload: unknown, fallback = "Something went wrong"): string {
  if (!payload || typeof payload !== "object") return fallback;
  const message = (payload as { message?: string | string[] }).message;
  if (Array.isArray(message)) return message[0] ?? fallback;
  if (typeof message === "string" && message.length > 0) return message;
  return fallback;
}

export function firstName(displayName: string | null | undefined): string {
  if (!displayName) return "there";
  return displayName.trim().split(/\s+/)[0] ?? "there";
}

export const PASSWORD_RESET_ENABLED =
  process.env.NEXT_PUBLIC_FEATURE_PASSWORD_RESET === "true";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Lumen";
