import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

interface ToggleProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  pressed: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}

export function Toggle({
  pressed,
  onChange,
  label,
  className,
  ...props
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      onClick={() => onChange(!pressed)}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-[rgb(var(--color-border))] px-3 py-1 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--color-primary))]",
        pressed
          ? "bg-[rgb(var(--color-primary))]/15 text-[rgb(var(--color-primary))]"
          : "bg-white text-[rgb(var(--color-text))]",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "relative h-4 w-9 rounded-full border transition-colors",
          pressed
            ? "bg-[rgb(var(--color-primary))] border-[rgb(var(--color-primary))]"
            : "bg-white border-[rgb(var(--color-border))]"
        )}
        aria-hidden
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform",
            pressed ? "translate-x-4" : "translate-x-1"
          )}
        />
      </span>
      {label && <span className="text-xs font-medium">{label}</span>}
    </button>
  );
}
