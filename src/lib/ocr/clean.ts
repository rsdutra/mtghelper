/** F-007 — limpeza do texto OCR do título da carta. */

export function cleanOcrText(raw: string): string {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const line = lines[0] ?? "";
  return line
    .replace(/[^\p{L}\p{N}\s'’.,/\-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
