import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../../lib/ui/cn";

type StudioButtonProps = {
  invert?: boolean;
  className?: string;
  children: ReactNode;
  to?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

/** Rounded-full button from TealFabric Studio auth. */
export function StudioButton({
  invert = false,
  className,
  children,
  to,
  type = "button",
  ...props
}: StudioButtonProps) {
  const baseClass = cn(
    "inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition",
    invert
      ? "bg-text-inverse text-brand hover:bg-brand-subtle"
      : "bg-brand text-text-inverse hover:bg-brand-hover",
    "disabled:pointer-events-none disabled:opacity-50",
    className
  );

  const inner = <span className="relative top-px">{children}</span>;

  if (to) {
    return (
      <Link to={to} className={baseClass}>
        {inner}
      </Link>
    );
  }

  return (
    <button type={type} className={baseClass} {...props}>
      {inner}
    </button>
  );
}
