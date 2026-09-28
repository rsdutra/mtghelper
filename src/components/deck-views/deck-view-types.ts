import type { ReactNode } from "react";

/** F-010 — visualizações do modo Lista de `/decks/[id]`. */
export type DeckListView = "texto" | "grid" | "pilhas";

export const DECK_LIST_VIEWS: Array<{ id: DeckListView; label: string }> = [
  { id: "texto", label: "Texto" },
  { id: "grid", label: "Grid visual" },
  { id: "pilhas", label: "Grid visual agrupada" },
];

export const DECK_LIST_VIEW_STORAGE_KEY = "mtghelper.deck.listView";

/** Delay do preview ao pairar, igual nas três views (US-010-05). */
export const LIST_PREVIEW_DELAY_MS = 300;

export function parseDeckListView(value: string | null): DeckListView {
  return DECK_LIST_VIEWS.some((option) => option.id === value) ? (value as DeckListView) : "texto";
}

export type ActionsLayout = "row" | "column";

export type DeckViewItem = {
  id: string;
  quantity: number;
  label: string;
  secondary: string | null;
  meta: string | null;
  imageSrc: string | null;
  renderActions: (layout: ActionsLayout) => ReactNode;
};

/** `label: null` = lista sem agrupamento. */
export type DeckViewGroup = { key: string; label: string | null; items: DeckViewItem[] };
