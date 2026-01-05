import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

const variantClasses: Record<Variant, string> = {
  primary: "btn btn-primary",
  secondary: "btn btn-secondary",
  ghost: "btn btn-ghost",
  danger: "btn bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {iconLeft && <span className="inline-flex items-center">{iconLeft}</span>}
      <span className="leading-none">{children}</span>
      {iconRight && (
        <span className="inline-flex items-center">{iconRight}</span>
      )}
    </button>
  );
}
