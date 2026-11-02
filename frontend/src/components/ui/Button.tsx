import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/ui/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "default" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  destructive?: boolean;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-text-inverse hover:bg-brand-hover border border-transparent font-medium",
  secondary:
    "bg-bg text-text border border-border hover:bg-bg-subtle hover:border-border-strong font-medium",
  ghost:
    "bg-transparent text-text-secondary border border-transparent hover:bg-bg-subtle hover:text-text font-medium",
};

export function Button({
  variant = "primary",
  size = "default",
  destructive = false,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-sm text-body transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "icon" ? "h-8 w-8 p-0" : "h-9 px-4 py-2",
        variantClasses[variant],
        destructive && variant !== "primary" && "text-error hover:text-error",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
