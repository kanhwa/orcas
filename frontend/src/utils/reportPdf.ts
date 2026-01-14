import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import notoUrl from "../assets/fonts/NotoSans-Regular.ttf?url";

export type ReportTypeId =
  | "analysis_screening"
  | "analysis_metric_ranking"
  | "scoring_scorecard"
  | "compare_stocks"
  | "compare_historical"
  | "simulation_scenario";

export interface MetadataLine {
  label: string;
  value: unknown;
}

export type ReportPdfInput = {
  name: string;
  type: ReportTypeId;
  created_at?: string | null;
  /** Optional override for header label (e.g., Scoring view variants). */
  typeLabelOverride?: string;
  metadata: Record<string, unknown> | MetadataLine[];
  legendItems?: Array<{ label: string; color: string }>;
  chartImage?: {
    dataUrl: string;
    width?: number;
    height?: number;
  };
  sections: Array<{
    title: string;
    columns: string[];
    rows: (string | number | null | undefined)[][];
    notes?: string[];
  }>;
};

const MARGINS = { top: 12, right: 12, bottom: 14, left: 12 };
const HEADER_HEIGHT = 18;

const TYPE_LABELS: Record<ReportTypeId, string> = {
  analysis_screening: "Analysis — Screening",
  analysis_metric_ranking: "Analysis — Metric Ranking",
  scoring_scorecard: "Scoring — Scorecard",
  compare_stocks: "Compare — Stocks",
  compare_historical: "Compare — Historical",
  simulation_scenario: "Simulation — Scenario",
};

let fontDataPromise: Promise<string> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function loadFontData(): Promise<string> {
  if (!fontDataPromise) {
    fontDataPromise = fetch(notoUrl)
      .then((res) => res.arrayBuffer())
      .then((buf) => arrayBufferToBase64(buf));
  }
  return fontDataPromise;
}

export async function ensurePdfFontReady(pdf: jsPDF): Promise<void> {
  const fontData = await loadFontData();
  pdf.addFileToVFS("NotoSans-Regular.ttf", fontData);
  pdf.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  pdf.setFont("NotoSans", "normal");
}

export function sanitizeText(value: string): string {
  if (!value) return "";
  // Remove control characters except tabs/newlines; keep em dash and arrows intact.
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .normalize();
}

export function toPrintableString(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "—";
    return `${value}`;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value))
    return value.map((v) => toPrintableString(v)).join(", ");
  if (typeof value === "object") {
    try {
      return sanitizeText(JSON.stringify(value));
    } catch (err) {
      void err;
      return "—";
    }
  }
  return sanitizeText(String(value));
}

