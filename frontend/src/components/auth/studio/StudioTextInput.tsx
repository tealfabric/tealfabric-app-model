import { forwardRef, useId } from "react";
import { cn } from "../../../lib/ui/cn";

type StudioTextInputProps = React.ComponentPropsWithoutRef<"input"> & {
  label: string;
  standalone?: boolean;
};

/** Floating-label text input matching TealFabric Studio auth styling. */
export const StudioTextInput = forwardRef<HTMLInputElement, StudioTextInputProps>(
  function StudioTextInput({ label, standalone = false, className, id: idProp, ...props }, ref) {
    const generatedId = useId();
    const id = idProp ?? generatedId;

    return (
      <div className="group relative z-0 transition-all focus-within:z-10">
        <input
          ref={ref}
          id={id}
          placeholder=" "
          className={cn(
            "peer block w-full border border-border bg-transparent px-6 pt-12 pb-4 text-base/6 text-text",
            "ring-4 ring-transparent transition",
            standalone
              ? "rounded-2xl bg-white/50"
              : "group-first:rounded-t-2xl group-last:rounded-b-2xl",
            "focus:border-brand focus:ring-brand/10 focus:outline-hidden",
            className
          )}
          {...props}
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute top-1/2 left-6 -mt-3 origin-left text-base/6 text-text-muted transition-all duration-200 peer-not-placeholder-shown:-translate-y-4 peer-not-placeholder-shown:scale-75 peer-not-placeholder-shown:font-semibold peer-not-placeholder-shown:text-text peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:font-semibold peer-focus:text-text"
        >
          {label}
        </label>
      </div>
    );
  }
);
