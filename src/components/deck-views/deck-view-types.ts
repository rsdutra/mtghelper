import type { ReactNode } from "react";
import type { CardTag } from "@/lib/tags";

/** F-010 — visualizações do modo Lista de `/decks/[id]`. */
export type DeckListView = "texto" | "grid" | "pilhas";

export const DECK_LIST_VIEWS: Array<{ id: DeckListView; label: string }> = [
  { id: "texto", label: "Texto" },
  { id: "grid", label: "Grid visual" },
  { id: "pilhas", label: "Grid visual agrupada" },
];

export const DECK_LIST_VIEW_STORAGE_KEY = "mtghelper.deck.listView";

/** F-017 — itens opcionais da view Texto na edição. */
export const TEXT_LIST_OPTIONS = [{ id: "mana", label: "Custo de mana" }] as const;

export type TextListOption = (typeof TEXT_LIST_OPTIONS)[number]["id"];

export const TEXT_LIST_OPTIONS_STORAGE_KEY = "mtghelper.deck.textOptions";

export function parseTextListOptions(value: string | null): TextListOption[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is TextListOption => TEXT_LIST_OPTIONS.some((option) => option.id === id));
  } catch {
    return [];
  }
}

/** Delay do preview ao pairar, igual nas três views (US-010-05). */
export const LIST_PREVIEW_DELAY_MS = 300;

export function parseDeckListView(value: string | null): DeckListView {
  return DECK_LIST_VIEWS.some((option) => option.id === value) ? (value as DeckListView) : "texto";
}

export type ActionsLayout = "row" | "menu";

export type DeckViewItem = {
  id: string;
  quantity: number;
  label: string;
  secondary: string | null;
  setCode: string | null;
  tags: CardTag[];
  priceLabel: string | null;
  /** Custo Scryfall (`{2}{R}`). A view Texto da edição só desenha se “Custo de mana” estiver ligado (F-017). */
  manaCost: string | null;
  imageSrc: string | null;
  thumbSrc: string | null;
  renderActions: (layout: ActionsLayout) => ReactNode;
};

/** `label: null` = lista sem agrupamento. `color`: bolinha no cabeçalho (agrupar por tag, US-013-05). */
export type DeckViewGroup = { key: string; label: string | null; color?: string | null; items: DeckViewItem[] };