function addHeader(pdf: jsPDF, input: ReportPdfInput): void {
  const pageWidth = pdf.internal.pageSize.getWidth();
  pdf.setFontSize(10);
  pdf.setFont("NotoSans", "normal");
  pdf.text("ORCAS", MARGINS.left, MARGINS.top);
  const label =
    input.typeLabelOverride || TYPE_LABELS[input.type] || input.type;
  pdf.text(label, pageWidth - MARGINS.right, MARGINS.top, {
    align: "right",
  });

  pdf.setFontSize(15);
  pdf.setFont("NotoSans", "bold");
  pdf.text(input.name, MARGINS.left, MARGINS.top + 7);

  pdf.setFontSize(9);
  pdf.setFont("NotoSans", "normal");
  const timestamp = input.created_at ? new Date(input.created_at) : new Date();
  pdf.text(
    `Generated ${timestamp.toLocaleString()}`,
    MARGINS.left,
    MARGINS.top + 14
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const num = parseInt(
    clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean,
    16
  );
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function addLegend(
  pdf: jsPDF,
  legendItems: NonNullable<ReportPdfInput["legendItems"]>,
  startY: number
): number {
  if (!legendItems.length) return startY;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const markerSize = 4;
  const gap = 6;
  const textGap = 3;
  let x = MARGINS.left;
  let y = startY;
  const lineHeight = 6;
  legendItems.forEach((item) => {
    const text = sanitizeText(item.label || "");
    const textWidth = pdf.getTextWidth(text);
    const blockWidth = markerSize + textGap + textWidth + gap;

    if (x + blockWidth > pageWidth - MARGINS.right) {
      x = MARGINS.left;
      y += lineHeight;
      if (y + lineHeight > pageHeight - MARGINS.bottom) {
        pdf.addPage();
        y = MARGINS.top + HEADER_HEIGHT;
      }
    }

    const { r, g, b } = hexToRgb(item.color || "#000000");
    pdf.setFillColor(r, g, b);
    pdf.rect(x, y - markerSize + 2, markerSize, markerSize, "F");
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(9);
    pdf.text(text, x + markerSize + textGap, y + 2);
    x += blockWidth;
  });
  return y + lineHeight;
}

function addFooter(pdf: jsPDF): void {
  const pageCount = pdf.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  pdf.setFont("NotoSans", "normal");
  pdf.setFontSize(9);
  for (let i = 1; i <= pageCount; i += 1) {
    pdf.setPage(i);
    pdf.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - MARGINS.bottom + 6,
      { align: "center" }
    );
  }
}

function addMetadataTable(
  pdf: jsPDF,
  rows: string[][],
  startY: number
): number {
  if (!rows.length) return startY;
  const head = [["Field", "Value"]];
  const opts = {
    head,
    body: rows,
    startY,
    styles: {
      font: "NotoSans",
      fontSize: 9,
      cellPadding: 2,
    },
    headStyles: {
      fontStyle: "bold",
    },
    theme: "grid",
    margin: {
      left: MARGINS.left,
      right: MARGINS.right,
      top: MARGINS.top + HEADER_HEIGHT,
      bottom: MARGINS.bottom,
    },
  } as const;
  (autoTable as unknown as (doc: jsPDF, options: unknown) => void)(pdf, opts);
  const finalY = (pdf as any).lastAutoTable?.finalY as number | undefined;
  return finalY ? finalY + 6 : startY + 6;
}

function addSection(
  pdf: jsPDF,
  section: ReportPdfInput["sections"][number],
  startY: number
): number {
  const pageHeight = pdf.internal.pageSize.getHeight();
  let cursorY = startY;
  const minSpace = 18;
  if (cursorY + minSpace > pageHeight - MARGINS.bottom) {
    pdf.addPage();
    cursorY = MARGINS.top + HEADER_HEIGHT;
  }

  pdf.setFont("NotoSans", "bold");
  pdf.setFontSize(12);
  pdf.text(section.title, MARGINS.left, cursorY);
  cursorY += 6;

  const body = section.rows.map((row) =>
    row.map((cell) => toPrintableString(cell))
  );

  const opts = {
    head: [section.columns.map((c) => sanitizeText(c))],
    body,
    startY: cursorY,
    styles: {
      font: "NotoSans",
      fontSize: 9,
      cellPadding: 2,
    },
    headStyles: {
      fontStyle: "bold",
    },
    theme: "grid",
    margin: {
      left: MARGINS.left,
      right: MARGINS.right,
      top: MARGINS.top + HEADER_HEIGHT,
      bottom: MARGINS.bottom,
    },
  } as const;
  (autoTable as unknown as (doc: jsPDF, options: unknown) => void)(pdf, opts);

  const finalY = (pdf as any).lastAutoTable?.finalY as number | undefined;
  cursorY = finalY ? finalY + 8 : cursorY + 12;

  if (section.notes && section.notes.length) {
    pdf.setFont("NotoSans", "normal");
    pdf.setFontSize(9);
    section.notes.forEach((note) => {
      if (cursorY + 6 > pageHeight - MARGINS.bottom) {
        pdf.addPage();
        cursorY = MARGINS.top + HEADER_HEIGHT;
      }
      pdf.text(`• ${sanitizeText(note)}`, MARGINS.left, cursorY);
      cursorY += 5;
    });
    cursorY += 3;
  }

  return cursorY;
}

function addChartImage(
  pdf: jsPDF,
  chartImage: NonNullable<ReportPdfInput["chartImage"]>,
  startY: number
): Promise<number> {
  return new Promise((resolve) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const maxWidth = pageWidth - MARGINS.left - MARGINS.right;

    const img = new Image();
    img.onload = () => {
      const intrinsicWidth = chartImage.width || img.width || maxWidth;
      const intrinsicHeight = chartImage.height || img.height || maxWidth * 0.5;
      const scale = maxWidth / intrinsicWidth;
      const renderWidth = maxWidth;
      const renderHeight = intrinsicHeight * scale;

      let cursorY = startY;
      const minSpace = renderHeight + 6;
      if (cursorY + minSpace > pageHeight - MARGINS.bottom) {
        pdf.addPage();
        cursorY = MARGINS.top + HEADER_HEIGHT;
      }

      pdf.addImage(
        img,
        "PNG",
        MARGINS.left,
        cursorY,
        renderWidth,
        renderHeight,
        undefined,
        "FAST"
      );

      resolve(cursorY + renderHeight + 6);
    };
    img.onerror = () => resolve(startY);
    img.src = chartImage.dataUrl;
  });
}

function metadataToRows(metadata: ReportPdfInput["metadata"]): string[][] {
  if (Array.isArray(metadata)) {
    return metadata.map((line) => [
      sanitizeText(line.label),
      toPrintableString(line.value),
    ]);
  }

  return Object.entries(metadata || {}).map(([k, v]) => [
    sanitizeText(k.replace(/_/g, " ").replace(/\b\w/g, (s) => s.toUpperCase())),
    toPrintableString(v),
  ]);
}

export async function buildReportPdfBase64Async(
  input: ReportPdfInput
): Promise<string> {
  const pdf = new jsPDF({ format: "a4", unit: "mm", compress: true });
  await ensurePdfFontReady(pdf);
  let cursorY = MARGINS.top + HEADER_HEIGHT;

  const metadataRows = metadataToRows(input.metadata || {});
  cursorY = addMetadataTable(pdf, metadataRows, cursorY + 2);

  if (input.legendItems && input.legendItems.length) {
    cursorY = addLegend(pdf, input.legendItems, cursorY + 2);
  }

  if (input.chartImage) {
    cursorY = await addChartImage(pdf, input.chartImage, cursorY + 2);
  }

  input.sections.forEach((section) => {
    cursorY = addSection(pdf, section, cursorY + 2);
  });

  // Draw headers/footers on every page after content to avoid overlaps.
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    pdf.setPage(i);
    addHeader(pdf, input);
  }
  addFooter(pdf);

  return pdf
    .output("datauristring")
    .replace(/^data:application\/pdf;filename=generated\.pdf;base64,/, "");
}

export async function buildReportPdfBase64(
  input: ReportPdfInput
): Promise<string> {
  return buildReportPdfBase64Async(input);
}

export async function buildReportPdfBlob(input: ReportPdfInput): Promise<Blob> {
  const base64 = await buildReportPdfBase64Async(input);
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length)
    .fill(0)
    .map((_, i) => byteCharacters.charCodeAt(i));
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: "application/pdf" });
}
