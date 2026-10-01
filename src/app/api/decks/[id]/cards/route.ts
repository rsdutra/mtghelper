import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { resolveCardName } from "@/lib/cards";
import { sql } from "@/lib/db";
import { sideboardLimit } from "@/lib/formats";
import { parseCardList } from "@/lib/lists";
import { collectTags, parseTags, sanitizeTagList, serializeTags } from "@/lib/tags";

type Place = "out" | "main" | "side";

function isPlace(value: unknown): value is Place {
  return value === "out" || value === "main" || value === "side";
}

type Params = { params: Promise<{ id: string }> };

type QuantityRow = {
  id: string;
  quantity_main: number;
  quantity_side: number;
  quantity_out: number;
};

function quantitiesFor(place: Place, quantity: number) {
  return {
    main: place === "main" ? quantity : 0,
    side: place === "side" ? quantity : 0,
    out: place === "out" ? quantity : 0,
  };
}

async function ownedDeck(userId: string, deckId: string) {
  const [deck] = await sql<{ id: string }[]>`
    SELECT id FROM decks WHERE id = ${deckId} AND user_id = ${userId}
  `;
  return deck ?? null;
}

async function allowsSide(deckId: string) {
  const [deck] = await sql<{ format: string }[]>`SELECT format FROM decks WHERE id = ${deckId}`;
  return Boolean(deck && sideboardLimit(deck.format) != null);
}

