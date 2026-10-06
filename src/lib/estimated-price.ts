import { formatBRLFromCents } from "@/lib/money-br";

/** F-019 — taxa fixa até existir cotação real. */
export const USD_TO_BRL = 5;

export const ESTIMATED_PRICE_HINT = "Valor estimado";

/** Total da linha em centavos: quantidade × preço de uma cópia convertido. */
export function estimatedLineCents(usd: number | null | undefined, quantity: number): number | null {
  if (usd == null || !Number.isFinite(usd)) return null;
  return Math.round(usd * USD_TO_BRL * 100) * quantity;
}

export function estimatedLineLabel(usd: number | null | undefined, quantity: number): string | null {
  const cents = estimatedLineCents(usd, quantity);
  return cents == null ? null : formatBRLFromCents(cents);
}
