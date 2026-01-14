const encoder = new TextEncoder();

function escapePdfText(line: string): string {
  return line
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Build a minimal text-based PDF and return base64-encoded content.
 * Keeps dependencies light; suitable for simple report snapshots.
 */
export function buildSimplePdfBase64(title: string, lines: string[]): string {
  const now = new Date().toISOString();
  const contentLines = [
    title,
    `Generated: ${now}`,
    "----------------------------------------",
    ...lines,
  ];

  const streamLines = ["BT", "/F1 10 Tf", "50 742 Td", "12 TL"];
  for (const line of contentLines) {
    const escaped = escapePdfText(line);
    streamLines.push(`(${escaped}) Tj T*`);
  }
  streamLines.push("ET");

  const streamContent = streamLines.join("\n") + "\n";
  const streamBytes = encoder.encode(streamContent);

  const header =
    "%PDF-1.4\n" +
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n" +
    `4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`;

  const footer =
    "endstream\nendobj\n" +
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n" +
    "xref\n0 6\n" +
    "0000000000 65535 f \n" +
    "0000000009 00000 n \n" +
    "0000000058 00000 n \n" +
    "0000000115 00000 n \n" +
    "0000000266 00000 n \n" +
    "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n";

  const prelim = header + streamContent + footer;
  const startxref = encoder.encode(prelim).length + 20;
  const full = `${prelim}${startxref}\n%%EOF`;
  return toBase64(encoder.encode(full));
}
