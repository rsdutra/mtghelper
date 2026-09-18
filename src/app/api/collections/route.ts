import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const collections = await sql`
    SELECT c.id, c.name, c.created_at, COALESCE(SUM(ci.quantity), 0) AS cards
    FROM collections c
    LEFT JOIN collection_items ci ON ci.collection_id = c.id
    WHERE c.user_id = ${user.id}
    GROUP BY c.id
    ORDER BY c.created_at
  `;
  return NextResponse.json({ collections });
}

export async function POST(request: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim() ?? "";
  if (!name) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  const [collection] = await sql`
    INSERT INTO collections (user_id, name) VALUES (${user.id}, ${name})
    RETURNING id, name, created_at
  `;
  return NextResponse.json({ collection });
}
