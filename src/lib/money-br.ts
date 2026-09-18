/** Formatação e parse de valores em R$ (pt-BR). Armazena em centavos. */

const formatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRLFromCents(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents)) return "";
  return formatter.format(cents / 100);
}

/** Aceita "12,50", "R$ 1.234,56", "12.50" → centavos; vazio → null. */
export function parseBRLToCents(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;
  const cleaned = raw
    .replace(/R\$\s?/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Digitação amigável: mantém só dígitos e formata como moeda ao blur. */
export function maskBRLTyping(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  const cents = Number(digits);
  return formatter.format(cents / 100);
}
