/** F-015 — cores de mana do deck: símbolos no custo (US-015-01) e produção dos terrenos (US-015-02). */

export type ManaColor = "W" | "U" | "B" | "R" | "G" | "C";

export const MANA_COLORS: ManaColor[] = ["W", "U", "B", "R", "G", "C"];

const LABELS: Record<ManaColor, string> = {
  W: "Branco",
  U: "Azul",
  B: "Preto",
  R: "Vermelho",
  G: "Verde",
  C: "Incolor",
};

const FILLS: Record<ManaColor, string> = {
  W: "#f8e7b9",
  U: "#0e68ab",
  B: "#2b2622",
  R: "#d3202a",
  G: "#00733e",
  C: "#b8b0ab",
};

const BASIC_LAND_TYPES: Array<[RegExp, ManaColor]> = [
  [/\bplains\b/i, "W"],
  [/\bisland\b/i, "U"],
  [/\bswamp\b/i, "B"],
  [/\bmountain\b/i, "R"],
  [/\bforest\b/i, "G"],
];

export type ManaColorCard = {
  quantity: number;
  type_line?: string | null;
  mana_cost?: string | null;
  /** Custo da face da frente, para dupla-face sem `mana_cost` no topo. */
  front_mana_cost?: string | null;
  /** `produced_mana` da Scryfall; `null` quando o catálogo ainda não tem o metadado. */
  produced_mana?: string[] | null;
};

export type ManaColorSlice = {
  color: ManaColor;
  label: string;
  count: number;
  percent: number;
  fill: string;
};

export type ManaSymbolStats = {
  slices: ManaColorSlice[];
  total: number;
};

export type LandProductionStats = {
  slices: ManaColorSlice[];
  lands: number;
  withoutProduction: number;
};

function isManaColor(value: string): value is ManaColor {
  return (MANA_COLORS as string[]).includes(value);
}

function emptyCounts(): Record<ManaColor, number> {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

function toSlices(counts: Record<ManaColor, number>): ManaColorSlice[] {
  const total = MANA_COLORS.reduce((sum, color) => sum + counts[color], 0);
  if (!total) return [];
  return MANA_COLORS.filter((color) => counts[color] > 0)
    .sort((a, b) => counts[b] - counts[a])
    .map((color) => ({
      color,
      label: LABELS[color],
      count: counts[color],
      percent: Math.round((counts[color] / total) * 100),
      fill: FILLS[color],
    }));
}

/** Símbolos de cor de uma cópia. Híbrido conta para cada cor; genérico, X e phyrexiano `P` não contam. */
export function colorPips(manaCost: string | null | undefined): Record<ManaColor, number> {
  const counts = emptyCounts();
  for (const [, token] of (manaCost ?? "").matchAll(/\{([^}]+)\}/g)) {
    const colors = new Set(token.toUpperCase().split("/").filter(isManaColor));
    for (const color of colors) counts[color] += 1;
  }
  return counts;
}

export function isLand(typeLine: string | null | undefined) {
  return /\bland\b/i.test(typeLine ?? "");
}

function frontIsLand(typeLine: string | null | undefined) {
  return isLand((typeLine ?? "").split("//")[0]);
}

/** Cores geradas por um terreno. Sem metadado, deduz dos tipos básicos no type line. */
export function landColors(card: Pick<ManaColorCard, "type_line" | "produced_mana">): ManaColor[] {
  if (Array.isArray(card.produced_mana)) {
    return [...new Set(card.produced_mana.map((value) => value.toUpperCase()).filter(isManaColor))];
  }
  const typeLine = card.type_line ?? "";
  return BASIC_LAND_TYPES.filter(([pattern]) => pattern.test(typeLine)).map(([, color]) => color);
}

/** US-015-01 — símbolos de cor no custo das cartas que não são terreno na face da frente. */
export function manaSymbolDistribution(cards: ManaColorCard[]): ManaSymbolStats {
  const counts = emptyCounts();
  for (const card of cards) {
    if (frontIsLand(card.type_line)) continue;
    const pips = colorPips(card.mana_cost || card.front_mana_cost);
    for (const color of MANA_COLORS) counts[color] += pips[color] * card.quantity;
  }
  return {
    slices: toSlices(counts),
    total: MANA_COLORS.reduce((sum, color) => sum + counts[color], 0),
  };
}

/** US-015-02 — terrenos por cor gerada; um terreno de duas cores conta para as duas. */
export function landProductionDistribution(cards: ManaColorCard[]): LandProductionStats {
  const counts = emptyCounts();
  let lands = 0;
  let withoutProduction = 0;
  for (const card of cards) {
    if (!isLand(card.type_line)) continue;
    lands += card.quantity;
    const colors = landColors(card);
    if (!colors.length) {
      withoutProduction += card.quantity;
      continue;
    }
    for (const color of colors) counts[color] += card.quantity;
  }
  return { slices: toSlices(counts), lands, withoutProduction };
}
