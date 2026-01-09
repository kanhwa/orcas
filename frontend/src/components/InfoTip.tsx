import { useState, useRef, useEffect } from "react";

interface InfoTipProps {
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
}

export default function InfoTip({ content, placement = "bottom" }: InfoTipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !popoverRef.current) return;

    const iconBtn = popoverRef.current.querySelector("button");
    if (!iconBtn) return;

    const rect = iconBtn.getBoundingClientRect();
    const popover = popoverRef.current.querySelector("[data-popover]") as HTMLElement;
    if (!popover) return;

    let top = 0;
    let left = 0;

    const gap = 8;
    const popoverWidth = popover.offsetWidth;
    const popoverHeight = popover.offsetHeight;

    switch (placement) {
      case "top":
        top = rect.top - popoverHeight - gap;
        left = rect.left - popoverWidth / 2 + rect.width / 2;
        break;
      case "left":
        top = rect.top - popoverHeight / 2 + rect.height / 2;
        left = rect.left - popoverWidth - gap;
        break;
      case "right":
        top = rect.top - popoverHeight / 2 + rect.height / 2;
        left = rect.right + gap;
        break;
      case "bottom":
      default:
        top = rect.bottom + gap;
        left = rect.left - popoverWidth / 2 + rect.width / 2;
        break;
    }

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - popoverWidth - 8));
    top = Math.max(8, top);

    setPopoverPos({ top, left });
  }, [isOpen, placement]);

  return (
    <span style={styles.container} ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={styles.iconButton}
        aria-label="Info"
        title="More information"
      >
        ⓘ
      </button>
      {isOpen && (
        <div
          data-popover
          style={{
            ...styles.popover,
            position: "fixed",
            top: `${popoverPos.top}px`,
            left: `${popoverPos.left}px`,
          }}
        >
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={styles.closeBtn}
            aria-label="Close"
          >
            ×
          </button>
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
    marginLeft: "0.35rem",
    verticalAlign: "middle",
  },
  iconButton: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "0.95rem",
    color: "var(--accent-2)",
    padding: "0",
    lineHeight: "1",
    width: "18px",
    height: "18px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    transition: "background 0.2s, color 0.2s",
  },
  popover: {
    background: "rgb(var(--color-surface))",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    padding: "0.75rem 1rem",
    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
    zIndex: 10000,
    minWidth: "220px",
    maxWidth: "320px",
  },
  closeBtn: {
    position: "absolute",
    top: "0.25rem",
    right: "0.25rem",
    background: "transparent",
    border: "none",
    fontSize: "1.25rem",
    color: "var(--text-subtle)",
    cursor: "pointer",
    padding: "0",
    lineHeight: "1",
    width: "20px",
    height: "20px",
  },
  content: {
    margin: "0",
    fontSize: "0.85rem",
    color: "rgb(var(--color-text))",
    lineHeight: "1.4",
  },
};
