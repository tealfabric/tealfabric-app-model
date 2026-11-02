import type { ReactNode } from "react";
import { cn } from "../../lib/ui/cn";

export type PageHeaderMode = "mercury" | "attio";

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  mode?: PageHeaderMode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  mode = "attio",
  className,
}: PageHeaderProps) {
  const isMercury = mode === "mercury";

  return (
    <header
      className={cn(
        "pb-4",
        !isMercury && "border-b border-border-subtle",
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={cn("font-semibold text-text", isMercury ? "text-display" : "text-h1")}>
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-body text-text-secondary">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
