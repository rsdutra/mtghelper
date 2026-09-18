"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";

type Collection = { id: string; name: string; cards: number };

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    const response = await fetch("/api/collections");
    const data = await response.json();
    setCollections(data.collections ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createCollection(event: React.FormEvent) {
    event.preventDefault();
    await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    setStatus("");
    await load();
  }

  async function deleteCollection(collection: Collection) {
    if (collections.length <= 1) {
      setStatus("Não é possível apagar a última coleção.");
      return;
    }
    const label =
      collection.cards > 0
        ? `Excluir “${collection.name}” e suas ${collection.cards} carta(s)?`
        : `Excluir “${collection.name}”?`;
    if (!window.confirm(label)) return;

    const response = await fetch(`/api/collections/${collection.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(typeof data.error === "string" ? data.error : "Não foi possível excluir.");
      return;
    }
    setStatus("Coleção excluída.");
    await load();
  }

  const totalCards = collections.reduce((n, c) => n + c.cards, 0);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="ui-label mb-1">Archive / Collection</p>
          <h1 className="ui-headline">Gerenciamento de Acervo</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="border border-border-line px-3 py-2">
            <p className="ui-label">Coleções</p>
            <p className="font-mono text-[13px] font-semibold">{collections.length}</p>
          </div>
          <div className="border border-border-line px-3 py-2">
            <p className="ui-label">Total de Cartas</p>
            <p className="font-mono text-[13px] font-semibold">{totalCards}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <form
          onSubmit={(event) => void createCollection(event)}
          className="space-y-3 border border-ink bg-surface-container-lowest p-4"
        >
          <h2 className="ui-label text-ink">+ Nova Coleção</h2>
          <input
            aria-label="Nome da coleção"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="ui-input"
            placeholder="Nome"
          />
          <button type="submit" className="ui-btn h-9 w-full">
            Criar
          </button>
          {status ? <p className="text-[12px] text-muted">{status}</p> : null}
        </form>

        <div className="border border-ink bg-surface-container-lowest">
          <div className="flex items-center justify-between border-b border-border-line px-3 py-2">
            <p className="ui-label text-ink">Acervo</p>
          </div>
          <ul>
            {collections.map((collection) => (
              <li key={collection.id} className="ui-row justify-between gap-3">
                <Link href={`/colecao/${collection.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate text-[13px] font-medium text-ink">{collection.name}</span>
                </Link>
                <span className="font-mono text-[12px] text-muted">{collection.cards} cartas</span>
                <button
                  type="button"
                  className="ui-btn-outline h-7 px-2 text-[11px] hover:border-danger hover:text-danger disabled:opacity-40"
                  disabled={collections.length <= 1}
                  title={collections.length <= 1 ? "Não é possível apagar a última coleção" : "Excluir coleção"}
                  onClick={() => void deleteCollection(collection)}
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
