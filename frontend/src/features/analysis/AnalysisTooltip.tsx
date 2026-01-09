import { useState, useRef, useEffect } from "react";

interface AnalysisTooltipProps {
  content: string;
  children: React.ReactNode;
}

/**
 * Tooltip for Analysis pages (Screening, Metric Ranking).
 * Features:
 * - No close button
 * - Auto-dismiss on blur/hover-out
 * - Clean positioning below the trigger
 * - Accessible with ARIA
 */
export function AnalysisTooltip({ content, children }: AnalysisTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss on blur/click-outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        !triggerRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <span style={styles.container} ref={triggerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={styles.trigger}
        aria-label="Show information"
        title="Click for more information"
      >
        ⓘ
      </button>
      {isOpen && (
        <div style={styles.tooltip} ref={tooltipRef} role="tooltip">
          <p style={styles.content}>{content}</p>
        </div>
      )}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    display: "inline-block",
    marginLeft: "0.25rem",
    verticalAlign: "middle",
  },
  trigger: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "0.9rem",
    color: "var(--accent-2, #0066cc)",
    padding: "0",
    lineHeight: "1",
    width: "16px",
    height: "16px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
  },
  tooltip: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: "0",
    background: "rgb(var(--color-surface, 255, 255, 255))",
    border: "1px solid var(--border, #e0e0e0)",
    borderRadius: "4px",
    padding: "0.5rem 0.75rem",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
    zIndex: 100,
    minWidth: "200px",
    maxWidth: "280px",
  },
  content: {
    margin: "0",
    fontSize: "0.8rem",
    color: "rgb(var(--color-text, 0, 0, 0))",
    lineHeight: "1.3",
  },
};
