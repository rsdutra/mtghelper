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

async function ownedDeck(userId: string, deckId: string) {
  const [deck] = await sql<{ id: string }[]>`
    SELECT id FROM decks WHERE id = ${deckId} AND user_id = ${userId}
  `;
  return deck ?? null;
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
  if (place === "side") {
    const [deck] = await sql<{ format: string }[]>`SELECT format FROM decks WHERE id = ${id}`;
    if (!deck || sideboardLimit(deck.format) == null) {
      return NextResponse.json({ error: "Este formato não tem sideboard." }, { status: 400 });
    }
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

    await sql`
      INSERT INTO deck_cards (deck_id, catalog_card_id, quantity, place)
      VALUES (${id}, ${card.id}, ${line.quantity}, ${place})
      ON CONFLICT (deck_id, catalog_card_id)
      DO UPDATE SET
        quantity = deck_cards.quantity + EXCLUDED.quantity,
        place = EXCLUDED.place
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
    place?: Place;
    priceCents?: number | null;
    note?: string | null;
    tags?: unknown;
  };
  const catalogCardId = body.catalogCardId;
  if (!catalogCardId) {
    return NextResponse.json({ error: "Carta obrigatória." }, { status: 400 });
  }

  const [row] = await sql<{ id: string }[]>`
    SELECT id FROM deck_cards WHERE deck_id = ${id} AND catalog_card_id = ${catalogCardId}
  `;
  if (!row) return NextResponse.json({ error: "Carta não está no deck." }, { status: 404 });

  if (isPlace(body.place)) {
    if (body.place === "side") {
      const [deck] = await sql<{ format: string }[]>`SELECT format FROM decks WHERE id = ${id}`;
      if (!deck || sideboardLimit(deck.format) == null) {
        return NextResponse.json({ error: "Este formato não tem sideboard." }, { status: 400 });
      }
    }
    await sql`
      UPDATE deck_cards
      SET place = ${body.place}
      WHERE id = ${row.id}
    `;
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
    quantity?: number;
    all?: boolean;
  };
  const catalogCardId = body.catalogCardId;
  if (!catalogCardId) {
    return NextResponse.json({ error: "Carta obrigatória." }, { status: 400 });
  }

  const removeAll = body.all === true;
  const quantity = Math.max(1, body.quantity ?? 1);

  if (removeAll) {
    await sql`
      DELETE FROM deck_cards
      WHERE deck_id = ${id} AND catalog_card_id = ${catalogCardId}
    `;
  } else {
    const [row] = await sql<{ quantity: number }[]>`
      SELECT quantity FROM deck_cards
      WHERE deck_id = ${id} AND catalog_card_id = ${catalogCardId}
    `;
    if (!row) return NextResponse.json({ error: "Carta não está no deck." }, { status: 404 });
    if (row.quantity <= quantity) {
      await sql`
        DELETE FROM deck_cards
        WHERE deck_id = ${id} AND catalog_card_id = ${catalogCardId}
      `;
    } else {
      await sql`
        UPDATE deck_cards SET quantity = quantity - ${quantity}
        WHERE deck_id = ${id} AND catalog_card_id = ${catalogCardId}
      `;
    }
  }

  return NextResponse.json({ ok: true });
}
