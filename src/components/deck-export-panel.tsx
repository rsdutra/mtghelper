"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/modal";
import {
  deckExportOptions,
  deckExportTitle,
  formatDeckExportList,
  type DeckExportCard,
  type DeckExportScope,
} from "@/lib/deck-export";

type Props = {
  cards: readonly DeckExportCard[];
  allowsSideboard: boolean;
};

/** Painel de exportação do deck (F-016 / US-016-01): cada opção copia a lista e abre o modal. */
export function DeckExportPanel({ cards, allowsSideboard }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [scope, setScope] = useState<DeckExportScope>("main");
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (text === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [text]);

  useEffect(() => {
    if (text === null) return;
    const area = textareaRef.current;
    if (!area) return;
    area.focus();
    area.select();
  }, [text]);

  function closeModal() {
    setText(null);
    setCopied(false);
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function exportScope(nextScope: DeckExportScope) {
    const list = formatDeckExportList(cards, nextScope, allowsSideboard);
    setScope(nextScope);
    setCopied(false);
    setText(list);
    if (list) await copyText(list);
  }

  return (
    <div className="space-y-3">
      <h2 className="ui-label text-ink">Exportar</h2>
      <p className="text-[12px] text-muted">Copia a lista (quantidade + nome em inglês) para a área de transferência.</p>
      <ul aria-label="Opções de exportação" className="flex flex-col gap-2">
        {deckExportOptions(allowsSideboard).map((option) => (
          <li key={option.scope}>
            <button
              type="button"
              aria-label={option.title}
              className="ui-btn-outline h-9 w-full justify-start"
              onClick={() => void exportScope(option.scope)}
            >
              {option.label}
            </button>
          </li>
        ))}
      </ul>

      {text !== null ? (
        <Modal role="dialog" aria-modal="true" aria-label={deckExportTitle(scope)}>
          <div className="w-full max-w-lg border border-ink bg-white p-4 shadow-[4px_4px_0_#09090b]">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">{deckExportTitle(scope)}</h2>
                <p className="text-[12px] text-muted">Formato: quantidade + nome em inglês</p>
              </div>
              <button type="button" className="ui-btn-outline h-8 px-2 text-[11px]" onClick={closeModal}>
                Fechar
              </button>
            </div>
            {text ? (
              <textarea
                ref={textareaRef}
                readOnly
                aria-label="Lista exportada"
                value={text}
                className="ui-textarea h-56"
              />
            ) : (
              <p className="border border-border-line px-3 py-4 text-[13px] text-muted">Nenhuma carta para exportar.</p>
            )}
            <div className="mt-3 flex items-center justify-end gap-2">
              {copied ? <span className="mr-auto text-[12px] text-muted">Copiado para a área de transferência.</span> : null}
              {text ? (
                <button type="button" className="ui-btn h-9" onClick={() => void copyText(text)}>
                  Copiar
                </button>
              ) : null}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
