import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** Marca tag de seção; não altera `included` salvo se `excludeFromDeck: true`. */
export async function POST(request: Request, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const [deck] = await sql<{ id: string }[]>`
    SELECT id FROM decks WHERE id = ${id} AND user_id = ${user.id}
  `;
  if (!deck) return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });

  const body = (await request.json()) as {
    catalogCardId?: string;
    sectionId?: string;
    quantity?: number;
    excludeFromDeck?: boolean;
  };
  const catalogCardId = body.catalogCardId;
  const sectionId = body.sectionId;
  if (!catalogCardId || !sectionId) {
    return NextResponse.json({ error: "Carta e seção são obrigatórios." }, { status: 400 });
  }

  const [ownedSection] = await sql<{ id: string }[]>`
    SELECT id FROM deck_sections WHERE id = ${sectionId} AND deck_id = ${id}
  `;
  if (!ownedSection) return NextResponse.json({ error: "Seção não encontrada." }, { status: 404 });

  const [row] = await sql<{ id: string; quantity: number }[]>`
    SELECT id, quantity FROM deck_cards
    WHERE deck_id = ${id} AND catalog_card_id = ${catalogCardId}
  `;
  if (!row) return NextResponse.json({ error: "Carta não está no workspace do deck." }, { status: 404 });

  if (body.excludeFromDeck === true) {
    await sql`UPDATE deck_cards SET included = false WHERE id = ${row.id}`;
  }

  await sql`
    INSERT INTO deck_card_sections (deck_card_id, section_id)
    VALUES (${row.id}, ${sectionId})
    ON CONFLICT DO NOTHING
  `;

  return NextResponse.json({ ok: true });
}
