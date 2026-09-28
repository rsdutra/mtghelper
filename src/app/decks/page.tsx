"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { FORMATS } from "@/lib/formats";

type Deck = { id: string; name: string; format: string };

export default function DecksPage() {
  const router = useRouter();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [name, setName] = useState("");
  const [format, setFormat] = useState("commander");
  const [status, setStatus] = useState("");

  async function load() {
    const response = await fetch("/api/decks");
    if (response.status === 401) {
      router.push("/entrar");
      return;
    }
    const data = await response.json();
    setDecks(data.decks ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createDeck(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, format }),
    });
    const data = await response.json();
    if (response.ok) router.push(`/decks/${data.deck.id}/edit`);
  }

  async function deleteDeck(deck: Deck) {
    if (!window.confirm(`Excluir o deck “${deck.name}”? Cartas, tags e canvas serão removidos.`)) {
      return;
    }
    const response = await fetch(`/api/decks/${deck.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(typeof data.error === "string" ? data.error : "Não foi possível excluir o deck.");
      return;
    }
    setStatus("Deck excluído.");
    await load();
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="ui-label mb-1">Archive / Deck Manager</p>
          <h1 className="ui-headline">Gerenciamento de Decks</h1>
        </div>
        <p className="font-mono text-[10px] tracking-[0.04em] text-muted uppercase">
          TOTAL: {decks.length} · ● SYNC LOCAL
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <form onSubmit={(event) => void createDeck(event)} className="space-y-3 border border-ink bg-surface-container-lowest p-4">
          <div className="flex items-center justify-between">
            <h2 className="ui-label text-ink">+ Novo Deck</h2>
          </div>
          <div className="space-y-1">
            <label className="ui-label" htmlFor="deck-name">
              Nome do Deck
            </label>
            <input
              id="deck-name"
              aria-label="Nome do deck"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome"
              className="ui-input"
            />
          </div>
          <div className="space-y-1">
            <label className="ui-label" htmlFor="deck-format">
              Formato
            </label>
            <select
              id="deck-format"
              aria-label="Formato"
              value={format}
              onChange={(event) => setFormat(event.target.value)}
              className="ui-input"
            >
              {FORMATS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="ui-btn h-9 w-full">
            ⊕ Criar Deck
          </button>
          {status ? <p className="text-[12px] text-muted">{status}</p> : null}
        </form>

        <div className="border border-ink bg-surface-container-lowest">
          <div className="flex items-center justify-between border-b border-border-line px-3 py-2">
            <p className="ui-label text-ink">{decks.length} Decks Cadastrados</p>
          </div>
          <ul>
            {decks.map((deck) => (
              <li key={deck.id} className="ui-row justify-between gap-3">
                <Link href={`/decks/${deck.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate text-[13px] font-medium text-ink">{deck.name}</span>
                </Link>
                <span className="ui-badge">{deck.format}</span>
                <Link href={`/decks/${deck.id}`} className="ui-btn-outline h-7 px-2 text-[11px]">
                  Editar
                </Link>
                <button
                  type="button"
                  className="ui-btn-outline h-7 px-2 text-[11px] hover:border-danger hover:text-danger"
                  onClick={() => void deleteDeck(deck)}
                >
                  Excluir
                </button>
              </li>
            ))}
            {decks.length === 0 ? (
              <li className="px-3 py-8 text-[13px] text-muted">Nenhum deck ainda.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
