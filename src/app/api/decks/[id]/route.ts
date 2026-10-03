import { NextResponse } from "next/server";
import { parseTags } from "@/lib/tags";
import { requireUser } from "@/lib/auth";
import { hydrateMissingFilters } from "@/lib/cards";
import { coverageByKey, coverageKey, summarizeCoverage } from "@/lib/deck-coverage";
import { deckCoverageRows } from "@/lib/deck-coverage-db";
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

  type StoredCard = {
    deck_card_id: string;
    quantity_main: number;
    quantity_side: number;
    quantity_out: number;
    price_cents: number | null;
    note: string | null;
    tags: string;
    id: string;
    oracle_id: string | null;
    name_en: string;
    name_pt: string | null;
    set_code: string;
    set_name: string | null;
    image_normal: string | null;
    image_small: string | null;
    mana_cost: string | null;
    type_line: string | null;
    front_mana_cost: string | null;
    produced_mana: string[] | null;
  };
  const missing = await sql<{ scryfall_id: string }[]>`
    SELECT c.scryfall_id
    FROM deck_cards dc
    JOIN catalog_cards c ON c.id = dc.catalog_card_id
    WHERE dc.deck_id = ${id} AND (c.filters->>'name') IS NULL
  `;
  await hydrateMissingFilters(missing.map((row) => row.scryfall_id));
  const stored = await sql<StoredCard[]>`
    SELECT dc.id AS deck_card_id, dc.quantity_main, dc.quantity_side, dc.quantity_out,
           dc.price_cents, dc.note, dc.tags,
           c.id, c.oracle_id, c.name_en, c.name_pt, c.set_code, c.set_name,
           c.image_normal, c.image_small, c.mana_cost, c.type_line,
           NULLIF(split_part(c.filters->>'mana_cost', E'\n', 1), '') AS front_mana_cost,
           c.filters->'produced_mana' AS produced_mana
    FROM deck_cards dc
    JOIN catalog_cards c ON c.id = dc.catalog_card_id
    WHERE dc.deck_id = ${id}
    ORDER BY c.name_en
  `;
  const placeOrder = { main: 0, side: 1, out: 2 } as const;
  const cards = stored.flatMap((row) => {
    const quantities = [
      ["main", Number(row.quantity_main)],
      ["side", Number(row.quantity_side)],
      ["out", Number(row.quantity_out)],
    ] as const;
    return quantities
      .filter(([, quantity]) => quantity > 0)
      .map(([place, quantity]) => ({ ...row, place, quantity }));
  });
  cards.sort(
    (a, b) => placeOrder[a.place] - placeOrder[b.place] || String(a.name_en).localeCompare(String(b.name_en)),
  );
  const coverageRows = await deckCoverageRows(user.id, id);
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
      UPDATE deck_cards
      SET quantity_main = quantity_main + quantity_side,
          quantity_side = 0
      WHERE deck_id = ${id} AND quantity_side > 0
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
