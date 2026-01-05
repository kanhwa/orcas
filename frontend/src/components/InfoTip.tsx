import { useState, useRef, useEffect } from "react";

interface InfoTipProps {
  content: string;
}

export default function InfoTip({ content }: InfoTipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

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

  return (
    <span style={styles.container} ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={styles.iconButton}
        aria-label="Info"
      >
        ⓘ
      </button>
      {isOpen && (
        <div style={styles.popover}>
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
    color: "#007bff",
    padding: "0",
    lineHeight: "1",
    width: "18px",
    height: "18px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    transition: "background 0.2s",
  },
  popover: {
    position: "absolute",
    left: "0",
    top: "calc(100% + 0.35rem)",
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "6px",
    padding: "0.75rem 1rem",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    zIndex: 1000,
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
    color: "#666",
    cursor: "pointer",
    padding: "0",
    lineHeight: "1",
    width: "20px",
    height: "20px",
  },
  content: {
    margin: "0",
    fontSize: "0.85rem",
    color: "#333",
    lineHeight: "1.4",
  },
};
