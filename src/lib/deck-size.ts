import { mainDeckLimit, sideboardLimit } from "@/lib/formats";

export type DeckSizeStatus = {
  mainCount: number;
  sideboardCount: number;
  mainLimit: number;
  sideboardLimit: number | null;
  overMain: boolean;
  overSideboard: boolean;
  invalid: boolean;
  messages: string[];
};

/**
 * O deck e o sideboard têm tetos separados: 60 + 15 nos formatos com side,
 * 100 e sem side em Commander, Brawl e Pauper Commander.
 */
export function evaluateDeckSize(format: string, mainCount: number, sideboardCount: number): DeckSizeStatus {
  const mainLimit = mainDeckLimit(format);
  const sideLimit = sideboardLimit(format);
  const overMain = mainCount > mainLimit;
  const overSideboard = sideLimit != null && sideboardCount > sideLimit;
  const messages: string[] = [];
  if (overMain) {
    messages.push(`Deck inválido: ${mainCount} cartas no deck (máximo ${mainLimit}).`);
  }
  if (overSideboard) {
    messages.push(`Deck inválido: ${sideboardCount} cartas no sideboard (máximo ${sideLimit}).`);
  }
  return {
    mainCount,
    sideboardCount,
    mainLimit,
    sideboardLimit: sideLimit,
    overMain,
    overSideboard,
    invalid: messages.length > 0,
    messages,
  };
}
