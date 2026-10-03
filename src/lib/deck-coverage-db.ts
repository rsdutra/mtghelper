import { sql } from "@/lib/db";
import type { CoverageRow } from "@/lib/deck-coverage";

/**
 * Cópias necessárias (No deck + Sideboard) × possuídas (todas as coleções do usuário), por `oracle_id`
 * ou, sem ele, pelo id do catálogo (US-004-17).
 */
export function deckCoverageRows(userId: string, deckId: string) {
  return sql<CoverageRow[]>`
    WITH owned AS (
      SELECT COALESCE(cat.oracle_id, cat.id::text) AS card_key,
             SUM(ci.quantity)::int AS owned
      FROM collection_items ci
      JOIN collections col ON col.id = ci.collection_id
      JOIN catalog_cards cat ON cat.id = ci.catalog_card_id
      WHERE col.user_id = ${userId}
      GROUP BY 1
    ),
    needed AS (
      SELECT COALESCE(cat.oracle_id, cat.id::text) AS card_key,
             SUM(dc.quantity_main + dc.quantity_side)::int AS needed
      FROM deck_cards dc
      JOIN catalog_cards cat ON cat.id = dc.catalog_card_id
      WHERE dc.deck_id = ${deckId} AND (dc.quantity_main > 0 OR dc.quantity_side > 0)
      GROUP BY 1
    )
    SELECT n.card_key, n.needed, COALESCE(o.owned, 0)::int AS owned
    FROM needed n
    LEFT JOIN owned o USING (card_key)
  `;
}