export async function POST(request: Request, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  if (!(await ownedDeck(user.id, id))) {
    return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });
  }

  const body = (await request.json()) as {
    text?: string;
    set?: string;
    place?: Place;
  };
  const place: Place = isPlace(body.place) ? body.place : "main";
  if (place === "side" && !(await allowsSide(id))) {
    return NextResponse.json({ error: "Este formato não tem sideboard." }, { status: 400 });
  }
  const lines = parseCardList(body.text ?? "");
  const missing = [];
  let added = 0;

  for (const line of lines) {
    const card = await resolveCardName(line.name, body.set || null);
    if (!card) {
      missing.push(line);
      continue;
    }

    const qty = quantitiesFor(place, line.quantity);
    await sql`
      INSERT INTO deck_cards (deck_id, catalog_card_id, quantity_main, quantity_side, quantity_out)
      VALUES (${id}, ${card.id}, ${qty.main}, ${qty.side}, ${qty.out})
      ON CONFLICT (deck_id, catalog_card_id)
      DO UPDATE SET
        quantity_main = deck_cards.quantity_main + EXCLUDED.quantity_main,
        quantity_side = deck_cards.quantity_side + EXCLUDED.quantity_side,
        quantity_out = deck_cards.quantity_out + EXCLUDED.quantity_out
    `;
    added += 1;
  }

  return NextResponse.json({ added, missing });
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  if (!(await ownedDeck(user.id, id))) {
    return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });
  }

  const body = (await request.json()) as {
    catalogCardId?: string;
    from?: Place;
    place?: Place;
    priceCents?: number | null;
    note?: string | null;
    tags?: unknown;
  };
  const catalogCardId = body.catalogCardId;
  if (!catalogCardId) {
    return NextResponse.json({ error: "Carta obrigatória." }, { status: 400 });
  }

  const [row] = await sql<QuantityRow[]>`
    SELECT id, quantity_main, quantity_side, quantity_out
    FROM deck_cards
    WHERE deck_id = ${id} AND catalog_card_id = ${catalogCardId}
  `;
  if (!row) return NextResponse.json({ error: "Carta não está no deck." }, { status: 404 });

  if (isPlace(body.place)) {
    if (!isPlace(body.from)) {
      return NextResponse.json({ error: "Origem obrigatória." }, { status: 400 });
    }
    if (body.place === "side" && !(await allowsSide(id))) {
      return NextResponse.json({ error: "Este formato não tem sideboard." }, { status: 400 });
    }
    if (body.from !== body.place) {
      const from = body.from;
      const to = body.place;
      await sql`
        UPDATE deck_cards
        SET quantity_main = CASE
              WHEN ${from} = 'main' THEN 0
              WHEN ${to} = 'main' THEN quantity_main + CASE ${from}
                WHEN 'side' THEN quantity_side
                WHEN 'out' THEN quantity_out
                ELSE 0
              END
              ELSE quantity_main
            END,
            quantity_side = CASE
              WHEN ${from} = 'side' THEN 0
              WHEN ${to} = 'side' THEN quantity_side + CASE ${from}
                WHEN 'main' THEN quantity_main
                WHEN 'out' THEN quantity_out
                ELSE 0
              END
              ELSE quantity_side
            END,
            quantity_out = CASE
              WHEN ${from} = 'out' THEN 0
              WHEN ${to} = 'out' THEN quantity_out + CASE ${from}
                WHEN 'main' THEN quantity_main
                WHEN 'side' THEN quantity_side
                ELSE 0
              END
              ELSE quantity_out
            END
        WHERE id = ${row.id}
      `;
    }
  }

  if (body.priceCents !== undefined) {
    const cents = body.priceCents;
    if (cents !== null && (!Number.isInteger(cents) || cents < 0)) {
      return NextResponse.json({ error: "Preço inválido." }, { status: 400 });
    }
    await sql`UPDATE deck_cards SET price_cents = ${cents} WHERE id = ${row.id}`;
  }

  if (body.note !== undefined) {
    await sql`UPDATE deck_cards SET note = ${body.note} WHERE id = ${row.id}`;
  }

  if (body.tags !== undefined) {
    const others = await sql<{ tags: string }[]>`
      SELECT tags FROM deck_cards WHERE deck_id = ${id} AND id <> ${row.id}
    `;
    const next = sanitizeTagList(body.tags, collectTags(others.map((item) => parseTags(item.tags))));
    if (!next) return NextResponse.json({ error: "Tag inválida." }, { status: 400 });
    await sql`UPDATE deck_cards SET tags = ${serializeTags(next)} WHERE id = ${row.id}`;
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  if (!(await ownedDeck(user.id, id))) {
    return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });
  }

  const body = (await request.json()) as {
    catalogCardId?: string;
    place?: Place;
    quantity?: number;
    all?: boolean;
  };
  const catalogCardId = body.catalogCardId;
  if (!catalogCardId) {
    return NextResponse.json({ error: "Carta obrigatória." }, { status: 400 });
  }
  if (!isPlace(body.place)) {
    return NextResponse.json({ error: "Lugar obrigatório." }, { status: 400 });
  }

  const removeAll = body.all === true;
  const quantity = Math.max(1, body.quantity ?? 1);
  const place = body.place;

  // deck_cards_quantity_present proíbe (0, 0, 0): a linha é apagada em vez de zerada.
  // FOR UPDATE serializa os DELETEs paralelos do canvas para lugares diferentes da mesma carta.
  const error = await sql.begin(async (tx) => {
    const [row] = await tx<QuantityRow[]>`
      SELECT id, quantity_main, quantity_side, quantity_out
      FROM deck_cards
      WHERE deck_id = ${id} AND catalog_card_id = ${catalogCardId}
      FOR UPDATE
    `;
    if (!row) return "Carta não está no deck.";

    const next = { main: row.quantity_main, side: row.quantity_side, out: row.quantity_out };
    if (next[place] <= 0) return "Carta não está nesse lugar.";
    next[place] = removeAll ? 0 : Math.max(next[place] - quantity, 0);

    if (next.main + next.side + next.out === 0) {
      await tx`DELETE FROM deck_cards WHERE id = ${row.id}`;
    } else {
      await tx`
        UPDATE deck_cards
        SET quantity_main = ${next.main}, quantity_side = ${next.side}, quantity_out = ${next.out}
        WHERE id = ${row.id}
      `;
    }
    return null;
  });
  if (error) return NextResponse.json({ error }, { status: 404 });

  return NextResponse.json({ ok: true });
}
