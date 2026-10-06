import { sql } from "@/lib/db";
import { extractCardFilters, type CardFilters } from "@/lib/scryfall-filters";
import {
  imageFromCard,
  scryfallAutocomplete,
  scryfallCollection,
  scryfallCollectionByIds,
  scryfallCollectionByPrints,
  scryfallNamed,
  scryfallSearch,
  scryfallSearchPage,
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

function isEnglish(card: ScryfallCard) {
  return !card.lang || card.lang === "en";
}

function printKey(set: string, collectorNumber: string) {
  return `${set.toLowerCase()}#${collectorNumber.toLowerCase()}`;
}

export type EnglishPrinting = { card: ScryfallCard; namePt: string | null };

/**
 * US-006-04: a Scryfall não dá preço para impressões em português. Troca cada impressão em outro idioma
 * pela impressão em inglês do mesmo set e número (ou, sem ela, pela que a Scryfall devolve pelo nome).
 * O nome impresso em português vira `namePt`.
 */
export async function toEnglishPrintings(cards: ScryfallCard[]): Promise<EnglishPrinting[]> {
  const foreign = cards.filter((card) => !isEnglish(card) && card.collector_number);
  const english = new Map<string, ScryfallCard>();
  for (let index = 0; index < foreign.length; index += 75) {
    const prints = foreign
      .slice(index, index + 75)
      .map((card) => ({ set: card.set, collector_number: card.collector_number as string }));
    for (const card of await scryfallCollectionByPrints(prints)) {
      if (card.collector_number && isEnglish(card)) english.set(printKey(card.set, card.collector_number), card);
    }
  }

  const result: EnglishPrinting[] = [];
  for (const card of cards) {
    if (isEnglish(card)) {
      result.push({ card, namePt: null });
      continue;
    }
    const namePt = card.lang === "pt" ? (card.printed_name ?? null) : null;
    let match = card.collector_number ? english.get(printKey(card.set, card.collector_number)) : undefined;
    if (!match) {
      const named = await scryfallNamed(card.name);
      if (named && isEnglish(named)) match = named;
    }
    result.push({ card: match ?? card, namePt });
  }
  return result;
}

/** Grava a impressão; em outro idioma, grava a impressão em inglês equivalente (US-006-04). */
export async function upsertScryfallCard(card: ScryfallCard, namePt?: string | null) {
  if (isEnglish(card)) return saveCatalogCard(card, namePt);
  const [english] = await toEnglishPrintings([card]);
  return saveCatalogCard(english.card, namePt ?? english.namePt);
}

async function saveCatalogCard(card: ScryfallCard, namePt?: string | null) {
  const images = imageFromCard(card);
  const printed = namePt ?? (card.lang === "pt" ? (card.printed_name ?? null) : null);
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

export function hasStoredFilters(filters: unknown) {
  return Boolean(filters && typeof filters === "object" && !Array.isArray(filters) && "name" in filters);
}

/** Busca na Scryfall e grava `filters` das impressões que ainda não têm (F-005, F-015). */
export async function hydrateMissingFilters(scryfallIds: string[]) {
  if (!scryfallIds.length) return false;
  try {
    for (let index = 0; index < scryfallIds.length; index += 75) {
      const cards = await scryfallCollectionByIds(scryfallIds.slice(index, index + 75));
      for (const card of cards) await saveCatalogCard(card);
    }
    return true;
  } catch {
    return false;
  }
}

async function searchLocal(query: string, limit = 8) {
  const term = `%${escapeLike(query.trim())}%`;
  return sql<CatalogRow[]>`
    SELECT DISTINCT ON (COALESCE(oracle_id, scryfall_id)) *
    FROM catalog_cards
    WHERE (
        lower(name_en) LIKE lower(${term}) ESCAPE '\\'
        OR lower(COALESCE(name_pt, '')) LIKE lower(${term}) ESCAPE '\\'
      )
      AND COALESCE(lang, 'en') = 'en'
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
  const portuguese = (await scryfallSearch(`lang:pt ${scryfallTerm(q)}`))
    .slice(0, 8)
    .filter((card) => !seen.has(card.oracle_id ?? card.id));

  for (const { card, namePt } of await toEnglishPrintings(portuguese)) {
    const key = card.oracle_id ?? card.id;
    if (seen.has(key)) continue;
    const saved = await saveCatalogCard(card, namePt);
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

function foldName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nameAliases(name: string) {
  const aliases = [name];
  const withoutNote = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (withoutNote && foldName(withoutNote) !== foldName(name)) aliases.push(withoutNote);
  return aliases;
}

function englishNote(name: string) {
  return name.match(/\(([^)]+)\)\s*$/)?.[1]?.trim() || null;
}

function sameCardName(card: ScryfallCard, query: string) {
  const wanted = foldName(query);
  return [card.name, card.printed_name].some((value) => value && foldName(value) === wanted);
}

/** Nome exato em português. Várias cartas diferentes viram ambíguo e não são gravadas. */
async function exactPortuguese(name: string): Promise<ScryfallCard | null | "ambiguous"> {
  const page = await scryfallSearchPage(`lang:pt !${scryfallTerm(name)}`);
  if (page.many) return "ambiguous";
  return page.cards[0] ?? null;
}

async function uniqueLocal(name: string, preferSet?: string | null) {
  const rows = await sql<CatalogRow[]>`
    SELECT * FROM catalog_cards
    WHERE (
        lower(name_en) = lower(${name})
        OR lower(COALESCE(name_pt, '')) = lower(${name})
      )
      AND COALESCE(lang, 'en') = 'en'
      ${preferSet ? sql`AND lower(set_code) = lower(${preferSet})` : sql``}
    ORDER BY released_at DESC NULLS LAST
  `;
  const identities = new Set(rows.map((row) => row.oracle_id ?? row.id));
  if (identities.size > 1) return "ambiguous" as const;
  return rows[0] ?? null;
}

export async function resolveCardName(name: string, preferSet?: string | null) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const local = await uniqueLocal(trimmed, preferSet);
  if (local === "ambiguous") return null;
  if (local) return local;

  let remote = await scryfallNamed(trimmed);
  let namePt: string | null = null;

  if (!remote) {
    const note = englishNote(trimmed);
    for (const alias of nameAliases(trimmed)) {
      const match = await exactPortuguese(alias);
      if (match === "ambiguous") {
        const named = note ? await scryfallNamed(note) : null;
        if (!named) return null;
        remote = named;
        namePt = alias;
        break;
      }
      if (match) {
        remote = match;
        namePt = match.printed_name ?? alias;
        break;
      }
    }
  }

  if (!remote) {
    const fuzzy = await scryfallNamed(trimmed, true);
    if (fuzzy && nameAliases(trimmed).some((alias) => sameCardName(fuzzy, alias))) remote = fuzzy;
  }
  if (!remote) return null;

  if (!namePt) namePt = await attachPortugueseName(remote);
  return upsertScryfallCard(remote, namePt);
}

export async function latestPrinting(oracleId: string) {
  const [local] = await sql<CatalogRow[]>`
    SELECT * FROM catalog_cards
    WHERE oracle_id = ${oracleId} AND COALESCE(lang, 'en') = 'en'
    ORDER BY released_at DESC NULLS LAST
    LIMIT 1
  `;
  if (local) return local;

  const cards = await scryfallSearch(`oracleid:${oracleId} unique:prints`);
  if (!cards[0]) return null;
  return upsertScryfallCard(cards[0]);
}
