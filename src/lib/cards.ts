import { sql } from "@/lib/db";
import { extractCardFilters, type CardFilters } from "@/lib/scryfall-filters";
import {
  imageFromCard,
  scryfallAutocomplete,
  scryfallCollection,
  scryfallNamed,
  scryfallSearch,
  type ScryfallCard,
} from "@/lib/scryfall";

export type CardSuggestion = {
  oracleId: string | null;
  nameEn: string;
  namePt: string | null;
  setCode: string;
  setName: string | null;
  imageSmall: string | null;
  imageNormal: string | null;
  catalogId: string;
};

type CatalogRow = {
  id: string;
  scryfall_id: string;
  oracle_id: string | null;
  name_en: string;
  name_pt: string | null;
  set_code: string;
  set_name: string | null;
  collector_number: string | null;
  released_at: string | null;
  image_small: string | null;
  image_normal: string | null;
  type_line: string | null;
  mana_cost: string | null;
  filters?: CardFilters | null;
};

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function scryfallTerm(value: string) {
  return `"${value.replace(/"/g, "")}"`;
}

function toSuggestion(row: CatalogRow): CardSuggestion {
  return {
    oracleId: row.oracle_id,
    nameEn: row.name_en,
    namePt: row.name_pt,
    setCode: row.set_code,
    setName: row.set_name,
    imageSmall: row.image_small,
    imageNormal: row.image_normal,
    catalogId: row.id,
  };
}

export async function upsertScryfallCard(card: ScryfallCard, namePt?: string | null) {
  const images = imageFromCard(card);
  const printed = namePt ?? (card.lang && card.lang !== "en" ? card.printed_name ?? null : null);
  const filters = extractCardFilters(card);
  if (printed) filters.name_pt = printed;
  const [row] = await sql<CatalogRow[]>`
    INSERT INTO catalog_cards (
      scryfall_id, oracle_id, name_en, name_pt, set_code, set_name,
      collector_number, released_at, image_small, image_normal, lang, type_line, mana_cost, filters
    ) VALUES (
      ${card.id},
      ${card.oracle_id ?? null},
      ${card.name},
      ${printed},
      ${card.set},
      ${card.set_name ?? null},
      ${card.collector_number ?? null},
      ${card.released_at ?? null},
      ${images.small},
      ${images.normal},
      ${card.lang ?? "en"},
      ${card.type_line ?? null},
      ${card.mana_cost ?? null},
      ${sql.json(filters as never)}
    )
    ON CONFLICT (scryfall_id) DO UPDATE SET
      name_pt = COALESCE(EXCLUDED.name_pt, catalog_cards.name_pt),
      image_small = COALESCE(EXCLUDED.image_small, catalog_cards.image_small),
      image_normal = COALESCE(EXCLUDED.image_normal, catalog_cards.image_normal),
      type_line = COALESCE(EXCLUDED.type_line, catalog_cards.type_line),
      mana_cost = COALESCE(EXCLUDED.mana_cost, catalog_cards.mana_cost),
      filters = EXCLUDED.filters,
      fetched_at = now()
    RETURNING *
  `;
  return row;
}

async function searchLocal(query: string, limit = 8) {
  const term = `%${escapeLike(query.trim())}%`;
  return sql<CatalogRow[]>`
    SELECT DISTINCT ON (COALESCE(oracle_id, scryfall_id)) *
    FROM catalog_cards
    WHERE lower(name_en) LIKE lower(${term}) ESCAPE '\\'
       OR lower(COALESCE(name_pt, '')) LIKE lower(${term}) ESCAPE '\\'
    ORDER BY COALESCE(oracle_id, scryfall_id), released_at DESC NULLS LAST
    LIMIT ${limit}
  `;
}

async function attachPortugueseName(card: ScryfallCard) {
  if (card.printed_name && card.lang && card.lang !== "en") return card.printed_name;
  if (!card.oracle_id) return null;
  const printed = await scryfallSearch(`oracleid:${card.oracle_id} lang:pt`);
  return printed[0]?.printed_name ?? null;
}

export async function suggestCards(query: string): Promise<CardSuggestion[]> {
  const q = query.trim();
  if (q.length < 4) return [];

  const local = await searchLocal(q);
  if (local.length >= 8) return local.map(toSuggestion);

  const seen = new Set(local.map((row) => row.oracle_id ?? row.scryfall_id));
  const merged = [...local];

  const englishNames = await scryfallAutocomplete(q);
  const portuguese = await scryfallSearch(`lang:pt (printed_name:${scryfallTerm(q)} OR name:${scryfallTerm(q)})`);

  for (const card of portuguese.slice(0, 8)) {
    const key = card.oracle_id ?? card.id;
    if (seen.has(key)) continue;
    const saved = await upsertScryfallCard(card, card.printed_name);
    seen.add(key);
    merged.push(saved);
  }

  const missingNames = englishNames
    .filter((name) => !merged.some((row) => row.name_en.toLowerCase() === name.toLowerCase()))
    .slice(0, 8);
  const englishCards = await scryfallCollection(missingNames);
  for (const card of englishCards) {
    const key = card.oracle_id ?? card.id;
    if (seen.has(key)) continue;
    const saved = await upsertScryfallCard(card);
    seen.add(key);
    merged.push(saved);
    if (merged.length >= 8) break;
  }

  return merged.slice(0, 8).map(toSuggestion);
}

export async function resolveCardName(name: string, preferSet?: string | null) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  if (preferSet) {
    const [localSet] = await sql<CatalogRow[]>`
      SELECT * FROM catalog_cards
      WHERE lower(set_code) = lower(${preferSet})
        AND (
          lower(name_en) = lower(${trimmed})
          OR lower(COALESCE(name_pt, '')) = lower(${trimmed})
        )
      LIMIT 1
    `;
    if (localSet) return localSet;
  }

  const [local] = await sql<CatalogRow[]>`
    SELECT * FROM catalog_cards
    WHERE lower(name_en) = lower(${trimmed})
       OR lower(COALESCE(name_pt, '')) = lower(${trimmed})
    ORDER BY released_at DESC NULLS LAST
    LIMIT 1
  `;
  if (local && !preferSet) return local;

  let remote = await scryfallNamed(trimmed);
  let namePt: string | null = null;

  if (!remote) {
    const printed = await scryfallSearch(`lang:pt printed_name:${scryfallTerm(trimmed)}`);
    const fallback = printed[0];
    if (fallback) {
      remote = fallback;
      namePt = fallback.printed_name ?? trimmed;
    }
  }

  if (!remote) remote = await scryfallNamed(trimmed, true);
  if (!remote) return null;

  if (!namePt) namePt = await attachPortugueseName(remote);
  return upsertScryfallCard(remote, namePt);
}

export async function latestPrinting(oracleId: string) {
  const [local] = await sql<CatalogRow[]>`
    SELECT * FROM catalog_cards
    WHERE oracle_id = ${oracleId}
    ORDER BY released_at DESC NULLS LAST
    LIMIT 1
  `;
  if (local) return local;

  const cards = await scryfallSearch(`oracleid:${oracleId} unique:prints`);
  if (!cards[0]) return null;
  return upsertScryfallCard(cards[0]);
}
