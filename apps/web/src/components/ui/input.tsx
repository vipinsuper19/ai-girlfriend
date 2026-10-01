import * as React from "react";

import { cn } from "@/lib/utils";

export function TextField({
  label,
  helperText,
  errorText,
  className,
  id,
  ...props
}: React.ComponentProps<"input"> & {
  label: string;
  helperText?: string;
  errorText?: string;
}) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold text-on-surface">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={Boolean(errorText)}
        aria-describedby={errorText ? errorId : helperText ? helperId : undefined}
        className={cn(
          "min-h-11 w-full rounded-md bg-surface-container-low px-4 text-base text-on-surface",
          "border border-outline-variant transition-[border-width,border-color] duration-100",
          "placeholder:text-on-surface-variant/70",
          "focus-visible:border-2 focus-visible:border-primary focus-visible:outline-none",
          errorText && "border-2 border-error",
          "disabled:opacity-[0.38]",
          className,
        )}
        {...props}
      />
      <p
        id={errorText ? errorId : helperId}
        role={errorText ? "alert" : undefined}
        className={cn(
          "min-h-4 text-xs",
          errorText ? "text-error" : "text-on-surface-variant",
        )}
      >
        {errorText ?? helperText ?? ""}
      </p>
    </div>
  );
}

export function PasswordField({
  label,
  helperText,
  errorText,
  strength,
  ...props
}: React.ComponentProps<"input"> & {
  label: string;
  helperText?: string;
  errorText?: string;
  strength?: "weak" | "fair" | "strong";
}) {
  const [visible, setVisible] = React.useState(false);
  const generatedId = React.useId();
  const inputId = props.id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold text-on-surface">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          aria-invalid={Boolean(errorText)}
          className={cn(
            "min-h-11 w-full rounded-md bg-surface-container-low px-4 pr-20 text-base text-on-surface",
            "border border-outline-variant",
            "focus-visible:border-2 focus-visible:border-primary focus-visible:outline-none",
            errorText && "border-2 border-error",
          )}
          {...props}
        />
        <button
          type="button"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-primary"
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? "Hide password" : "Show password"}
        </button>
      </div>
      {strength ? (
        <p className="text-xs text-on-surface-variant">
          Strength:{" "}
          <span
            className={cn(
              strength === "strong" && "text-success",
              strength === "fair" && "text-warning",
              strength === "weak" && "text-error",
            )}
          >
            {strength}
          </span>
        </p>
      ) : null}
      <p
        role={errorText ? "alert" : undefined}
        className={cn(
          "min-h-4 text-xs",
          errorText ? "text-error" : "text-on-surface-variant",
        )}
      >
        {errorText ?? helperText ?? ""}
      </p>
    </div>
  );
}

export function TextArea({
  label,
  className,
  ...props
}: React.ComponentProps<"textarea"> & { label?: string }) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={id} className="text-sm font-semibold text-on-surface">
          {label}
        </label>
      ) : null}
      <textarea
        id={id}
        className={cn(
          "min-h-24 w-full rounded-md border border-outline-variant bg-surface-container-low px-4 py-3 text-base text-on-surface",
          "focus-visible:border-2 focus-visible:border-primary focus-visible:outline-none",
          className,
        )}
        {...props}
      />
    </div>
  );
}
