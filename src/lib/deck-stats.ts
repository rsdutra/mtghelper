import { cardTypeGroup, cardTypeLabel, cardTypeOrder, type CardTypeGroup } from "@/lib/card-types";
import { manaValueFromCost } from "@/lib/mana";

export type DeckStatCard = {
  quantity: number;
  type_line?: string | null;
  mana_cost?: string | null;
};

export type TypeSlice = {
  group: CardTypeGroup;
  label: string;
  count: number;
  color: string;
};

export type ManaBucket = {
  label: string;
  cmc: number;
  count: number;
};

const TYPE_COLORS: Record<CardTypeGroup, string> = {
  Creatures: "#3d9b4a",
  Planeswalkers: "#8b5cf6",
  Battles: "#14b8a6",
  Instants: "#3b82f6",
  Sorceries: "#b45309",
  Artifacts: "#78716c",
  Enchantments: "#eab308",
  Lands: "#f97316",
  Other: "#9ca3af",
};

/** Distribuição por tipo (soma de quantidades). */
export function typeDistribution(cards: DeckStatCard[]): TypeSlice[] {
  const counts = new Map<CardTypeGroup, number>();
  for (const card of cards) {
    const group = cardTypeGroup(card.type_line);
    counts.set(group, (counts.get(group) ?? 0) + card.quantity);
  }
  return cardTypeOrder()
    .filter((group) => (counts.get(group) ?? 0) > 0)
    .map((group) => ({
      group,
      label: cardTypeLabel(group),
      count: counts.get(group) ?? 0,
      color: TYPE_COLORS[group],
    }));
}

/**
 * Curva de mana: exclui terrenos (CMC geralmente irrelevante).
 * Buckets 0–6 e 7+.
 */
export function manaCurve(cards: DeckStatCard[]): ManaBucket[] {
  const buckets = [0, 1, 2, 3, 4, 5, 6, 7].map((cmc) => ({
    label: cmc === 7 ? "7+" : String(cmc),
    cmc,
    count: 0,
  }));

  for (const card of cards) {
    if (cardTypeGroup(card.type_line) === "Lands") continue;
    const value = manaValueFromCost(card.mana_cost);
    const index = Math.min(7, Math.max(0, value));
    buckets[index].count += card.quantity;
  }

  return buckets;
}
