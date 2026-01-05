import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { Button } from "./Button";

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ title, open, onClose, children, footer }: ModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4"
    >
      <div
        className="card max-w-xl w-full shadow-xl bg-white"
        aria-live="polite"
      >
        <div className="flex items-start justify-between border-b border-[rgb(var(--color-border))] px-6 py-4">
          <h3 className="text-base font-semibold text-[rgb(var(--color-text))]">
            {title}
          </h3>
          <Button
            aria-label="Close"
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            ×
          </Button>
        </div>
        <div className="card-body text-sm text-[rgb(var(--color-text))]">
          {children}
        </div>
        {footer && (
          <div
            className={cn(
              "px-6 py-4 border-t border-[rgb(var(--color-border))]"
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
