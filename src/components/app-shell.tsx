"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/buscar", label: "Busca" },
  { href: "/decks", label: "Decks" },
  { href: "/colecao", label: "Coleção" },
];

export function AppShell({
  children,
  fullWidth = false,
}: {
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [login, setLogin] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => setLogin(data.user?.login ?? null));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-on-surface">
      <header className="sticky top-0 z-30 h-12 border-b border-border-line bg-surface-container-lowest">
        <div className="mx-auto flex h-full max-w-[1400px] items-center gap-6 px-4 md:px-6">
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
                  className={`px-3 py-1 ${
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
            <Link href="/buscar" className="ui-btn-outline hidden sm:inline-flex">
              Importar Lista
            </Link>
            <Link href="/decks" className="ui-btn hidden sm:inline-flex">
              + Novo Deck
            </Link>
            {login ? (
              <div className="ml-1 flex items-center gap-2 border-l border-border-line pl-3">
                <span className="font-mono text-[11px] tracking-wide text-muted uppercase">{login}</span>
                <button type="button" onClick={() => void logout()} className="text-ink underline underline-offset-2">
                  Sair
                </button>
              </div>
            ) : (
              <Link href="/entrar" className="ml-1 border-l border-border-line pl-3 text-ink underline underline-offset-2">
                Entrar
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className={`mx-auto w-full flex-1 px-4 py-6 md:px-6 ${fullWidth ? "max-w-[1400px]" : "max-w-[1400px]"}`}>
        {children}
      </main>

      <footer className="mt-auto border-t border-border-line bg-surface-container-lowest">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-4 py-2 md:px-6">
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
