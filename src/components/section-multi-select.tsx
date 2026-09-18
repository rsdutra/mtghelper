"use client";

import { useEffect, useId, useRef, useState } from "react";

export type SectionOption = {
  id: string;
  name: string;
};

type SectionMultiSelectProps = {
  sections: readonly SectionOption[];
  selectedIds: readonly string[];
  onChange: (nextIds: string[]) => void;
  disabled?: boolean;
  label?: string;
};

export function SectionMultiSelect({
  sections,
  selectedIds,
  onChange,
  disabled = false,
  label = "Sessões",
}: SectionMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = new Set(selectedIds);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(id: string) {
    const next = selected.has(id)
      ? selectedIds.filter((item) => item !== id)
      : [...selectedIds, id];
    onChange(next);
  }

  const summary =
    selectedIds.length === 0
      ? "Nenhuma"
      : selectedIds.length === 1
        ? (sections.find((section) => section.id === selectedIds[0])?.name ?? "1 sessão")
        : `${selectedIds.length} sessões`;

  if (sections.length === 0) {
    return (
      <span
        className="text-[10px] text-muted"
        title="Nenhuma sessão (tag) criada neste deck. Crie uma no painel lateral para etiquetar cartas — upgrade, cortar, trocar…"
      >
        Sem sessões
      </span>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="ui-btn-outline h-6 max-w-[11rem] truncate px-1.5 text-[10px] text-muted disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        title={label}
      >
        {label}: {summary}
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          className="absolute right-0 z-30 mt-1 max-h-56 min-w-[12rem] overflow-auto border border-ink bg-white py-1 shadow-sm"
        >
          {sections.map((section) => {
            const checked = selected.has(section.id);
            return (
              <li key={section.id} role="option" aria-selected={checked}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-surface-container-low">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(section.id)}
                    className="shrink-0"
                  />
                  <span className="truncate">{section.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
