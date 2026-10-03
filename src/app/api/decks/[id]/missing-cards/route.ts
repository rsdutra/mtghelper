import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { latestPrinting } from "@/lib/cards";
import { sql } from "@/lib/db";
import { coverageByKey } from "@/lib/deck-coverage";
import { deckCoverageRows } from "@/lib/deck-coverage-db";

type Params = { params: Promise<{ id: string }> };

/**
 * US-004-19 — adiciona à coleção padrão as cópias que faltam das cartas escolhidas.
 * `keys` são as chaves da conferência (`oracle_id` ou id do catálogo); a quantidade é recalculada aqui.
 */
export async function POST(request: Request, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const [deck] = await sql<{ id: string }[]>`
    SELECT id FROM decks WHERE id = ${id} AND user_id = ${user.id}
  `;
  if (!deck) return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { keys?: unknown };
  const keys = Array.isArray(body.keys) ? [...new Set(body.keys.filter((key) => typeof key === "string"))] : [];
  if (!keys.length) return NextResponse.json({ error: "Escolha ao menos uma carta." }, { status: 400 });

  const [collection] = await sql<{ id: string }[]>`
    SELECT id FROM collections WHERE user_id = ${user.id} ORDER BY created_at LIMIT 1
  `;
  if (!collection) return NextResponse.json({ error: "Coleção não encontrada." }, { status: 404 });

  const coverage = coverageByKey(await deckCoverageRows(user.id, id));
  const deckCards = await sql<{ id: string; oracle_id: string | null; card_key: string }[]>`
    SELECT DISTINCT ON (card_key) c.id, c.oracle_id, COALESCE(c.oracle_id, c.id::text) AS card_key
    FROM deck_cards dc
    JOIN catalog_cards c ON c.id = dc.catalog_card_id
    WHERE dc.deck_id = ${id} AND (dc.quantity_main > 0 OR dc.quantity_side > 0)
    ORDER BY card_key, c.id
  `;
  const deckCardByKey = new Map(deckCards.map((card) => [card.card_key, card]));

  let added = 0;
  let copies = 0;
  for (const key of keys) {
    const missing = coverage.get(key)?.missing ?? 0;
    const deckCard = deckCardByKey.get(key);
    if (missing <= 0 || !deckCard) continue;
    const printing = deckCard.oracle_id ? await latestPrinting(deckCard.oracle_id) : null;
    await sql`
      INSERT INTO collection_items (collection_id, catalog_card_id, quantity)
      VALUES (${collection.id}, ${printing?.id ?? deckCard.id}, ${missing})
      ON CONFLICT (collection_id, catalog_card_id)
      DO UPDATE SET quantity = collection_items.quantity + EXCLUDED.quantity
    `;
    added += 1;
    copies += missing;
  }

  return NextResponse.json({ added, copies, collectionId: collection.id });
}
