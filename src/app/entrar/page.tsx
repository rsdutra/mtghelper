"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { AppShell } from "@/components/app-shell";
import { loginAction, type AuthFormState } from "@/lib/auth-actions";

const initialState: AuthFormState = { error: "", login: "" };

function LoginForm() {
  const next = useSearchParams().get("next") || "/decks";
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="mx-auto max-w-sm space-y-4 border border-ink bg-surface-container-lowest p-6">
      <div>
        <p className="ui-label mb-1">Auth</p>
        <h1 className="ui-headline-lg">Entrar</h1>
      </div>
      <input type="hidden" name="next" value={next} />
      <input aria-label="Login" name="login" defaultValue={state.login} className="ui-input h-11" placeholder="Login" />
      <input aria-label="Senha" name="password" type="password" className="ui-input h-11" placeholder="Senha" />
      {state.error ? <p className="text-[13px] text-error">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="ui-btn h-10 w-full disabled:opacity-50">
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
