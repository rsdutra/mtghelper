"use client";

import { useState, type ReactNode } from "react";
import { CardScanner } from "@/components/card-scanner";
import { CardSearch, type Suggestion } from "@/components/card-search";
import type { Section } from "@/components/deck-detail/deck-detail-types";
import { LoadingModal } from "@/components/loading-modal";

type Props = {
  deckId: string;
  userSections: Section[];
  sideboardSection: Section | null;
  status: string;
  setStatus: (status: string) => void;
  addText: (text: string, sectionId?: string, set?: string, included?: boolean) => Promise<void>;
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
  userSections,
  sideboardSection,
  status,
  setStatus,
  addText,
  reload,
}: Props) {
  const [listText, setListText] = useState("");
  const [listImporting, setListImporting] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [targetSection, setTargetSection] = useState("");
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

  async function addSuggestion(suggestion: Suggestion, sectionId?: string, included?: boolean) {
    await addText(`1 ${suggestion.namePt ?? suggestion.nameEn}`, sectionId, undefined, included);
  }

  async function createSection(event: React.FormEvent) {
    event.preventDefault();
    if (!sectionName.trim()) return;
    await fetch(`/api/decks/${deckId}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: sectionName }),
    });
    setSectionName("");
    await reload();
  }

  async function deleteSection(sectionId: string, sectionLabel: string) {
    if (!window.confirm(`Excluir a tag “${sectionLabel}”? As cartas permanecem no deck.`)) return;
    const response = await fetch(`/api/decks/${deckId}/sections`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(typeof data.error === "string" ? data.error : "Não foi possível excluir a tag.");
      return;
    }
    if (targetSection === sectionId) setTargetSection("");
    setStatus("Tag excluída.");
    await reload();
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
        <CardSearch onSelect={(item) => void addSuggestion(item, undefined, true)} />
        <button type="button" className="ui-btn-outline h-8 w-full" onClick={() => setScannerOpen(true)}>
          Escanear carta
        </button>
      </Module>
      {sideboardSection ? (
        <Module title="Sideboard" aside={<span className="font-mono text-[10px] text-outline">até 15</span>}>
          <CardSearch
            placeholder="Adicionar ao sideboard"
            onSelect={(item) => void addSuggestion(item, sideboardSection.id, true)}
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
      <Module title="Seção (tag)">
        <form onSubmit={(event) => void createSection(event)} className="space-y-2">
          <input
            aria-label="Nome da seção"
            value={sectionName}
            onChange={(event) => setSectionName(event.target.value)}
            placeholder="upgrade, remover, trocar"
            className="ui-input"
          />
          <button type="submit" className="ui-btn-outline h-8 w-full">
            Criar seção
          </button>
        </form>
      </Module>
      {userSections.length ? (
        <Module title="Tags">
          <ul className="divide-y divide-outline-variant border border-outline-variant text-[13px]">
            {userSections.map((section) => (
              <li key={section.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                <span className="truncate font-medium">{section.name}</span>
                <button
                  type="button"
                  className="shrink-0 font-mono text-[10px] text-on-surface-variant underline hover:text-danger"
                  onClick={() => void deleteSection(section.id, section.name)}
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        </Module>
      ) : null}
      {userSections.length ? (
        <Module title="Adicionar fora do deck + tag">
          <select
            aria-label="Seção destino"
            value={targetSection}
            onChange={(event) => setTargetSection(event.target.value)}
            className="ui-input"
          >
            <option value="">Escolher seção…</option>
            {userSections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
          {targetSection ? (
            <CardSearch
              placeholder="Carta fora do deck"
              onSelect={(item) => void addSuggestion(item, targetSection, false)}
            />
          ) : null}
        </Module>
      ) : null}
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
        sections={userSections}
        onConfirm={async (payload) => {
          await addText(
            `${payload.quantity} ${payload.name}`,
            payload.sectionId,
            payload.set,
            payload.sectionId ? false : true,
          );
        }}
      />
      <LoadingModal open={listImporting} title="Adicionando cartas" message="Importando a lista para o deck. Aguarde…" />
    </div>
  );
}
