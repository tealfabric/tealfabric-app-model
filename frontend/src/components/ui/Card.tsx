import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/ui/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Optional title shown in a header strip (tenant-app convenience API). */
  title?: string;
  header?: ReactNode;
}

export function Card({ className, children, title, header, ...props }: CardProps) {
  const headerNode = header ?? (title ? <h2 className="text-h3 text-text">{title}</h2> : null);

  return (
    <div className={cn("rounded-md border border-border bg-bg text-text", className)} {...props}>
      {headerNode ? (
        <div className="border-b border-border-subtle px-4 py-3 md:px-6">{headerNode}</div>
      ) : null}
      <div className="p-4 md:p-6">{children}</div>
    </div>
  );
}
