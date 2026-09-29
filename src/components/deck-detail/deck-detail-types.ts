import type { CardTag } from "@/lib/tags";

/** F-011 — tipos da tela de deck compartilhados entre visualização e edição. */
export type DeckMode = "view" | "edit";

export type DeckView = "lista" | "canvas";

export const DECK_VIEW_OPTIONS: Array<{ id: DeckView; label: string }> = [
  { id: "lista", label: "Lista" },
  { id: "canvas", label: "Canvas" },
];

export type DeckPlace = "out" | "main" | "side";

export type CardRow = {
  id: string;
  deck_card_id?: string;
  quantity: number;
  place: DeckPlace;
  name_en: string;
  name_pt: string | null;
  set_code: string;
  type_line?: string | null;
  mana_cost?: string | null;
  price_cents?: number | null;
  note?: string | null;
  tags?: CardTag[];
  image_normal: string | null;
  image_small: string | null;
  oracle_id?: string | null;
  owned?: number;
  needed?: number;
  missing?: number;
};

export function deckHref(deckId: string, mode: DeckMode, view: DeckView) {
  const path = mode === "edit" ? `/decks/${deckId}/edit` : `/decks/${deckId}`;
  return view === "canvas" ? `${path}?view=canvas` : path;
}
