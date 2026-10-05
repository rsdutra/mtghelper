"use client";

import { useEffect, useRef, useState } from "react";
import { TEXT_LIST_OPTIONS, type TextListOption } from "@/components/deck-views/deck-view-types";

/** Dropdown de múltipla escolha ao lado de “Visualização” (F-017 / US-017-03). */
export function TextListOptions({
  value,
  disabled,
  onChange,
}: {
  value: TextListOption[];
  disabled?: boolean;
  onChange: (next: TextListOption[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(id: TextListOption) {
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
  }

  const summary = value.length ? `Exibir (${value.length})` : "Exibir";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Itens da lista"
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        className="ui-input h-8 w-auto border-outline-variant px-2 text-left disabled:opacity-50"
        onClick={() => setOpen((current) => !current)}
      >
        {summary}
      </button>
      {open ? (
        <div
          role="group"
          aria-label="Itens opcionais da lista"
          className="absolute right-0 z-40 mt-1 w-52 border border-ink bg-surface-container-lowest p-1 shadow-[4px_4px_0_#09090b]"
        >
          {TEXT_LIST_OPTIONS.map((option) => (
            <label key={option.id} className="flex items-center gap-2 px-2 py-1.5 text-[13px] hover:bg-surface-container">
              <input type="checkbox" checked={value.includes(option.id)} onChange={() => toggle(option.id)} />
              {option.label}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
