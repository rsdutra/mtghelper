"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { missingCardList, type MissingCardSource } from "@/lib/deck-coverage";

type Props = {
  deckId: string;
  cards: readonly MissingCardSource[];
  onClose: () => void;
  /** Recarrega o deck para recalcular a conferência. */
  onAdded: () => Promise<void>;
};

/** Cartas que faltam na coleção, para adicionar as marcadas à coleção padrão (US-004-19). */
export function DeckMissingCardsModal({ deckId, cards, onClose, onAdded }: Props) {
  const list = useMemo(() => missingCardList(cards), [cards]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(list.map((card) => card.key)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const allSelected = list.length > 0 && list.every((card) => selected.has(card.key));
  const chosen = list.filter((card) => selected.has(card.key));

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function add() {
    setSaving(true);
    setError("");
    const response = await fetch(`/api/decks/${deckId}/missing-cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys: chosen.map((card) => card.key) }),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Não foi possível adicionar à coleção.");
      setSaving(false);
      return;
    }
    await onAdded();
    setSaving(false);
    onClose();
  }

  const copies = chosen.reduce((total, card) => total + card.missing, 0);

  return (
    <Modal role="dialog" aria-modal="true" aria-labelledby="deck-missing-title">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col border border-ink bg-white p-4 shadow-[4px_4px_0_#09090b]">
        <h2 id="deck-missing-title" className="text-[15px] font-semibold text-ink">
          Cartas faltando na coleção
        </h2>
        <p className="mt-1 text-[12px] text-muted">
          Todas as coleções, qualquer impressão. As marcadas entram na coleção padrão, na impressão mais recente.
        </p>
        {list.length === 0 ? (
          <p className="mt-3 border border-border-line px-3 py-4 text-[13px] text-muted">Nenhuma carta faltando.</p>
        ) : (
          <>
            <label className="mt-3 flex items-center gap-2 border-b border-outline-variant pb-2 text-[13px] font-semibold">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(list.map((card) => card.key)))}
              />
              Marcar todas
            </label>
            <ul aria-label="Cartas faltando" className="min-h-0 flex-1 overflow-auto py-1">
              {list.map((card) => (
                <li key={card.key}>
                  <label className="flex items-baseline gap-2 px-1 py-[3px] text-[13px] leading-5 hover:bg-surface-container-low">
                    <input
                      type="checkbox"
                      className="self-center"
                      checked={selected.has(card.key)}
                      onChange={() => toggle(card.key)}
                    />
                    <span className="min-w-5 text-right font-mono text-[12px] tabular-nums text-muted">{card.missing}</span>
                    <span className="min-w-0 truncate">{card.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
        {error ? <p className="mt-2 text-[12px] text-danger">{error}</p> : null}
        <div className="mt-3 flex items-center justify-end gap-2">
          {chosen.length ? (
            <span className="mr-auto font-mono text-[11px] text-muted">
              {copies === 1 ? "1 cópia" : `${copies} cópias`}
            </span>
          ) : null}
          <button type="button" className="ui-btn-outline h-9" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="ui-btn h-9 disabled:opacity-50"
            disabled={!chosen.length || saving}
            onClick={() => void add()}
          >
            Adicionar à coleção
          </button>
        </div>
      </div>
    </Modal>
  );
}
