import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { hasStoredFilters, hydrateMissingFilters } from "@/lib/cards";
import { sql } from "@/lib/db";
import { parseTags } from "@/lib/tags";

type Params = { params: Promise<{ id: string }> };

async function loadItems(collectionId: string) {
  return sql`
    SELECT ci.id AS item_id, ci.quantity, ci.price_cents, ci.note, ci.tags,
           c.id, c.scryfall_id, c.name_en, c.name_pt, c.set_code, c.set_name,
           c.image_normal, c.image_small, c.released_at, c.type_line, c.mana_cost, c.lang, c.filters
    FROM collection_items ci
    JOIN catalog_cards c ON c.id = ci.catalog_card_id
    WHERE ci.collection_id = ${collectionId}
    ORDER BY c.name_en
  `;
}

export async function GET(_request: Request, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const [collection] = await sql`
    SELECT id, name FROM collections WHERE id = ${id} AND user_id = ${user.id}
  `;
  if (!collection) return NextResponse.json({ error: "Coleção não encontrada." }, { status: 404 });

  let items = await loadItems(id);
  const missing = items
    .filter((item) => !hasStoredFilters(item.filters) && item.scryfall_id)
    .map((item) => String(item.scryfall_id));
  if (await hydrateMissingFilters(missing)) items = await loadItems(id);
  const tagged = items.map((item) => ({ ...item, tags: parseTags(item.tags) }));
  return NextResponse.json({ collection, items: tagged });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;

  const [collection] = await sql<{ id: string }[]>`
    SELECT id FROM collections WHERE id = ${id} AND user_id = ${user.id}
  `;
  if (!collection) return NextResponse.json({ error: "Coleção não encontrada." }, { status: 404 });

  const [countRow] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM collections WHERE user_id = ${user.id}
  `;
  if (Number(countRow?.count ?? 0) <= 1) {
    return NextResponse.json(
      { error: "Não é possível apagar a última coleção." },
      { status: 400 },
    );
  }

  await sql`DELETE FROM collections WHERE id = ${id} AND user_id = ${user.id}`;
  return NextResponse.json({ ok: true });
}
