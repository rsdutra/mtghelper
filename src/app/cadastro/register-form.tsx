"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";

export function RegisterForm() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Falha ao cadastrar.");
      return;
    }
    router.push("/decks");
    router.refresh();
  }

  return (
    <AppShell>
      <form
        onSubmit={(event) => void submit(event)}
        className="mx-auto max-w-sm space-y-4 border border-ink bg-surface-container-lowest p-6"
      >
        <div>
          <p className="ui-label mb-1">Auth</p>
          <h1 className="ui-headline-lg">Criar conta</h1>
          <p className="mt-1 text-[13px] text-secondary">Sem confirmação de e-mail nesta versão.</p>
        </div>
        <input
          aria-label="Login"
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          className="ui-input h-11"
          placeholder="Login"
        />
        <input
          aria-label="Senha"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="ui-input h-11"
          placeholder="Senha"
        />
        {error ? <p className="text-[13px] text-error">{error}</p> : null}
        <button type="submit" className="ui-btn h-10 w-full">
          Cadastrar
        </button>
        <Link href="/entrar" className="block text-[13px] underline underline-offset-2">
          Já tenho conta
        </Link>
      </form>
    </AppShell>
  );
}
