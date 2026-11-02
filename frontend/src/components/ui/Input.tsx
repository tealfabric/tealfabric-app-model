import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/ui/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export function Input({ label, helperText, error, className, id, ...props }: InputProps) {
  const inputId = id ?? (label ? label.replace(/\s+/g, "-").toLowerCase() : undefined);

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="mb-2 block text-small font-medium text-text">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={cn(
          "flex h-9 w-full rounded-sm border bg-bg px-3 py-2 text-body text-text",
          "placeholder:text-text-disabled",
          "hover:border-border-strong",
          "focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]",
          "disabled:cursor-not-allowed disabled:bg-bg-muted disabled:text-text-disabled",
          error ? "border-error" : "border-border",
          className
        )}
        {...props}
      />
      {error ? (
        <p className="mt-2 text-small text-error">{error}</p>
      ) : helperText ? (
        <p className="mt-2 text-small text-text-muted">{helperText}</p>
      ) : null}
    </div>
  );
}

export function Label({
  children,
  htmlFor,
  className,
}: {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-2 block text-small font-medium text-text", className)}>
      {children}
    </label>
  );
}
