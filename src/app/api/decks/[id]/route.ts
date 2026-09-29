import { NextResponse } from "next/server";
import { parseTags } from "@/lib/tags";
import { requireUser } from "@/lib/auth";
import { coverageByKey, coverageKey, summarizeCoverage, type CoverageRow } from "@/lib/deck-coverage";
import { isFormat, sideboardLimit } from "@/lib/formats";
import { sql } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

async function ownedDeck(userId: string, deckId: string) {
  const [deck] = await sql<{ id: string; name: string; format: string }[]>`
    SELECT id, name, format FROM decks WHERE id = ${deckId} AND user_id = ${userId}
  `;
  return deck ?? null;
}

export async function GET(_request: Request, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const deck = await ownedDeck(user.id, id);
  if (!deck) return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });

  const cards = await sql`
    SELECT dc.id AS deck_card_id, dc.quantity, dc.place, dc.price_cents, dc.note, dc.tags,
           c.id, c.oracle_id, c.name_en, c.name_pt, c.set_code, c.set_name,
           c.image_normal, c.image_small, c.mana_cost, c.type_line
    FROM deck_cards dc
    JOIN catalog_cards c ON c.id = dc.catalog_card_id
    WHERE dc.deck_id = ${id}
    ORDER BY CASE dc.place WHEN 'main' THEN 0 WHEN 'side' THEN 1 ELSE 2 END, c.name_en
  `;
  const coverageRows = await sql<CoverageRow[]>`
    WITH owned AS (
      SELECT COALESCE(cat.oracle_id, cat.id::text) AS card_key,
             SUM(ci.quantity)::int AS owned
      FROM collection_items ci
      JOIN collections col ON col.id = ci.collection_id
      JOIN catalog_cards cat ON cat.id = ci.catalog_card_id
      WHERE col.user_id = ${user.id}
      GROUP BY 1
    ),
    needed AS (
      SELECT COALESCE(cat.oracle_id, cat.id::text) AS card_key,
             SUM(dc.quantity)::int AS needed
      FROM deck_cards dc
      JOIN catalog_cards cat ON cat.id = dc.catalog_card_id
      WHERE dc.deck_id = ${id} AND dc.place IN ('main', 'side')
      GROUP BY 1
    )
    SELECT n.card_key, n.needed, COALESCE(o.owned, 0)::int AS owned
    FROM needed n
    LEFT JOIN owned o USING (card_key)
  `;
  const byKey = coverageByKey(coverageRows);
  const coverage = summarizeCoverage(coverageRows);
  const cardsWithCoverage = cards.map((card) => {
    const row = card as {
      tags?: unknown;
      place?: string;
      quantity?: number;
      oracle_id?: string | null;
      id?: string;
    };
    const tagged = { ...card, tags: parseTags(row.tags) };
    if (row.place === "out") return tagged;
    const key = coverageKey(typeof row.oracle_id === "string" ? row.oracle_id : null, String(row.id));
    const item = byKey.get(key);
    if (!item) {
      return { ...tagged, owned: 0, needed: Number(row.quantity) || 0, missing: Number(row.quantity) || 0 };
    }
    return { ...tagged, owned: item.owned, needed: item.needed, missing: item.missing };
  });
  return NextResponse.json({ deck, cards: cardsWithCoverage, coverage });
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const deck = await ownedDeck(user.id, id);
  if (!deck) return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });

  const body = (await request.json()) as { name?: string; format?: string };
  const name = body.name?.trim() || deck.name;
  const format = body.format && isFormat(body.format) ? body.format : deck.format;
  const [updated] = await sql<{ id: string; name: string; format: string }[]>`
    UPDATE decks SET name = ${name}, format = ${format}
    WHERE id = ${id}
    RETURNING id, name, format
  `;
  if (sideboardLimit(format) == null) {
    await sql`
      UPDATE deck_cards SET place = 'main'
      WHERE deck_id = ${id} AND place = 'side'
    `;
  }
  return NextResponse.json({ deck: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const deck = await ownedDeck(user.id, id);
  if (!deck) return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });

  await sql`DELETE FROM decks WHERE id = ${id} AND user_id = ${user.id}`;
  return NextResponse.json({ ok: true });
}
