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

  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim() ?? "";
  if (!name) return NextResponse.json({ error: "Nome da seção é obrigatório." }, { status: 400 });

  const [section] = await sql`
    INSERT INTO deck_sections (deck_id, name, position, kind)
    VALUES (
      ${id},
      ${name},
      (SELECT COALESCE(MAX(position), 0) + 1 FROM deck_sections WHERE deck_id = ${id}),
      'user'
    )
    RETURNING id, name, position, kind, type_key
  `;
  return NextResponse.json({ section });
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const [deck] = await sql<{ id: string }[]>`
    SELECT id FROM decks WHERE id = ${id} AND user_id = ${user.id}
  `;
  if (!deck) return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });

  const body = (await request.json()) as { sectionId?: string };
  const sectionId = body.sectionId;
  if (!sectionId) return NextResponse.json({ error: "Seção obrigatória." }, { status: 400 });

  const [section] = await sql<{ id: string; kind: string }[]>`
    SELECT id, kind FROM deck_sections WHERE id = ${sectionId} AND deck_id = ${id}
  `;
  if (!section) return NextResponse.json({ error: "Seção não encontrada." }, { status: 404 });
  if (section.kind === "sideboard") {
    return NextResponse.json({ error: "O sideboard deste formato não pode ser excluído." }, { status: 400 });
  }
  if (section.kind === "type" || section.kind === "cost") {
    return NextResponse.json(
      { error: "Seções automáticas (tipo/custo) são gerenciadas pelos toggles de agrupamento." },
      { status: 400 },
    );
  }

  // CASCADE em deck_card_sections; cartas em deck_cards permanecem.
  await sql`DELETE FROM deck_sections WHERE id = ${sectionId}`;
  return NextResponse.json({ ok: true });
}
