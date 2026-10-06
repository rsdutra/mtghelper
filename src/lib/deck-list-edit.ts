/** F-018 — editar o deck por lista: casa nomes com as cartas do deck e soma as quantidades por lugar. */
export type DeckListPlace = "main" | "side" | "out";

export const DECK_LIST_PLACES: ReadonlyArray<{ place: DeckListPlace; label: string }> = [
  { place: "main", label: "Deck" },
  { place: "side", label: "Sideboard" },
  { place: "out", label: "Maybeboard" },
];

export function deckListPlaceLabel(place: DeckListPlace) {
  return DECK_LIST_PLACES.find((item) => item.place === place)?.label ?? place;
}

export type DeckListExistingCard = {
  catalogCardId: string;
  name_en: string;
  name_pt: string | null;
  quantities: Record<DeckListPlace, number>;
};

export type DeckListQuantities = Map<string, Record<DeckListPlace, number>>;

export function foldCardName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Nome completo e, em cartas de duas faces, cada face (`Delver of Secrets // Insectile Aberration`). */
function nameKeys(card: DeckListExistingCard) {
  const keys = new Set<string>();
  for (const name of [card.name_en, card.name_pt]) {
    if (!name) continue;
    keys.add(foldCardName(name));
    for (const face of name.split("//")) keys.add(foldCardName(face));
  }
  keys.delete("");
  return keys;
}

/**
 * Carta do deck com esse nome (inglês ou português). Com mais de uma impressão do mesmo nome,
 * prefere a que já está no lugar, para não trocar a impressão.
 */
export function matchDeckCard(
  existing: readonly DeckListExistingCard[],
  name: string,
  place: DeckListPlace,
): DeckListExistingCard | null {
  const wanted = foldCardName(name);
  if (!wanted) return null;
  const matches = existing.filter((card) => nameKeys(card).has(wanted));
  return matches.find((card) => card.quantities[place] > 0) ?? matches[0] ?? null;
}

export function addListQuantity(
  totals: DeckListQuantities,
  catalogCardId: string,
  place: DeckListPlace,
  quantity: number,
) {
  const current = totals.get(catalogCardId) ?? { main: 0, side: 0, out: 0 };
  current[place] += quantity;
  totals.set(catalogCardId, current);
}
