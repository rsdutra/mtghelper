export type DeckExportScope = "all" | "included" | "working";

export type DeckExportCard = {
  quantity: number;
  included: boolean;
  name_en: string;
};

export const DECK_EXPORT_OPTIONS: ReadonlyArray<{ scope: DeckExportScope; label: string }> = [
  { scope: "all", label: "Exportar tudo" },
  { scope: "included", label: "Exportar somente no deck" },
  { scope: "working", label: "Exportar somente em trabalho" },
];

export function filterDeckExportCards<T extends DeckExportCard>(cards: readonly T[], scope: DeckExportScope): T[] {
  if (scope === "included") return cards.filter((card) => card.included);
  if (scope === "working") return cards.filter((card) => !card.included);
  return [...cards];
}

/** Lista `quantidade nome_en`, uma carta por linha, ordenada pelo nome em inglês. */
export function formatDeckExportList(cards: readonly DeckExportCard[], scope: DeckExportScope): string {
  return filterDeckExportCards(cards, scope)
    .slice()
    .sort((a, b) => a.name_en.localeCompare(b.name_en, "en"))
    .map((card) => `${card.quantity} ${card.name_en}`)
    .join("\n");
}
