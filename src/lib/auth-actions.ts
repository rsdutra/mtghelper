"use server";

// F-003: precisam ser Server Actions — gravar/apagar o cookie aqui invalida o Client Cache do
// roteador, que guarda prefetches de páginas protegidas feitos com outra sessão.
import { redirect } from "next/navigation";
import { clearSession, loginUser, registerUser } from "@/lib/auth";

export type AuthFormState = { error: string; login: string };

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Só caminhos internos: `?next=` não pode levar para outro site. */
function safeNext(next: string) {
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/decks";
}

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const login = field(formData, "login");
  const result = await registerUser(login, field(formData, "password"));
  if ("error" in result) return { error: result.error, login };
  redirect("/decks");
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const login = field(formData, "login");
  const result = await loginUser(login, field(formData, "password"));
  if ("error" in result) return { error: result.error, login };
  redirect(safeNext(field(formData, "next")));
}

export async function logoutAction() {
  await clearSession();
  redirect("/");
}
