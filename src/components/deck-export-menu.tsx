"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Modal } from "@/components/modal";
import {
  DECK_EXPORT_OPTIONS,
  formatDeckExportList,
  type DeckExportCard,
  type DeckExportScope,
} from "@/lib/deck-export";

type Props = {
  cards: readonly DeckExportCard[];
  buttonClassName?: string;
  menuAlign?: "left" | "right";
};

const SCOPE_TITLE: Record<DeckExportScope, string> = {
  all: "Exportar tudo",
  included: "Exportar somente no deck",
  working: "Exportar somente fora do deck",
};

export function DeckExportMenu({ cards, buttonClassName = "ui-btn-outline h-9", menuAlign = "left" }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [scope, setScope] = useState<DeckExportScope>("all");
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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
    const list = formatDeckExportList(cards, nextScope);
    setScope(nextScope);
    setMenuOpen(false);
    setCopied(false);
    setText(list);
    if (list) await copyText(list);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={buttonClassName}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        onClick={() => setMenuOpen((open) => !open)}
      >
        Exportar
      </button>
      {menuOpen ? (
        <ul
          id={menuId}
          role="menu"
          aria-label="Exportar deck"
          className={`absolute z-40 mt-1 min-w-[14rem] border border-ink bg-white py-1 shadow-[4px_4px_0_#09090b] ${
            menuAlign === "right" ? "right-0" : "left-0"
          }`}
        >
          {DECK_EXPORT_OPTIONS.map((option) => (
            <li key={option.scope} role="none">
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-[13px] hover:bg-surface-container-low"
                onClick={() => void exportScope(option.scope)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {text !== null ? (
        <Modal role="dialog" aria-modal="true">
          <div className="w-full max-w-lg border border-ink bg-white p-4 shadow-[4px_4px_0_#09090b]">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">{SCOPE_TITLE[scope]}</h2>
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
