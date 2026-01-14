export type DraftReport = {
  type: string;
  nameSuggestion?: string;
  pdfBase64: string;
  metadata?: Record<string, unknown> | null;
};

const STORAGE_KEY = "orcas_draft_report";

export function setDraftReport(draft: DraftReport): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch (err) {
    console.error("Failed to set draft report", err);
  }
}

export function consumeDraftReport(): DraftReport | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    return JSON.parse(raw) as DraftReport;
  } catch (err) {
    console.error("Failed to read draft report", err);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (cleanupErr) {
      console.error("Failed to clear draft report", cleanupErr);
    }
    return null;
  }
}
