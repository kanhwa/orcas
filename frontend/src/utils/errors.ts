export function toErrorMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error && err.message) return err.message;
  const detail =
    (err as { detail?: unknown; message?: unknown }).detail ??
    (err as { message?: unknown }).message;

  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => {
        if (typeof d === "string") return d;
        if (d && typeof d === "object") {
          const maybeMsg = (d as { msg?: unknown }).msg;
          if (typeof maybeMsg === "string") return maybeMsg;
        }
        try {
          return JSON.stringify(d);
        } catch {
          return String(d);
        }
      })
      .filter(Boolean)
      .join("; ");
    if (msgs) return msgs;
  }

  if (typeof detail === "string") return detail;
  if (detail) {
    try {
      return JSON.stringify(detail);
    } catch {
      /* ignore */
    }
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
