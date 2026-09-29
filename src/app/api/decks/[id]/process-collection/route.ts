import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

type PreviewRow = {
  catalog_card_id: string;
  quantity: number;
  name_pt: string | null;
  name_en: string;
  owned: number;
};

type ApplyItem = { catalogCardId?: string; quantity?: number };

export async function POST(request: Request, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const [deck] = await sql<{ id: string }[]>`
    SELECT id FROM decks WHERE id = ${id} AND user_id = ${user.id}
  `;
  if (!deck) return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    action?: "preview" | "apply";
    includeMain?: boolean;
    includeOut?: boolean;
    items?: ApplyItem[];
  };

  const [collection] = await sql<{ id: string }[]>`
    SELECT id FROM collections WHERE user_id = ${user.id} ORDER BY created_at LIMIT 1
  `;
  if (!collection) return NextResponse.json({ error: "Coleção não encontrada." }, { status: 404 });

  if (body.action === "preview") {
    const includeMain = body.includeMain === true;
    const includeOut = body.includeOut === true;
    if (!includeMain && !includeOut) {
      return NextResponse.json({ error: "Escolha ao menos um grupo." }, { status: 400 });
    }
    const rows = await sql<PreviewRow[]>`
      SELECT dc.catalog_card_id,
             dc.quantity,
             c.name_pt,
             c.name_en,
             COALESCE((
               SELECT SUM(ci.quantity)::int
               FROM collection_items ci
               JOIN collections col ON col.id = ci.collection_id
               JOIN catalog_cards owned_card ON owned_card.id = ci.catalog_card_id
               WHERE col.user_id = ${user.id}
                 AND COALESCE(owned_card.oracle_id, owned_card.id::text) = COALESCE(c.oracle_id, c.id::text)
             ), 0)::int AS owned
      FROM deck_cards dc
      JOIN catalog_cards c ON c.id = dc.catalog_card_id
      WHERE dc.deck_id = ${id}
        AND (
          (${includeMain} AND dc.place IN ('main', 'side'))
          OR (${includeOut} AND dc.place = 'out')
        )
      ORDER BY c.name_en
    `;
    const existing = rows
      .filter((row) => row.owned > 0)
      .map((row) => ({
        catalogCardId: row.catalog_card_id,
        name: row.name_pt ?? row.name_en,
        deckQuantity: row.quantity,
        owned: row.owned,
      }));
    const fresh = rows
      .filter((row) => row.owned <= 0)
      .map((row) => ({
        catalogCardId: row.catalog_card_id,
        name: row.name_pt ?? row.name_en,
        quantity: row.quantity,
      }));
    return NextResponse.json({ existing, fresh, collectionId: collection.id });
  }

  if (body.action === "apply") {
    const requested = (body.items ?? []).flatMap((item) => {
      const quantity = item.quantity;
      if (!item.catalogCardId || !Number.isInteger(quantity) || !quantity || quantity < 1 || quantity > 99) return [];
      return [{ catalogCardId: item.catalogCardId, quantity }];
    });
    if (!requested.length) return NextResponse.json({ added: 0, collectionId: collection.id });

    const allowed = await sql<{ catalog_card_id: string }[]>`
      SELECT catalog_card_id FROM deck_cards WHERE deck_id = ${id}
    `;
    const allowedIds = new Set(allowed.map((row) => row.catalog_card_id));
    let added = 0;
    for (const item of requested) {
      if (!allowedIds.has(item.catalogCardId)) continue;
      await sql`
        INSERT INTO collection_items (collection_id, catalog_card_id, quantity)
        VALUES (${collection.id}, ${item.catalogCardId}, ${item.quantity})
        ON CONFLICT (collection_id, catalog_card_id)
        DO UPDATE SET quantity = collection_items.quantity + EXCLUDED.quantity
      `;
      added += 1;
    }
    return NextResponse.json({ added, collectionId: collection.id });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
