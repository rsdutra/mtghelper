"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AppShell } from "@/components/app-shell";
import { registerAction, type AuthFormState } from "@/lib/auth-actions";

const initialState: AuthFormState = { error: "", login: "" };

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <AppShell>
      <form action={formAction} className="mx-auto max-w-sm space-y-4 border border-ink bg-surface-container-lowest p-6">
        <div>
          <p className="ui-label mb-1">Auth</p>
          <h1 className="ui-headline-lg">Criar conta</h1>
          <p className="mt-1 text-[13px] text-secondary">Sem confirmação de e-mail nesta versão.</p>
        </div>
        <input aria-label="Login" name="login" defaultValue={state.login} className="ui-input h-11" placeholder="Login" />
        <input aria-label="Senha" name="password" type="password" className="ui-input h-11" placeholder="Senha" />
        {state.error ? <p className="text-[13px] text-error">{state.error}</p> : null}
        <button type="submit" disabled={pending} className="ui-btn h-10 w-full disabled:opacity-50">
          Cadastrar
        </button>
        <Link href="/entrar" className="block text-[13px] underline underline-offset-2">
          Já tenho conta
        </Link>
      </form>
    </AppShell>
  );
}
