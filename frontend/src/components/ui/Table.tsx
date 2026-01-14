import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  children: ReactNode;
}

export function Table({ className, children, ...props }: TableProps) {
  return (
    <table
      className={cn("table-shell w-full border-collapse", className)}
      {...props}
    >
      {children}
    </table>
  );
}
