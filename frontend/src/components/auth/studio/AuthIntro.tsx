import { cn } from "../../../lib/ui/cn";

type AuthIntroProps = {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  centered?: boolean;
};

/** Page intro block (eyebrow + display title). */
export function AuthIntro({ eyebrow, title, children, centered = false }: AuthIntroProps) {
  return (
    <div className={centered ? "text-center" : undefined}>
      <h1>
        <span className="block font-display text-base font-semibold text-text">{eyebrow}</span>
        <span className="sr-only"> - </span>
        <span
          className={cn(
            "mt-4 block max-w-5xl font-display text-3xl font-medium tracking-tight text-balance text-text sm:text-4xl",
            centered && "mx-auto"
          )}
        >
          {title}
        </span>
      </h1>
      {children ? (
        <div
          className={cn(
            "mt-4 max-w-3xl text-base text-text-secondary sm:text-lg",
            centered && "mx-auto"
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
