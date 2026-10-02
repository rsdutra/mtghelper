import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";

const COOKIE = "mtg_session";

type SessionUser = { id: string; login: string };
export type AuthResult = { user: SessionUser } | { error: string; status: number };

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET não está definida.");
  return new TextEncoder().encode(value);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSessionUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const [user] = await sql<{ id: string; login: string }[]>`
      SELECT id, login FROM users WHERE id = ${payload.sub}
    `;
    return user ?? null;
  } catch {
    return null;
  }
}

/** Cria o usuário, a coleção padrão e a sessão (US-003-01). */
export async function registerUser(loginInput: string, password: string): Promise<AuthResult> {
  const login = loginInput.trim();
  if (login.length < 3 || password.length < 4) {
    return { error: "Login com pelo menos 3 caracteres e senha com 4.", status: 400 };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let user: SessionUser;
  try {
    [user] = await sql<SessionUser[]>`
      INSERT INTO users (login, password_hash)
      VALUES (${login}, ${passwordHash})
      RETURNING id, login
    `;
  } catch {
    return { error: "Esse login já existe.", status: 409 };
  }
  await sql`
    INSERT INTO collections (user_id, name)
    VALUES (${user.id}, ${"Minha coleção"})
  `;
  await createSession(user.id);
  return { user };
}

/** Confere a senha e abre a sessão (US-003-02). */
export async function loginUser(loginInput: string, password: string): Promise<AuthResult> {
  const [user] = await sql<(SessionUser & { password_hash: string })[]>`
    SELECT id, login, password_hash FROM users WHERE lower(login) = lower(${loginInput.trim()})
  `;
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return { error: "Login ou senha inválidos.", status: 401 };
  }
  await createSession(user.id);
  return { user: { id: user.id, login: user.login } };
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Não autenticado.");
  }
  return user;
}
