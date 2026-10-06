import type { TransactionSql } from "postgres";
import { toEnglishPrintings, upsertScryfallCard } from "@/lib/cards";
import { sql } from "@/lib/db";
import type { ScryfallCard } from "@/lib/scryfall";
import { collectTags, parseTags, serializeTags } from "@/lib/tags";

/**
 * F-006 / US-006-04 — decks e coleções criados antes guardam impressões em português, sem preço.
 * Ao abrir a lista, cada uma passa para a impressão em inglês do mesmo set e número.
 */
type ForeignRow = {
  id: string;
  scryfall_id: string;
  name_en: string;
  name_pt: string | null;
  set_code: string;
  collector_number: string | null;
  lang: string;
};

type Tx = TransactionSql;

/** Impressão em inglês para cada impressão estrangeira: primeiro no catálogo, depois na Scryfall. */
async function englishEquivalents(rows: ForeignRow[]) {
  const map = new Map<string, string>();
  const remote: ForeignRow[] = [];
  for (const row of rows) {
    const [local] = row.collector_number
      ? await sql<{ id: string }[]>`
          SELECT id FROM catalog_cards
          WHERE lower(set_code) = lower(${row.set_code})
            AND collector_number = ${row.collector_number}
            AND COALESCE(lang, 'en') = 'en'
          LIMIT 1
        `
      : [];
    if (local) {
      map.set(row.id, local.id);
      if (row.name_pt) {
        await sql`UPDATE catalog_cards SET name_pt = COALESCE(name_pt, ${row.name_pt}) WHERE id = ${local.id}`;
      }
    } else {
      remote.push(row);
    }
  }

  if (remote.length) {
    const cards: ScryfallCard[] = remote.map((row) => ({
      id: row.scryfall_id,
      name: row.name_en,
      printed_name: row.name_pt ?? undefined,
      lang: row.lang,
      set: row.set_code,
      collector_number: row.collector_number ?? undefined,
    }));
    const english = await toEnglishPrintings(cards);
    for (const [index, { card }] of english.entries()) {
      if (card.lang && card.lang !== "en") continue;
      const saved = await upsertScryfallCard(card, remote[index].name_pt);
      map.set(remote[index].id, saved.id);
    }
  }
  return map;
}

function mergedTags(target: string, source: string) {
  return serializeTags(collectTags([parseTags(target), parseTags(source)]));
}

type DeckCardRow = {
  id: string;
  quantity_main: number;
  quantity_side: number;
  quantity_out: number;
  price_cents: number | null;
  note: string | null;
  tags: string;
};

async function moveDeckCard(tx: Tx, deckId: string, fromId: string, toId: string) {
  const [from] = await tx<DeckCardRow[]>`
    SELECT * FROM deck_cards WHERE deck_id = ${deckId} AND catalog_card_id = ${fromId} FOR UPDATE
  `;
  if (!from) return;
  const [to] = await tx<DeckCardRow[]>`
    SELECT * FROM deck_cards WHERE deck_id = ${deckId} AND catalog_card_id = ${toId} FOR UPDATE
  `;
  if (to) {
    await tx`
      UPDATE deck_cards
      SET quantity_main = quantity_main + ${from.quantity_main},
          quantity_side = quantity_side + ${from.quantity_side},
          quantity_out = quantity_out + ${from.quantity_out},
          price_cents = COALESCE(price_cents, ${from.price_cents}),
          note = COALESCE(NULLIF(note, ''), ${from.note}),
          tags = ${mergedTags(to.tags, from.tags)}
      WHERE id = ${to.id}
    `;
    await tx`DELETE FROM deck_cards WHERE id = ${from.id}`;
  } else {
    await tx`UPDATE deck_cards SET catalog_card_id = ${toId} WHERE id = ${from.id}`;
  }
  // As chaves dos nós do canvas carregam o id da impressão (`card:<id>:…`).
  await tx`
    UPDATE deck_canvas_konva
    SET snapshot = replace(snapshot::text, ${fromId}, ${toId})::jsonb
    WHERE deck_id = ${deckId}
  `;
}

type CollectionItemRow = { id: string; quantity: number; price_cents: number | null; note: string | null; tags: string };

async function moveCollectionItem(tx: Tx, collectionId: string, fromId: string, toId: string) {
  const [from] = await tx<CollectionItemRow[]>`
    SELECT * FROM collection_items WHERE collection_id = ${collectionId} AND catalog_card_id = ${fromId} FOR UPDATE
  `;
  if (!from) return;
  const [to] = await tx<CollectionItemRow[]>`
    SELECT * FROM collection_items WHERE collection_id = ${collectionId} AND catalog_card_id = ${toId} FOR UPDATE
  `;
  if (to) {
    await tx`
      UPDATE collection_items
      SET quantity = quantity + ${from.quantity},
          price_cents = COALESCE(price_cents, ${from.price_cents}),
          note = COALESCE(NULLIF(note, ''), ${from.note}),
          tags = ${mergedTags(to.tags, from.tags)}
      WHERE id = ${to.id}
    `;
    await tx`DELETE FROM collection_items WHERE id = ${from.id}`;
  } else {
    await tx`UPDATE collection_items SET catalog_card_id = ${toId} WHERE id = ${from.id}`;
  }
}

/** Devolve `true` se alguma carta do deck trocou de impressão. Falha da Scryfall não impede abrir o deck. */
export async function normalizeDeckPrintings(deckId: string) {
  try {
    const rows = await sql<ForeignRow[]>`
      SELECT c.id, c.scryfall_id, c.name_en, c.name_pt, c.set_code, c.collector_number, c.lang
      FROM deck_cards dc
      JOIN catalog_cards c ON c.id = dc.catalog_card_id
      WHERE dc.deck_id = ${deckId} AND COALESCE(c.lang, 'en') <> 'en'
    `;
    if (!rows.length) return false;
    const map = await englishEquivalents(rows);
    if (!map.size) return false;
    await sql.begin(async (tx) => {
      for (const [fromId, toId] of map) await moveDeckCard(tx, deckId, fromId, toId);
    });
    return true;
  } catch {
    return false;
  }
}

export async function normalizeCollectionPrintings(collectionId: string) {
  try {
    const rows = await sql<ForeignRow[]>`
      SELECT c.id, c.scryfall_id, c.name_en, c.name_pt, c.set_code, c.collector_number, c.lang
      FROM collection_items ci
      JOIN catalog_cards c ON c.id = ci.catalog_card_id
      WHERE ci.collection_id = ${collectionId} AND COALESCE(c.lang, 'en') <> 'en'
    `;
    if (!rows.length) return false;
    const map = await englishEquivalents(rows);
    if (!map.size) return false;
    await sql.begin(async (tx) => {
      for (const [fromId, toId] of map) await moveCollectionItem(tx, collectionId, fromId, toId);
    });
    return true;
  } catch {
    return false;
  }
}
