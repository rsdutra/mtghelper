"use client";

import { useState, type ReactNode } from "react";
import { CardScanner } from "@/components/card-scanner";
import { CardSearch, type Suggestion } from "@/components/card-search";
import type { DeckPlace } from "@/components/deck-detail/deck-detail-types";
import { LoadingModal } from "@/components/loading-modal";

type Props = {
  deckId: string;
  allowsSideboard: boolean;
  status: string;
  setStatus: (status: string) => void;
  addText: (text: string, set?: string, place?: DeckPlace) => Promise<void>;
  reload: () => Promise<void>;
};

function Module({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2 border-b border-outline-variant pb-5 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[10px] font-bold tracking-[0.08em] text-ink uppercase">{title}</h2>
        {aside}
      </div>
      {children}
    </div>
  );
}

/** Painel lateral de ferramentas, exclusivo do modo edição (F-011 / US-011-04). */
export function DeckEditTools({
  deckId,
  allowsSideboard,
  status,
  setStatus,
  addText,
  reload,
}: Props) {
  const [listText, setListText] = useState("");
  const [listImporting, setListImporting] = useState(false);
  const [includeCollection, setIncludeCollection] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  async function importListText(text: string) {
    if (!text.trim() || listImporting) return;
    setListImporting(true);
    try {
      await addText(text);
    } finally {
      setListImporting(false);
    }
  }

  async function addSuggestion(suggestion: Suggestion, place: DeckPlace) {
    await addText(`1 ${suggestion.namePt ?? suggestion.nameEn}`, undefined, place);
  }

  async function processCollection() {
    const response = await fetch(`/api/decks/${deckId}/process-collection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await response.json();
    setStatus(response.ok ? `${data.added} carta(s) incluídas enviadas à coleção.` : "Não foi possível processar.");
    if (response.ok) await reload();
  }

  return (
    <div className="space-y-5">
      <Module title="Busca">
        <CardSearch onSelect={(item) => void addSuggestion(item, "main")} />
        <button type="button" className="ui-btn-outline h-8 w-full" onClick={() => setScannerOpen(true)}>
          Escanear carta
        </button>
      </Module>
      {allowsSideboard ? (
        <Module title="Sideboard" aside={<span className="font-mono text-[10px] text-outline">até 15</span>}>
          <CardSearch
            placeholder="Adicionar ao sideboard"
            onSelect={(item) => void addSuggestion(item, "side")}
          />
        </Module>
      ) : null}
      <Module title="Lista" aside={<span className="font-mono text-[10px] text-outline">Qtd + Nome</span>}>
        <textarea
          value={listText}
          onChange={(event) => setListText(event.target.value)}
          className="ui-textarea h-24 font-mono text-[12px] disabled:opacity-60"
          placeholder="1 Sol Ring"
          disabled={listImporting}
        />
        <button
          type="button"
          className="ui-btn-outline h-8 w-full disabled:opacity-60"
          disabled={listImporting}
          onClick={() => void importListText(listText)}
        >
          Adicionar ao deck
        </button>
      </Module>
      <Module title="Fora do deck">
        <CardSearch placeholder="Adicionar fora do deck" onSelect={(item) => void addSuggestion(item, "out")} />
      </Module>
      <Module title="Coleção">
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={includeCollection}
            onChange={(event) => setIncludeCollection(event.target.checked)}
          />
          Incluir na coleção (só cartas “No deck”)
        </label>
        {includeCollection ? (
          <button type="button" onClick={() => void processCollection()} className="ui-btn h-8 w-full">
            Processar
          </button>
        ) : null}
      </Module>
      {status ? <p className="text-[12px] text-muted">{status}</p> : null}
      <CardScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onConfirm={async (payload) => {
          await addText(`${payload.quantity} ${payload.name}`, payload.set, "main");
        }}
      />
      <LoadingModal open={listImporting} title="Adicionando cartas" message="Importando a lista para o deck. Aguarde…" />
    </div>
  );
}
