import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  cardTypeGroup,
  cardTypeLabel,
  cardTypeOrder,
  type CardTypeGroup,
} from "@/lib/card-types";
import { sql } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/**
 * F-004 / F-008 — ativa ou desativa seções automáticas por tipo.
 * Não atribui tag a cartas que já têm seção `kind=user`.
 * Desligar remove só `kind=type`; cartas permanecem.
 */
export async function POST(request: Request, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const [deck] = await sql<{ id: string }[]>`
    SELECT id FROM decks WHERE id = ${id} AND user_id = ${user.id}
  `;
  if (!deck) return NextResponse.json({ error: "Deck não encontrado." }, { status: 404 });

  const body = (await request.json()) as { enabled?: boolean };
  const enabled = Boolean(body.enabled);

  if (!enabled) {
    await sql`
      DELETE FROM deck_sections
      WHERE deck_id = ${id} AND kind = 'type'
    `;
    return NextResponse.json({ ok: true, enabled: false });
  }

  // Com tipo ligado, remove seções de custo (modos mutuamente exclusivos no canvas).
  await sql`
    DELETE FROM deck_sections
    WHERE deck_id = ${id} AND kind = 'cost'
  `;

  const included = await sql<{ deck_card_id: string; type_line: string | null }[]>`
    SELECT dc.id AS deck_card_id, c.type_line
    FROM deck_cards dc
    JOIN catalog_cards c ON c.id = dc.catalog_card_id
    WHERE dc.deck_id = ${id} AND dc.included = true
      AND NOT EXISTS (
        SELECT 1
        FROM deck_card_sections dcs
        JOIN deck_sections ds ON ds.id = dcs.section_id
        WHERE dcs.deck_card_id = dc.id AND ds.kind = 'user'
      )
  `;

  const needed = new Set<CardTypeGroup>();
  for (const row of included) {
    needed.add(cardTypeGroup(row.type_line));
  }

  const existing = await sql<{ id: string; type_key: string }[]>`
    SELECT id, type_key FROM deck_sections
    WHERE deck_id = ${id} AND kind = 'type' AND type_key IS NOT NULL
  `;
  const byKey = new Map(existing.map((row) => [row.type_key, row.id]));

  for (const group of cardTypeOrder()) {
    if (!needed.has(group)) continue;
    if (byKey.has(group)) continue;
    const label = cardTypeLabel(group);
    const [created] = await sql<{ id: string }[]>`
      INSERT INTO deck_sections (deck_id, name, position, kind, type_key)
      VALUES (
        ${id},
        ${label},
        (SELECT COALESCE(MAX(position), 0) + 1 FROM deck_sections WHERE deck_id = ${id}),
        'type',
        ${group}
      )
      ON CONFLICT (deck_id, type_key) WHERE type_key IS NOT NULL
      DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    if (created) byKey.set(group, created.id);
  }

  await sql`
    DELETE FROM deck_card_sections dcs
    USING deck_sections ds
    WHERE dcs.section_id = ds.id
      AND ds.deck_id = ${id}
      AND ds.kind = 'type'
  `;

  for (const row of included) {
    const group = cardTypeGroup(row.type_line);
    const sectionId = byKey.get(group);
    if (!sectionId) continue;
    await sql`
      INSERT INTO deck_card_sections (deck_card_id, section_id)
      VALUES (${row.deck_card_id}, ${sectionId})
      ON CONFLICT DO NOTHING
    `;
  }

  for (const [key, sectionId] of byKey) {
    if (needed.has(key as CardTypeGroup)) continue;
    await sql`DELETE FROM deck_sections WHERE id = ${sectionId} AND kind = 'type'`;
  }

  return NextResponse.json({ ok: true, enabled: true, types: [...needed] });
}
