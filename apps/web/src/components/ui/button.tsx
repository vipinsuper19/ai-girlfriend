import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-semibold transition-[background-color,opacity,transform] duration-100 disabled:pointer-events-none disabled:opacity-[0.38] aria-disabled:opacity-[0.38]",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-on-primary hover:brightness-110 rounded-full min-h-11 px-6",
        secondary:
          "bg-primary-container text-on-primary-container hover:brightness-95 rounded-full min-h-11 px-6",
        outline:
          "border border-outline bg-transparent text-on-surface hover:bg-[var(--state-hover)] rounded-full min-h-11 px-6",
        ghost:
          "bg-transparent text-on-surface hover:bg-[var(--state-hover)] rounded-xl min-h-10 px-3",
        link: "bg-transparent text-primary underline-offset-4 hover:underline min-h-10 px-1",
        destructive:
          "bg-error text-on-error hover:brightness-110 rounded-full min-h-11 px-6",
      },
      size: {
        default: "text-[0.9375rem] leading-5",
        sm: "min-h-9 px-4 text-sm",
        icon: "size-11 rounded-full p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  children,
  disabled,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild || !loading ? children : <Loader2 className="size-5 animate-spin" />}
    </Comp>
  );
}
