/** F-016 — conjuntos exportáveis do deck. */
export type DeckExportScope = "main" | "side" | "out" | "all";

export type DeckExportCard = {
  quantity: number;
  place: "out" | "main" | "side";
  name_en: string;
};

const DECK_EXPORT_OPTIONS: ReadonlyArray<{ scope: DeckExportScope; label: string; title: string }> = [
  { scope: "main", label: "Deck", title: "Exportar deck" },
  { scope: "side", label: "Sideboard", title: "Exportar sideboard" },
  { scope: "out", label: "Fora do deck", title: "Exportar fora do deck" },
  { scope: "all", label: "Tudo", title: "Exportar tudo" },
];

/** Sem sideboard no formato, a opção some e as cartas de sideboard contam como Deck. */
export function deckExportOptions(allowsSideboard: boolean) {
  return DECK_EXPORT_OPTIONS.filter((option) => allowsSideboard || option.scope !== "side");
}

export function deckExportTitle(scope: DeckExportScope): string {
  return DECK_EXPORT_OPTIONS.find((option) => option.scope === scope)?.title ?? "Exportar";
}

export function filterDeckExportCards<T extends DeckExportCard>(
  cards: readonly T[],
  scope: DeckExportScope,
  allowsSideboard = true,
): T[] {
  if (scope === "all") return [...cards];
  if (scope === "out") return cards.filter((card) => card.place === "out");
  if (scope === "side") return allowsSideboard ? cards.filter((card) => card.place === "side") : [];
  return cards.filter((card) => card.place === "main" || (!allowsSideboard && card.place === "side"));
}

/** Lista `quantidade nome_en`, uma carta por linha, ordenada pelo nome em inglês. */
export function formatDeckExportList(
  cards: readonly DeckExportCard[],
  scope: DeckExportScope,
  allowsSideboard = true,
): string {
  return filterDeckExportCards(cards, scope, allowsSideboard)
    .slice()
    .sort((a, b) => a.name_en.localeCompare(b.name_en, "en"))
    .map((card) => `${card.quantity} ${card.name_en}`)
    .join("\n");
}
