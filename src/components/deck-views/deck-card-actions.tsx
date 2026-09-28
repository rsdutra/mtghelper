"use client";

import { SectionMultiSelect, type SectionOption } from "@/components/section-multi-select";
import type { ActionsLayout } from "@/components/deck-views/deck-view-types";

type Props = {
  layout: ActionsLayout;
  label: string;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemoveAll: () => void;
  onInspect: () => void;
  inspectTitle?: string;
  coverage: { owned: number; needed: number; missing: number } | null;
  included: boolean;
  onIncludedChange: (included: boolean) => void;
  inSideboard?: boolean;
  onSideboardChange?: (inSideboard: boolean) => void;
  sections: readonly SectionOption[];
  selectedTagIds: readonly string[];
  onTagsChange: (nextIds: string[]) => void;
};

const iconButton = "flex h-6 w-6 items-center justify-center leading-none text-muted";

/** Ações de edição da carta, iguais nas três views (F-010 / US-010-03). */
export function DeckCardActions({
  layout,
  label,
  quantity,
  onIncrement,
  onDecrement,
  onRemoveAll,
  onInspect,
  inspectTitle = "Detalhes da carta (preço e nota)",
  coverage,
  included,
  onIncludedChange,
  inSideboard = false,
  onSideboardChange,
  sections,
  selectedTagIds,
  onTagsChange,
}: Props) {
  const column = layout === "column";

  const decrement = (
    <button
      type="button"
      aria-label={`Diminuir ${label}`}
      title="Diminuir"
      className={`${iconButton} text-[13px] hover:text-ink`}
      onClick={onDecrement}
    >
      −
    </button>
  );
  const increment = (
    <button
      type="button"
      aria-label={`Aumentar ${label}`}
      title="Aumentar"
      className={`${iconButton} text-[13px] hover:text-ink`}
      onClick={onIncrement}
    >
      +
    </button>
  );
  const removeAll = (
    <button
      type="button"
      aria-label={`Remover todas as cópias de ${label}`}
      title="Remover todas"
      className={`${iconButton} hover:text-danger`}
      onClick={onRemoveAll}
    >
      <TrashIcon />
    </button>
  );
  const inspect = (
    <button type="button" aria-label={inspectTitle} title={inspectTitle} className={`${iconButton} hover:text-ink`} onClick={onInspect}>
      <EyeIcon />
    </button>
  );
  const coverageBadge = coverage ? (
    <span
      className={`text-center font-mono tabular-nums ${column ? "text-[9px]" : "min-w-8 px-0.5 text-[10px]"} ${
        coverage.missing > 0 ? "text-danger" : "text-muted"
      }`}
      title={`${coverage.owned} na coleção · ${coverage.needed} no deck (todas as coleções, qualquer set)`}
    >
      {coverage.owned}/{coverage.needed}
    </span>
  ) : null;
  const includedToggle = column ? (
    <input
      type="checkbox"
      aria-label="No deck"
      title="No deck"
      className="my-1"
      checked={included}
      onChange={(event) => onIncludedChange(event.target.checked)}
    />
  ) : (
    <label className="flex items-center gap-1 text-[11px] text-muted">
      <input type="checkbox" checked={included} onChange={(event) => onIncludedChange(event.target.checked)} />
      No deck
    </label>
  );
  const sideboardToggle = onSideboardChange ? (
    column ? (
      <input
        type="checkbox"
        aria-label="Sideboard"
        title="Sideboard"
        className="my-1"
        checked={inSideboard}
        onChange={(event) => onSideboardChange(event.target.checked)}
      />
    ) : (
      <label className="flex items-center gap-1 text-[11px] text-muted">
        <input
          type="checkbox"
          aria-label="Sideboard"
          checked={inSideboard}
          onChange={(event) => onSideboardChange(event.target.checked)}
        />
        Sideboard
      </label>
    )
  ) : null;
  const tags = (
    <SectionMultiSelect sections={sections} selectedIds={selectedTagIds} onChange={onTagsChange} compact={column} />
  );

  if (column) {
    return (
      <div className="flex w-7 flex-col items-center gap-0.5 py-1" data-testid="deck-card-actions">
        {increment}
        {decrement}
        {removeAll}
        {inspect}
        {includedToggle}
        {sideboardToggle}
        {tags}
        {coverageBadge}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="deck-card-actions">
      <div className="flex items-center overflow-hidden rounded-[2px] border border-outline-variant bg-surface-container-lowest">
        {decrement}
        <span
          aria-label={`Quantidade de ${label}`}
          className="w-6 text-center font-mono text-[13px] font-semibold tabular-nums text-ink"
        >
          {quantity}
        </span>
        {increment}
      </div>
      <div className="flex items-center gap-1">
        <span className="flex rounded-[2px] border border-outline-variant hover:border-danger">{removeAll}</span>
        {inspect}
        {coverageBadge}
      </div>
      <div className="flex items-center gap-3">
        {includedToggle}
        {sideboardToggle}
        {tags}
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
