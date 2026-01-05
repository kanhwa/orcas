import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode;
  footer?: ReactNode;
}

export function Card({
  header,
  footer,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div className={cn("card", className)} {...props}>
      {header && (
        <div className="px-6 pt-6 pb-4 border-b border-[rgb(var(--color-border))]">
          {header}
        </div>
      )}
      <div className="card-body">{children}</div>
      {footer && (
        <div className="px-6 pb-6 pt-4 border-t border-[rgb(var(--color-border))]">
          {footer}
        </div>
      )}
    </div>
  );
}
