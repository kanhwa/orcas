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
        "inline-flex items-center gap-2 rounded-full border border-[rgb(var(--color-primary))]/50 px-3 py-1 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--color-primary))]",
        pressed
          ? "bg-[rgb(var(--color-primary))]/15 text-[rgb(var(--color-primary))]"
          : "bg-white text-[rgb(var(--color-text))]",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
          pressed
            ? "bg-[rgb(var(--color-primary))] border-[rgb(var(--color-primary))]"
            : "bg-[rgb(var(--color-surface))] border-[rgb(var(--color-primary))]/50"
        )}
        aria-hidden
      >
        <span
          className={cn(
            "absolute top-[1px] left-[1px] h-4 w-4 rounded-full bg-orange-500 shadow-sm transition-transform",
            pressed ? "translate-x-[16px]" : "translate-x-0"
          )}
        />
      </span>
      {label && <span className="text-xs font-medium">{label}</span>}
    </button>
  );
}
