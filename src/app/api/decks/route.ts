import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isFormat } from "@/lib/formats";
import { sql } from "@/lib/db";

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const decks = await sql`
    SELECT id, name, format, created_at FROM decks
    WHERE user_id = ${user.id}
    ORDER BY created_at DESC
  `;
  return NextResponse.json({ decks });
}

export async function POST(request: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = (await request.json()) as { name?: string; format?: string };
  const name = body.name?.trim() ?? "";
  const format = body.format ?? "";
  if (!name || !isFormat(format)) {
    return NextResponse.json({ error: "Nome e formato são obrigatórios." }, { status: 400 });
  }

  const [deck] = await sql<{ id: string; name: string; format: string; created_at: string }[]>`
    INSERT INTO decks (user_id, name, format)
    VALUES (${user.id}, ${name}, ${format})
    RETURNING id, name, format, created_at
  `;
  return NextResponse.json({ deck });
}
