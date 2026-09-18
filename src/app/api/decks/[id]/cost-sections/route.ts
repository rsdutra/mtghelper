import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  MANA_COST_ORDER,
  manaCostBucket,
  manaCostKey,
  manaCostLabel,
  type ManaCostBucket,
} from "@/lib/mana-cost-groups";

type Params = { params: Promise<{ id: string }> };

/**
 * F-004 / F-008 — seções automáticas por CMC.
 * Não move cartas que já têm seção `kind=user`.
 * Desligar remove só `kind=cost`.
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
      WHERE deck_id = ${id} AND kind = 'cost'
    `;
    return NextResponse.json({ ok: true, enabled: false });
  }

  await sql`
    DELETE FROM deck_sections
    WHERE deck_id = ${id} AND kind = 'type'
  `;

  const included = await sql<{ deck_card_id: string; mana_cost: string | null }[]>`
    SELECT dc.id AS deck_card_id, c.mana_cost
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

  const needed = new Set<ManaCostBucket>();
  for (const row of included) {
    needed.add(manaCostBucket(row.mana_cost));
  }

  const existing = await sql<{ id: string; type_key: string }[]>`
    SELECT id, type_key FROM deck_sections
    WHERE deck_id = ${id} AND kind = 'cost' AND type_key IS NOT NULL
  `;
  const byKey = new Map(existing.map((row) => [row.type_key, row.id]));

  for (const bucket of MANA_COST_ORDER) {
    if (!needed.has(bucket)) continue;
    const key = manaCostKey(bucket);
    if (byKey.has(key)) continue;
    const label = manaCostLabel(bucket);
    const [created] = await sql<{ id: string }[]>`
      INSERT INTO deck_sections (deck_id, name, position, kind, type_key)
      VALUES (
        ${id},
        ${label},
        (SELECT COALESCE(MAX(position), 0) + 1 FROM deck_sections WHERE deck_id = ${id}),
        'cost',
        ${key}
      )
      ON CONFLICT (deck_id, type_key) WHERE type_key IS NOT NULL
      DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    if (created) byKey.set(key, created.id);
  }

  await sql`
    DELETE FROM deck_card_sections dcs
    USING deck_sections ds
    WHERE dcs.section_id = ds.id
      AND ds.deck_id = ${id}
      AND ds.kind = 'cost'
  `;

  for (const row of included) {
    const bucket = manaCostBucket(row.mana_cost);
    const sectionId = byKey.get(manaCostKey(bucket));
    if (!sectionId) continue;
    await sql`
      INSERT INTO deck_card_sections (deck_card_id, section_id)
      VALUES (${row.deck_card_id}, ${sectionId})
      ON CONFLICT DO NOTHING
    `;
  }

  for (const [key, sectionId] of byKey) {
    const bucket = Number(key.replace("cmc-", "")) as ManaCostBucket;
    if (needed.has(bucket)) continue;
    await sql`DELETE FROM deck_sections WHERE id = ${sectionId} AND kind = 'cost'`;
  }

  return NextResponse.json({ ok: true, enabled: true, costs: [...needed] });
}
