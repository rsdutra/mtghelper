/** F-004 — agrupa cartas pelo type_line da Scryfall. */

export type CardTypeGroup =
  | "Creatures"
  | "Planeswalkers"
  | "Battles"
  | "Instants"
  | "Sorceries"
  | "Artifacts"
  | "Enchantments"
  | "Lands"
  | "Other";

const ORDER: CardTypeGroup[] = [
  "Creatures",
  "Planeswalkers",
  "Battles",
  "Instants",
  "Sorceries",
  "Artifacts",
  "Enchantments",
  "Lands",
  "Other",
];

const LABELS: Record<CardTypeGroup, string> = {
  Creatures: "Criaturas",
  Planeswalkers: "Planeswalkers",
  Battles: "Batalhas",
  Instants: "Instantâneos",
  Sorceries: "Feitiços",
  Artifacts: "Artefatos",
  Enchantments: "Encantamentos",
  Lands: "Terrenos",
  Other: "Outros",
};

export function cardTypeGroup(typeLine: string | null | undefined): CardTypeGroup {
  const line = (typeLine ?? "").toLowerCase();
  if (!line) return "Other";
  // Ordem importa: "Artifact Creature" → Creatures
  if (line.includes("creature")) return "Creatures";
  if (line.includes("planeswalker")) return "Planeswalkers";
  if (line.includes("battle")) return "Battles";
  if (line.includes("instant")) return "Instants";
  if (line.includes("sorcery")) return "Sorceries";
  if (line.includes("land")) return "Lands";
  if (line.includes("artifact")) return "Artifacts";
  if (line.includes("enchantment")) return "Enchantments";
  return "Other";
}

export function cardTypeLabel(group: CardTypeGroup) {
  return LABELS[group];
}

export function cardTypeOrder(): CardTypeGroup[] {
  return [...ORDER];
}

export function groupCardsByType<T extends { type_line?: string | null; name_en?: string }>(
  cards: T[],
): Array<{ group: CardTypeGroup; label: string; cards: T[] }> {
  const buckets = new Map<CardTypeGroup, T[]>();
  for (const card of cards) {
    const group = cardTypeGroup(card.type_line);
    const list = buckets.get(group) ?? [];
    list.push(card);
    buckets.set(group, list);
  }

  return ORDER.filter((group) => buckets.has(group)).map((group) => ({
    group,
    label: LABELS[group],
    cards: buckets.get(group) ?? [],
  }));
}
