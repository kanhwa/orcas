import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface InfoTipProps {
  content: string | ReactNode;
  ariaLabel?: string;
}

/**
 * InfoTip: Accessible tooltip component that displays on hover and keyboard focus.
 * - Opens on pointer hover and keyboard focus
 * - Closes on pointer leave, blur, and Escape key
 * - Trigger is only the ⓘ icon button (not the whole container)
 */
export default function InfoTip({ content, ariaLabel = "Info" }: InfoTipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const gap = 10;
    const estimatedWidth = 260;
    let left = rect.right + gap;
    const viewportWidth = window.innerWidth;

    if (left + estimatedWidth > viewportWidth - 12) {
      left = Math.max(12, rect.left - gap - estimatedWidth);
    }

    const centerY = rect.top + rect.height / 2;
    setPosition({ top: centerY, left });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleWindowChange = () => updatePosition();
    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [isOpen]);

  // Handle escape key to close tooltip
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Handle click outside to close tooltip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
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
    <span style={styles.container} ref={containerRef}>
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
        style={styles.iconButton}
        aria-label={ariaLabel}
      >
        ⓘ
      </span>
      {isOpen &&
        createPortal(
          <div
            style={{
              ...styles.popover,
              top: position.top,
              left: position.left,
            }}
            role="tooltip"
          >
            <p style={styles.content}>{content}</p>
          </div>,
          document.body
        )}
    </span>
  );
}

const styles: Record<string, CSSProperties> = {
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
    position: "fixed",
    background: "#fff",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    padding: "0.75rem 1rem",
    boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
    zIndex: 9999,
    minWidth: "220px",
    maxWidth: "320px",
    pointerEvents: "none",
    transform: "translateY(-50%)",
  },
  content: {
    margin: "0",
    fontSize: "0.85rem",
    color: "var(--text-main)",
    lineHeight: "1.4",
  },
};
