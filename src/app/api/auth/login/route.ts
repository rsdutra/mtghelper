import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(request: Request) {
  const body = (await request.json()) as { login?: string; password?: string };
  const login = body.login?.trim() ?? "";
  const password = body.password ?? "";

  const [user] = await sql<{ id: string; login: string; password_hash: string }[]>`
    SELECT id, login, password_hash FROM users WHERE lower(login) = lower(${login})
  `;
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return NextResponse.json({ error: "Login ou senha inválidos." }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, login: user.login } });
}
