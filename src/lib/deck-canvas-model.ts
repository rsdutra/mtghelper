/** Tipos e layout compartilhados pelos canvas de deck (F-008). */

export type CanvasCard = {
  id: string;
  quantity: number;
  included: boolean;
  section_ids: string[];
  name_en: string;
  name_pt: string | null;
  image_normal: string | null;
  image_small: string | null;
  price_cents?: number | null;
  note?: string | null;
};

export type CanvasSection = {
  id: string;
  name: string;
  kind?: "user" | "type" | string;
};

export type DeckCanvasHandle = {
  save: (options?: { keepalive?: boolean }) => Promise<boolean>;
  isDirty: () => boolean;
};

export type CanvasSaveState = "idle" | "saving" | "saved" | "error";

export type CardCopy = CanvasCard & { copy: number };

export const CARD_W = 146;
export const CARD_H = 204;
export const GAP = 12;
export const COLS = 8;
/** Cartas fora do deck: levemente atenuadas (ainda legíveis). */
export const OUT_OF_DECK_OPACITY = 0.84;
/** Delay antes do preview ampliado (F-008 / US-008-04). */
export const HOVER_PREVIEW_DELAY_MS = 1500;

export function expand(cards: CanvasCard[]) {
  const copies: CardCopy[] = [];
  for (const card of cards) {
    for (let i = 0; i < card.quantity; i += 1) {
      copies.push({ ...card, copy: i });
    }
  }
  return copies;
}

export function cardKey(card: CardCopy) {
  return `card:${card.id}:${card.copy}`;
}

export function imageSrc(card: CanvasCard) {
  return card.image_normal ?? card.image_small?.replace("/small/", "/normal/") ?? null;
}

/** Prefere seção automática por tipo/custo quando a carta tem essa tag (F-008 / US-008-03, US-008-07). */
export function primarySection(card: CanvasCard, sectionsById: Map<string, CanvasSection>) {
  const autoId = card.section_ids.find((id) => {
    const kind = sectionsById.get(id)?.kind;
    return kind === "type" || kind === "cost";
  });
  if (autoId) return autoId;
  return card.section_ids[0] ?? null;
}

export function cardOpacity(included: boolean) {
  return included ? 1 : OUT_OF_DECK_OPACITY;
}

export function defaultUntaggedPos(index: number) {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return { x: 48 + col * (CARD_W + GAP), y: 48 + row * (CARD_H + GAP) };
}

export function defaultSectionFrameSize(cardCount: number) {
  const cols = Math.max(2, Math.min(6, cardCount || 2));
  const rows = Math.max(1, Math.ceil((cardCount || 1) / cols));
  return {
    cols,
    w: cols * (CARD_W + GAP) + GAP * 2,
    h: rows * (CARD_H + GAP) + 48,
  };
}

export function defaultInSectionPos(index: number, cols: number) {
  const col = index % cols;
  const row = Math.floor(index / cols);
  return { x: GAP + col * (CARD_W + GAP), y: 32 + row * (CARD_H + GAP) };
}

/** Colunas para layout inicial de cartas novas num frame com a largura atual. */
export function sectionColsForWidth(frameW: number, fallbackCols: number) {
  return Math.max(2, Math.min(6, Math.floor((frameW - GAP * 2) / (CARD_W + GAP)) || fallbackCols));
}

/** Y onde começam os frames de seção, abaixo das cartas sem seção. */
export function sectionOriginY(untaggedCount: number) {
  const mainRows = Math.max(1, Math.ceil(untaggedCount / COLS));
  return 48 + mainRows * (CARD_H + GAP) + 64;
}

/** Agrupa cópias pela seção principal; cópias sem seção ficam em `untagged`. */
export function groupCopiesBySection(cards: CanvasCard[], sections: CanvasSection[]) {
  const sectionsById = new Map(sections.map((section) => [section.id, section]));
  const untagged: CardCopy[] = [];
  const bySection = new Map<string, CardCopy[]>();
  for (const card of expand(cards)) {
    const sectionId = primarySection(card, sectionsById);
    if (!sectionId || !sectionsById.has(sectionId)) {
      untagged.push(card);
      continue;
    }
    const list = bySection.get(sectionId) ?? [];
    list.push(card);
    bySection.set(sectionId, list);
  }
  return { untagged, bySection };
}
