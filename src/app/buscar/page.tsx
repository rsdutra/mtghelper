"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CardSearch, type Suggestion } from "@/components/card-search";
import { ListImport } from "@/components/list-import";

type Hit = {
  quantity: number;
  card: {
    id: string;
    name_en: string;
    name_pt: string | null;
    set_code: string;
    image_normal: string | null;
  };
};

export default function SearchPage() {
  const [picked, setPicked] = useState<Suggestion | null>(null);
  const [resolved, setResolved] = useState<Hit[]>([]);
  const [missing, setMissing] = useState<string[]>([]);

  async function importList(text: string) {
    const response = await fetch("/api/cards/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await response.json();
    setResolved(data.resolved ?? []);
    setMissing((data.missing ?? []).map((item: { name: string }) => item.name));
    return data;
  }

  const totalQty = resolved.reduce((n, item) => n + item.quantity, 0);

  return (
    <AppShell>
      <div className="space-y-8">
        <div data-page-hero className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="ui-headline">Busca</h1>
            <p className="max-w-xl text-[13px] leading-5 text-secondary">
              Sugestões a partir de 4 caracteres, em português e inglês. O catálogo local vem primeiro.
            </p>
          </div>
          <p className="font-mono text-[10px] tracking-[0.04em] text-muted uppercase">
            ● SYNCED: LOCAL + SCRYFALL
          </p>
        </div>

        <div className="max-w-2xl">
          <CardSearch onSelect={setPicked} placeholder="Buscar carta…" />
        </div>

        {picked ? (
          <article className="flex max-w-2xl gap-4 border border-ink bg-surface-container-lowest p-4 shadow-panel">
            {picked.imageSmall ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={picked.imageSmall} alt="" className="h-28 w-20 rounded-[3px] object-cover" />
            ) : null}
            <div>
              <p className="text-[13px] font-medium text-ink">{picked.namePt ?? picked.nameEn}</p>
              <p className="text-[12px] text-muted">{picked.nameEn}</p>
              <p className="ui-label mt-2">{picked.setCode}</p>
            </div>
          </article>
        ) : null}

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="ui-headline-lg">Lista</h2>
            <p className="font-mono text-[11px] text-muted">
              {resolved.length} linhas · {totalQty} cartas
            </p>
          </div>
          <ListImport onResolved={importList} />
          <ul className="border border-ink bg-surface-container-lowest shadow-panel">
            {resolved.map((item) => (
              <li key={`${item.card.id}-${item.quantity}`} className="ui-row justify-between text-[13px]">
                <span>
                  <span className="font-mono text-[12px] font-semibold">{item.quantity}</span>{" "}
                  {item.card.name_pt ?? item.card.name_en}
                  <span className="ml-2 text-[12px] text-muted">{item.card.name_en}</span>
                </span>
                <span className="ui-badge">{item.card.set_code}</span>
              </li>
            ))}
            {resolved.length === 0 ? (
              <li className="px-3 py-6 text-[13px] text-muted">Nenhuma carta resolvida ainda.</li>
            ) : null}
          </ul>
          {missing.length ? (
            <p className="text-[13px] text-error">Ajuste o nome destas: {missing.join(", ")}</p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
