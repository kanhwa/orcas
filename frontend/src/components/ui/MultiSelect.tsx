import { useEffect, useRef, useState } from "react";
import { cn } from "../../utils/cn";

export interface MultiSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  maxSelected?: number;
  disabled?: boolean;
  label?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  maxSelected,
  disabled,
  label,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const closeOnClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", closeOnClickOutside);
    }
    return () => document.removeEventListener("mousedown", closeOnClickOutside);
  }, [open]);

  const toggle = (opt: MultiSelectOption) => {
    const already = value.includes(opt.value);
    if (already) {
      onChange(value.filter((v) => v !== opt.value));
      return;
    }
    if (maxSelected && value.length >= maxSelected) return;
    onChange([...value, opt.value]);
  };

  const selectedLabels = options
    .filter((o) => value.includes(o.value))
    .map((o) => o.label);

  return (
    <div className="relative" ref={ref}>
      {label && (
        <div className="mb-1 text-xs font-semibold text-[rgb(var(--color-text-muted))]">
          {label}
        </div>
      )}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((s) => !s)}
        className={cn(
          "w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-sm text-left focus:border-[rgb(var(--color-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]/40",
          open && "ring-2 ring-[rgb(var(--color-primary))]/40",
          disabled && "opacity-60 cursor-not-allowed"
        )}
      >
        {selectedLabels.length > 0 ? (
          <span className="flex flex-wrap gap-2 text-[rgb(var(--color-text))]">
            {selectedLabels.map((lbl) => (
              <span
                key={lbl}
                className="badge bg-[rgb(var(--color-surface))] text-[rgb(var(--color-primary))]"
              >
                {lbl}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-[rgb(var(--color-text-subtle))]">
            {placeholder}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-[rgb(var(--color-border))] bg-white shadow-lg">
          <ul role="listbox" className="max-h-64 overflow-auto py-1">
            {options.map((opt) => {
              const selected = value.includes(opt.value);
              const disabledOption = maxSelected
                ? !selected && value.length >= maxSelected
                : false;
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={selected}
                  onClick={() => (disabledOption ? null : toggle(opt))}
                  className={cn(
                    "cursor-pointer px-3 py-2 text-sm hover:bg-[rgb(var(--color-surface))]",
                    selected && "bg-[rgb(var(--color-surface))]",
                    disabledOption && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex h-4 w-4 items-center justify-center rounded border border-[rgb(var(--color-border))]",
                        selected && "bg-[rgb(var(--color-primary))] text-white"
                      )}
                      aria-hidden
                    >
                      {selected ? "✓" : ""}
                    </span>
                    <div>
                      <div className="text-[rgb(var(--color-text))]">
                        {opt.label}
                      </div>
                      {opt.description && (
                        <div className="text-[rgb(var(--color-text-subtle))] text-xs">
                          {opt.description}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
