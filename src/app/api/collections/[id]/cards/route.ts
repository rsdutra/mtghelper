import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { latestPrinting, resolveCardName } from "@/lib/cards";
import { sql } from "@/lib/db";
import { parseCardList } from "@/lib/lists";
import { collectTags, parseTags, sanitizeTagList, serializeTags } from "@/lib/tags";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const [collection] = await sql<{ id: string }[]>`
    SELECT id FROM collections WHERE id = ${id} AND user_id = ${user.id}
  `;
  if (!collection) return NextResponse.json({ error: "Coleção não encontrada." }, { status: 404 });

  const body = (await request.json()) as { text?: string; set?: string };
  const lines = parseCardList(body.text ?? "");
  const missing = [];
  let added = 0;

  for (const line of lines) {
    let card = await resolveCardName(line.name, body.set || null);
    if (card && !body.set && card.oracle_id) {
      card = (await latestPrinting(card.oracle_id)) ?? card;
    }
    if (!card) {
      missing.push(line);
      continue;
    }
    await sql`
      INSERT INTO collection_items (collection_id, catalog_card_id, quantity)
      VALUES (${id}, ${card.id}, ${line.quantity})
      ON CONFLICT (collection_id, catalog_card_id)
      DO UPDATE SET quantity = collection_items.quantity + EXCLUDED.quantity
    `;
    added += 1;
  }

  return NextResponse.json({ added, missing });
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const [collection] = await sql<{ id: string }[]>`
    SELECT id FROM collections WHERE id = ${id} AND user_id = ${user.id}
  `;
  if (!collection) return NextResponse.json({ error: "Coleção não encontrada." }, { status: 404 });

  const body = (await request.json()) as {
    catalogCardId?: string;
    priceCents?: number | null;
    note?: string | null;
    tags?: unknown;
  };
  const catalogCardId = body.catalogCardId;
  if (!catalogCardId) {
    return NextResponse.json({ error: "Carta obrigatória." }, { status: 400 });
  }

  const [row] = await sql<{ id: string }[]>`
    SELECT id FROM collection_items
    WHERE collection_id = ${id} AND catalog_card_id = ${catalogCardId}
  `;
  if (!row) return NextResponse.json({ error: "Carta não está na coleção." }, { status: 404 });

  if (body.priceCents !== undefined) {
    const cents = body.priceCents;
    if (cents !== null && (!Number.isInteger(cents) || cents < 0)) {
      return NextResponse.json({ error: "Preço inválido." }, { status: 400 });
    }
    await sql`UPDATE collection_items SET price_cents = ${cents} WHERE id = ${row.id}`;
  }

  if (body.note !== undefined) {
    await sql`UPDATE collection_items SET note = ${body.note} WHERE id = ${row.id}`;
  }

  if (body.tags !== undefined) {
    const others = await sql<{ tags: string }[]>`
      SELECT tags FROM collection_items WHERE collection_id = ${id} AND id <> ${row.id}
    `;
    const next = sanitizeTagList(body.tags, collectTags(others.map((item) => parseTags(item.tags))));
    if (!next) return NextResponse.json({ error: "Tag inválida." }, { status: 400 });
    await sql`UPDATE collection_items SET tags = ${serializeTags(next)} WHERE id = ${row.id}`;
  }

  return NextResponse.json({ ok: true });
}
