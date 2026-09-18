import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const [deck] = await sql<{ id: string }[]>`
    SELECT id FROM decks WHERE id = ${id} AND user_id = ${user.id}
  `;
  if (!deck) return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });

  let body: { collectionId?: string } = {};
  try {
    body = (await request.json()) as { collectionId?: string };
  } catch {
    body = {};
  }

  const [collection] = body.collectionId
    ? await sql<{ id: string }[]>`
        SELECT id FROM collections WHERE id = ${body.collectionId} AND user_id = ${user.id}
      `
    : await sql<{ id: string }[]>`
        SELECT id FROM collections WHERE user_id = ${user.id} ORDER BY created_at LIMIT 1
      `;
  if (!collection) return NextResponse.json({ error: "Coleção não encontrada." }, { status: 404 });

  const cards = await sql<{ catalog_card_id: string; quantity: number }[]>`
    SELECT catalog_card_id, quantity FROM deck_cards
    WHERE deck_id = ${id} AND included = true
  `;

  for (const card of cards) {
    await sql`
      INSERT INTO collection_items (collection_id, catalog_card_id, quantity)
      VALUES (${collection.id}, ${card.catalog_card_id}, ${card.quantity})
      ON CONFLICT (collection_id, catalog_card_id)
      DO UPDATE SET quantity = collection_items.quantity + EXCLUDED.quantity
    `;
  }

  return NextResponse.json({ added: cards.length, collectionId: collection.id });
}
