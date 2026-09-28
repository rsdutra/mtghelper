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
  /** Só ícone + contagem, para a coluna de ações das grids (F-010 / US-010-03). */
  compact?: boolean;
};

export function SectionMultiSelect({
  sections,
  selectedIds,
  onChange,
  disabled = false,
  label = "Sessões",
  compact = false,
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
    if (compact) return null;
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
      {compact ? (
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center gap-px text-[9px] text-muted hover:text-ink disabled:opacity-50"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={`${label}: ${summary}`}
          disabled={disabled}
          onClick={() => setOpen((value) => !value)}
          title={`${label}: ${summary}`}
        >
          <TagIcon />
          {selectedIds.length ? <span className="tabular-nums">{selectedIds.length}</span> : null}
        </button>
      ) : (
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
      )}
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

function TagIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 3h8l10 10-8 8L3 11V3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" />
    </svg>
  );
}
