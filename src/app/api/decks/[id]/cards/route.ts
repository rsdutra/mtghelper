import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { resolveCardName } from "@/lib/cards";
import { sql } from "@/lib/db";
import { parseCardList } from "@/lib/lists";

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
    sectionId?: string;
    set?: string;
    included?: boolean;
  };
  const lines = parseCardList(body.text ?? "");
  const missing = [];
  let added = 0;
  // Na seção: default em trabalho; no deck: included
  const included = body.included ?? !body.sectionId;

  for (const line of lines) {
    const card = await resolveCardName(line.name, body.set || null);
    if (!card) {
      missing.push(line);
      continue;
    }

    const [row] = await sql<{ id: string }[]>`
      INSERT INTO deck_cards (deck_id, catalog_card_id, quantity, included)
      VALUES (${id}, ${card.id}, ${line.quantity}, ${included})
      ON CONFLICT (deck_id, catalog_card_id)
      DO UPDATE SET
        quantity = deck_cards.quantity + EXCLUDED.quantity,
        included = CASE
          WHEN ${included} THEN true
          ELSE deck_cards.included
        END
      RETURNING id
    `;

    if (body.sectionId) {
      const [owned] = await sql<{ id: string }[]>`
        SELECT id FROM deck_sections WHERE id = ${body.sectionId} AND deck_id = ${id}
      `;
      if (owned) {
        await sql`
          INSERT INTO deck_card_sections (deck_card_id, section_id)
          VALUES (${row.id}, ${body.sectionId})
          ON CONFLICT DO NOTHING
        `;
      }
    }
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
    included?: boolean;
    sectionIds?: string[] | null;
    setSectionId?: string | null;
    priceCents?: number | null;
    note?: string | null;
  };
  const catalogCardId = body.catalogCardId;
  if (!catalogCardId) {
    return NextResponse.json({ error: "Carta obrigatória." }, { status: 400 });
  }

  const [row] = await sql<{ id: string }[]>`
    SELECT id FROM deck_cards WHERE deck_id = ${id} AND catalog_card_id = ${catalogCardId}
  `;
  if (!row) return NextResponse.json({ error: "Carta não está no deck." }, { status: 404 });

  if (typeof body.included === "boolean") {
    await sql`UPDATE deck_cards SET included = ${body.included} WHERE id = ${row.id}`;
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

  // Só sincroniza tags `kind=user`; preserva type/cost e não altera `included`.
  if (body.sectionIds) {
    await sql`
      DELETE FROM deck_card_sections dcs
      USING deck_sections ds
      WHERE dcs.deck_card_id = ${row.id}
        AND dcs.section_id = ds.id
        AND ds.deck_id = ${id}
        AND ds.kind = 'user'
    `;
    for (const sectionId of body.sectionIds) {
      const [owned] = await sql<{ id: string }[]>`
        SELECT id FROM deck_sections
        WHERE id = ${sectionId} AND deck_id = ${id} AND kind = 'user'
      `;
      if (owned) {
        await sql`
          INSERT INTO deck_card_sections (deck_card_id, section_id)
          VALUES (${row.id}, ${sectionId})
          ON CONFLICT DO NOTHING
        `;
      }
    }
  } else if (body.setSectionId !== undefined) {
    await sql`
      DELETE FROM deck_card_sections dcs
      USING deck_sections ds
      WHERE dcs.deck_card_id = ${row.id}
        AND dcs.section_id = ds.id
        AND ds.deck_id = ${id}
        AND ds.kind = 'user'
    `;
    if (body.setSectionId) {
      const sectionId = body.setSectionId;
      const [owned] = await sql<{ id: string }[]>`
        SELECT id FROM deck_sections
        WHERE id = ${sectionId} AND deck_id = ${id} AND kind = 'user'
      `;
      if (owned) {
        await sql`
          INSERT INTO deck_card_sections (deck_card_id, section_id)
          VALUES (${row.id}, ${sectionId})
          ON CONFLICT DO NOTHING
        `;
      }
    }
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
