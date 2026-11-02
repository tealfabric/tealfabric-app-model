import { cn } from "../../lib/ui/cn";

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn("spinner h-8 w-8", className)}
      role="status"
      aria-label="Loading"
    />
  );
}
