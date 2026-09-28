import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/lib/auth";

export default async function Home() {
  const user = await getSessionUser();

  return (
    <AppShell>
      <section className="max-w-xl space-y-5 border border-ink bg-surface-container-lowest p-8">
        <p className="ui-label">Magic: The Gathering</p>
        <h1 className="ui-headline">Coleção, decks e upgrades no mesmo quadro.</h1>
        <p className="text-[14px] leading-5 text-secondary">
          Busque cartas em português ou inglês, monte decks e registre o que você tem.
        </p>
        <div className="flex gap-2 pt-2">
          <Link href="/buscar" className="ui-btn h-9 px-4">
            Buscar carta
          </Link>
          {user ? null : (
            <Link href="/cadastro" className="ui-btn-outline h-9 px-4">
              Criar conta
            </Link>
          )}
        </div>
      </section>
    </AppShell>
  );
}
