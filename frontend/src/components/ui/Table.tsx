import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

interface TableProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Table({ className, children, ...props }: TableProps) {
  return (
    <div className={cn("table-shell", className)} {...props}>
      {children}
    </div>
  );
}
