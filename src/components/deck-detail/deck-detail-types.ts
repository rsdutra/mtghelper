/** F-011 — tipos da tela de deck compartilhados entre visualização e edição. */
export type DeckMode = "view" | "edit";

export type DeckView = "lista" | "canvas";

export const DECK_VIEW_OPTIONS: Array<{ id: DeckView; label: string }> = [
  { id: "lista", label: "Lista" },
  { id: "canvas", label: "Canvas" },
];

export type CardRow = {
  id: string;
  deck_card_id?: string;
  quantity: number;
  included: boolean;
  section_ids: string[];
  name_en: string;
  name_pt: string | null;
  set_code: string;
  type_line?: string | null;
  mana_cost?: string | null;
  price_cents?: number | null;
  note?: string | null;
  image_normal: string | null;
  image_small: string | null;
  oracle_id?: string | null;
  owned?: number;
  needed?: number;
  missing?: number;
};

export type Section = { id: string; name: string; kind?: "user" | "type" | string; type_key?: string | null };

export function normalizeSectionIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return value ? [value] : [];
    }
  }
  return [];
}

export function deckHref(deckId: string, mode: DeckMode, view: DeckView) {
  const path = mode === "edit" ? `/decks/${deckId}/edit` : `/decks/${deckId}`;
  return view === "canvas" ? `${path}?view=canvas` : path;
}
