"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AppShell } from "@/components/app-shell";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/decks";
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Falha ao entrar.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="mx-auto max-w-sm space-y-4 border border-ink bg-surface-container-lowest p-6"
    >
      <div>
        <p className="ui-label mb-1">Auth</p>
        <h1 className="ui-headline-lg">Entrar</h1>
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
        Entrar
      </button>
      <Link href="/cadastro" className="block text-[13px] underline underline-offset-2">
        Criar conta
      </Link>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AppShell>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AppShell>
  );
}
