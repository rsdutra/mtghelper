"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/lib/auth-actions";

const links = [
  { href: "/buscar", label: "Busca" },
  { href: "/decks", label: "Decks" },
  { href: "/colecao", label: "Coleção" },
];

export function AppShell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  /** Container de até 1720 px (telas de deck, F-011 / US-011-01). */
  wide?: boolean;
}) {
  const container = wide ? "max-w-[1720px]" : "max-w-[1400px]";
  const pathname = usePathname();
  const [login, setLogin] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => setLogin(data.user?.login ?? null));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-on-surface">
      <header className="ui-on-dark sticky top-0 z-30 h-12 border-b border-band-line bg-band">
        <div className={`mx-auto flex h-full items-center gap-3 px-4 sm:gap-6 md:px-6 ${container}`}>
          <Link
            href="/"
            className="shrink-0 font-semibold tracking-tight text-ink uppercase"
            style={{ fontSize: 13, letterSpacing: "-0.02em" }}
          >
            ARCHIVIST // MTG
          </Link>
          <nav className="flex items-center gap-1 text-[13px]">
            {links.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-2 py-1 sm:px-3 ${
                    active
                      ? "font-semibold text-ink underline decoration-2 underline-offset-8"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-[12px]">
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/buscar" className="ui-btn-outline">
                Importar Lista
              </Link>
              <Link href="/decks" className="ui-btn">
                + Novo Deck
              </Link>
            </div>
            {login ? (
              <div className="ml-1 flex items-center gap-2 border-l border-border-line pl-3">
                <span className="hidden font-mono text-[11px] tracking-wide text-muted uppercase sm:inline">{login}</span>
                <form action={logoutAction} onSubmit={() => setLogin(null)}>
                  <button type="submit" className="text-ink underline underline-offset-2">
                    Sair
                  </button>
                </form>
              </div>
            ) : (
              <Link href="/entrar" className="ml-1 border-l border-border-line pl-3 text-ink underline underline-offset-2">
                Entrar
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className={`mx-auto w-full flex-1 px-4 py-6 md:px-6 ${container}`}>
        {children}
      </main>

      <footer className="mt-auto border-t border-outline-variant bg-nav">
        <div className={`mx-auto flex flex-wrap items-center justify-between gap-2 px-4 py-2 md:px-6 ${container}`}>
          <p className="font-mono text-[10px] tracking-[0.04em] text-muted uppercase">
            ARCHIVIST // MTG · INDEXADOR DE ALTA FREQUÊNCIA
          </p>
          <p className="font-mono text-[10px] tracking-[0.04em] text-muted uppercase">
            STATUS: OPERACIONAL · HOTKEY: ⌘K
          </p>
        </div>
      </footer>
    </div>
  );
}
