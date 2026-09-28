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
 * O sideboard entra na conta de cartas do formato e na coleção.
 * Ele também tem teto próprio de 15. Passar de qualquer teto invalida o deck.
 */
export function evaluateDeckSize(format: string, mainCount: number, sideboardCount: number): DeckSizeStatus {
  const mainLimit = mainDeckLimit(format);
  const sideLimit = sideboardLimit(format);
  const deckCount = mainCount + (sideLimit == null ? 0 : sideboardCount);
  const overMain = deckCount > mainLimit;
  const overSideboard = sideLimit != null && sideboardCount > sideLimit;
  const messages: string[] = [];
  if (overMain) {
    const including = sideLimit != null ? ", incluindo o sideboard" : "";
    messages.push(`Deck inválido: ${deckCount} cartas no deck${including} (máximo ${mainLimit}).`);
  }
  if (overSideboard) {
    messages.push(`Deck inválido: ${sideboardCount} cartas no sideboard (máximo ${sideLimit}).`);
  }
  return {
    mainCount: deckCount,
    sideboardCount,
    mainLimit,
    sideboardLimit: sideLimit,
    overMain,
    overSideboard,
    invalid: messages.length > 0,
    messages,
  };
}
