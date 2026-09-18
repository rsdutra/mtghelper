import { manaValueFromCost } from "@/lib/mana";
import type { ScryfallCard } from "@/lib/scryfall";

export type CardFilters = {
  name: string;
  name_pt: string | null;
  oracle_id: string | null;
  type_line: string;
  oracle_text: string;
  flavor_text: string | null;
  keywords: string[];
  mana_cost: string;
  cmc: number;
  colors: string[];
  color_identity: string[];
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  rarity: string;
  set: string;
  set_name: string | null;
  collector_number: string | null;
  released_at: string | null;
  artist: string | null;
  lang: string;
  layout: string;
  legalities: Record<string, string>;
  produced_mana: string[];
  frame: string | null;
  border_color: string | null;
  games: string[];
  reprint: boolean;
  digital: boolean;
  promo: boolean;
  reserved: boolean;
  finishes: string[];
  usd: number | null;
  eur: number | null;
  tix: number | null;
};

function joinFaces(card: ScryfallCard, key: "oracle_text" | "type_line" | "flavor_text" | "mana_cost") {
  const root = card[key];
  if (typeof root === "string" && root.trim()) return root;
  const parts = (card.card_faces ?? []).map((face) => face[key]).filter((value): value is string => Boolean(value));
  return parts.join("\n");
}

function mergeColors(card: ScryfallCard): string[] {
  if (card.colors?.length) return card.colors;
  const merged = new Set<string>();
  for (const face of card.card_faces ?? []) {
    for (const color of face.colors ?? []) merged.add(color);
  }
  return [...merged];
}

function parsePrice(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function extractCardFilters(card: ScryfallCard): CardFilters {
  const typeLine = card.type_line || joinFaces(card, "type_line");
  const oracle = card.oracle_text || joinFaces(card, "oracle_text");
  const manaCost = card.mana_cost || joinFaces(card, "mana_cost");
  const power = card.power ?? card.card_faces?.[0]?.power ?? null;
  const toughness = card.toughness ?? card.card_faces?.[0]?.toughness ?? null;
  const loyalty = card.loyalty ?? card.card_faces?.[0]?.loyalty ?? null;

  return {
    name: card.name,
    name_pt: card.lang && card.lang !== "en" ? (card.printed_name ?? null) : null,
    oracle_id: card.oracle_id ?? null,
    type_line: typeLine,
    oracle_text: oracle,
    flavor_text: card.flavor_text ?? card.card_faces?.[0]?.flavor_text ?? null,
    keywords: card.keywords ?? [],
    mana_cost: manaCost,
    cmc: typeof card.cmc === "number" ? card.cmc : manaValueFromCost(manaCost),
    colors: mergeColors(card),
    color_identity: card.color_identity ?? [],
    power,
    toughness,
    loyalty,
    rarity: card.rarity ?? "",
    set: card.set,
    set_name: card.set_name ?? null,
    collector_number: card.collector_number ?? null,
    released_at: card.released_at ?? null,
    artist: card.artist ?? null,
    lang: card.lang ?? "en",
    layout: card.layout ?? "normal",
    legalities: card.legalities ?? {},
    produced_mana: card.produced_mana ?? [],
    frame: card.frame ?? null,
    border_color: card.border_color ?? null,
    games: card.games ?? [],
    reprint: Boolean(card.reprint),
    digital: Boolean(card.digital),
    promo: Boolean(card.promo),
    reserved: Boolean(card.reserved),
    finishes: card.finishes ?? [],
    usd: parsePrice(card.prices?.usd),
    eur: parsePrice(card.prices?.eur),
    tix: parsePrice(card.prices?.tix),
  };
}

export function filtersFromCatalog(row: {
  name_en: string;
  name_pt?: string | null;
  type_line?: string | null;
  mana_cost?: string | null;
  set_code: string;
  set_name?: string | null;
  lang?: string | null;
  filters?: CardFilters | null;
}): CardFilters {
  if (row.filters && typeof row.filters === "object" && row.filters.name) {
    return {
      ...row.filters,
      name_pt: row.filters.name_pt ?? row.name_pt ?? null,
    };
  }
  return {
    name: row.name_en,
    name_pt: row.name_pt ?? null,
    oracle_id: null,
    type_line: row.type_line ?? "",
    oracle_text: "",
    flavor_text: null,
    keywords: [],
    mana_cost: row.mana_cost ?? "",
    cmc: manaValueFromCost(row.mana_cost),
    colors: [],
    color_identity: [],
    power: null,
    toughness: null,
    loyalty: null,
    rarity: "",
    set: row.set_code,
    set_name: row.set_name ?? null,
    collector_number: null,
    released_at: null,
    artist: null,
    lang: row.lang ?? "en",
    layout: "normal",
    legalities: {},
    produced_mana: [],
    frame: null,
    border_color: null,
    games: [],
    reprint: false,
    digital: false,
    promo: false,
    reserved: false,
    finishes: [],
    usd: null,
    eur: null,
    tix: null,
  };
}
