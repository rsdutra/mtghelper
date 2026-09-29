import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  collectTags,
  isTagColor,
  isTagName,
  parseTags,
  removeTag,
  renameTag,
  sameTag,
  serializeTags,
  type CardTag,
} from "@/lib/tags";

/** F-013 / US-013-04 — renomear ou excluir uma tag em todas as cartas do deck. */
type Params = { params: Promise<{ id: string }> };

type TaggedRow = { id: string; tags: CardTag[] };

async function deckRows(userId: string, deckId: string): Promise<TaggedRow[] | null> {
  const [deck] = await sql<{ id: string }[]>`
    SELECT id FROM decks WHERE id = ${deckId} AND user_id = ${userId}
  `;
  if (!deck) return null;
  const rows = await sql<{ id: string; tags: string }[]>`
    SELECT id, tags FROM deck_cards WHERE deck_id = ${deckId}
  `;
  return rows.map((row) => ({ id: row.id, tags: parseTags(row.tags) }));
}

async function writeTags(rows: TaggedRow[], change: (tags: CardTag[]) => CardTag[]) {
  const changed = rows
    .map((row) => ({ id: row.id, before: serializeTags(row.tags), after: serializeTags(change(row.tags)) }))
    .filter((row) => row.before !== row.after);
  if (changed.length === 0) return;
  await sql.begin(async (tx) => {
    for (const row of changed) {
      await tx`UPDATE deck_cards SET tags = ${row.after} WHERE id = ${row.id}`;
    }
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const rows = await deckRows(user.id, id);
  if (!rows) return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });

  const body = (await request.json()) as { name?: unknown; newName?: unknown; color?: unknown };
  const name = String(body.name ?? "").trim();
  const newName = String(body.newName ?? "").trim();
  const color = String(body.color ?? "").trim().toLowerCase();
  const known = collectTags(rows.map((row) => row.tags));
  if (!known.some((tag) => sameTag(tag.name, name))) {
    return NextResponse.json({ error: "Tag não encontrada." }, { status: 404 });
  }
  if (!isTagName(newName) || !isTagColor(color)) {
    return NextResponse.json({ error: "Use um nome de até 32 caracteres, sem vírgula, e uma cor válida." }, { status: 400 });
  }
  if (known.some((tag) => !sameTag(tag.name, name) && sameTag(tag.name, newName))) {
    return NextResponse.json({ error: "Já existe uma tag com esse nome." }, { status: 409 });
  }

  await writeTags(rows, (tags) => renameTag(tags, name, { name: newName, color }));
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const rows = await deckRows(user.id, id);
  if (!rows) return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });

  const body = (await request.json()) as { name?: unknown };
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Tag obrigatória." }, { status: 400 });

  await writeTags(rows, (tags) => removeTag(tags, name));
  return NextResponse.json({ ok: true });
}
