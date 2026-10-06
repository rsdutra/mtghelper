"use client";

import { useState } from "react";
import type { CardRow } from "@/components/deck-detail/deck-detail-types";
import { LoadingModal } from "@/components/loading-modal";
import { Modal } from "@/components/modal";
import { formatDeckExportList } from "@/lib/deck-export";
import { DECK_LIST_PLACES, deckListPlaceLabel, type DeckListPlace } from "@/lib/deck-list-edit";

type Props = {
  deckId: string;
  cards: CardRow[];
  allowsSideboard: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

type Missing = { place: DeckListPlace; name: string; line: number };

/** F-018 — Deck, Sideboard e Maybeboard em texto; salvar deixa o deck igual às listas. */
export function DeckListEditor({ deckId, cards, allowsSideboard, onClose, onSaved }: Props) {
  const places = DECK_LIST_PLACES.filter((item) => allowsSideboard || item.place !== "side");
  const [active, setActive] = useState<DeckListPlace>("main");
  const [lists, setLists] = useState<Record<DeckListPlace, string>>(() => ({
    main: formatDeckExportList(cards, "main", allowsSideboard),
    side: formatDeckExportList(cards, "side", allowsSideboard),
    out: formatDeckExportList(cards, "out", allowsSideboard),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState<Missing[]>([]);

  async function save() {
    setSaving(true);
    setError("");
    setMissing([]);
    try {
      const response = await fetch(`/api/decks/${deckId}/cards`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lists }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMissing(Array.isArray(data.missing) ? data.missing : []);
        setError(typeof data.error === "string" ? data.error : "Não foi possível salvar a lista.");
        return;
      }
      await onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal role="dialog" aria-modal="true" aria-labelledby="deck-list-editor-title">
      <div className="flex h-[min(80vh,760px)] w-[min(960px,94vw)] flex-col border border-ink bg-surface-container-lowest shadow-[6px_6px_0_#09090b]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-5 py-3">
          <h2 id="deck-list-editor-title" className="text-[16px] font-semibold text-ink">
            Editar por lista
          </h2>
          <div role="tablist" aria-label="Lugar da lista" className="inline-flex border border-outline-variant p-0.5">
            {places.map((item) => (
              <button
                key={item.place}
                type="button"
                role="tab"
                id={`deck-list-tab-${item.place}`}
                aria-selected={active === item.place}
                aria-controls={`deck-list-panel-${item.place}`}
                onClick={() => setActive(item.place)}
                className={`px-4 py-1.5 text-[12px] font-medium ${
                  active === item.place ? "bg-ink font-semibold text-white" : "text-ink hover:bg-surface-container"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
          <p className="text-[12px] text-muted">
            Uma carta por linha: quantidade e nome, em inglês ou português. Ao salvar, o deck fica igual a estas listas.
          </p>
          {places.map((item) => (
            <textarea
              key={item.place}
              id={`deck-list-panel-${item.place}`}
              role="tabpanel"
              aria-label={`Lista do ${item.label}`}
              value={lists[item.place]}
              onChange={(event) => {
                const text = event.target.value;
                setLists((current) => ({ ...current, [item.place]: text }));
              }}
              hidden={active !== item.place}
              spellCheck={false}
              className="ui-textarea min-h-0 flex-1 font-mono text-[14px] leading-6"
            />
          ))}
          {error ? (
            <div role="alert" className="max-h-32 overflow-auto border border-danger px-3 py-2 text-[13px] text-danger">
              <p className="font-semibold">{error}</p>
              {missing.length ? (
                <ul className="mt-1 space-y-0.5">
                  {missing.map((item) => (
                    <li key={`${item.place}-${item.line}`}>
                      {deckListPlaceLabel(item.place)}, linha {item.line}: {item.name}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-outline-variant px-5 py-3">
          <button type="button" className="ui-btn-outline h-9" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="ui-btn h-9" onClick={() => void save()} disabled={saving}>
            Salvar
          </button>
        </footer>
      </div>
      <LoadingModal open={saving} title="Salvando lista" message="Atualizando as cartas do deck. Aguarde…" />
    </Modal>
  );
}
