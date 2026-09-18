import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

async function ownedDeck(userId: string, deckId: string) {
  const [deck] = await sql<{ id: string }[]>`
    SELECT id FROM decks WHERE id = ${deckId} AND user_id = ${userId}
  `;
  return deck ?? null;
}

export async function GET(_request: Request, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  if (!(await ownedDeck(user.id, id))) {
    return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });
  }

  const [row] = await sql<{ snapshot: unknown; updated_at: string }[]>`
    SELECT snapshot, updated_at FROM deck_canvas WHERE deck_id = ${id}
  `;
  return NextResponse.json({
    snapshot: row?.snapshot ?? null,
    updatedAt: row?.updated_at ?? null,
  });
}

export async function PUT(request: Request, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  if (!(await ownedDeck(user.id, id))) {
    return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });
  }

  let body: { snapshot?: unknown } = {};
  try {
    body = (await request.json()) as { snapshot?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body.snapshot || typeof body.snapshot !== "object") {
    return NextResponse.json({ error: "Snapshot obrigatório." }, { status: 400 });
  }

  try {
    const [row] = await sql<{ updated_at: string }[]>`
      INSERT INTO deck_canvas (deck_id, snapshot, updated_at)
      VALUES (${id}, ${sql.json(body.snapshot as Parameters<typeof sql.json>[0])}, now())
      ON CONFLICT (deck_id) DO UPDATE SET
        snapshot = EXCLUDED.snapshot,
        updated_at = now()
      RETURNING updated_at
    `;

    if (!row) {
      return NextResponse.json({ error: "Falha ao gravar snapshot." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, updatedAt: row.updated_at });
  } catch (error) {
    console.error("deck canvas save", error);
    return NextResponse.json({ error: "Erro ao salvar canvas." }, { status: 500 });
  }
}
