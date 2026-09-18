import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(request: Request) {
  const body = (await request.json()) as { login?: string; password?: string };
  const login = body.login?.trim() ?? "";
  const password = body.password ?? "";

  if (login.length < 3 || password.length < 4) {
    return NextResponse.json(
      { error: "Login com pelo menos 3 caracteres e senha com 4." },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const [user] = await sql<{ id: string; login: string }[]>`
      INSERT INTO users (login, password_hash)
      VALUES (${login}, ${passwordHash})
      RETURNING id, login
    `;
    await sql`
      INSERT INTO collections (user_id, name)
      VALUES (${user.id}, ${"Minha coleção"})
    `;
    await createSession(user.id);
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Esse login já existe." }, { status: 409 });
  }
}
