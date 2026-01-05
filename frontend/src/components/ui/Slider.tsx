import type { InputHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

interface SliderProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
}

export function Slider({
  label,
  className,
  value,
  min,
  max,
  step = 1,
  ...props
}: SliderProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-xs font-semibold text-[rgb(var(--color-text-muted))]">
          {label}
        </span>
      )}
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        className={cn("w-full accent-[rgb(var(--color-primary))]", className)}
        {...props}
      />
      <div className="text-xs text-[rgb(var(--color-text-subtle))]">
        {value}
      </div>
    </div>
  );
}
