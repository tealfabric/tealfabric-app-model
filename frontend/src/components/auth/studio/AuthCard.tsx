import { cn } from "../../../lib/ui/cn";

type AuthCardProps = {
  children: React.ReactNode;
  className?: string;
};

/** Rounded card surface for auth forms (Studio rounded-2xl grouping). */
export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-bg/80 shadow-modal backdrop-blur-sm",
        className
      )}
    >
      {children}
    </div>
  );
}
