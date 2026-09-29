"use client";

import { CardTagButton, TagChoices, TagDots } from "@/components/card-tags";
import type { DeckPlace } from "@/components/deck-detail/deck-detail-types";
import type { ActionsLayout } from "@/components/deck-views/deck-view-types";
import type { CardTag } from "@/lib/tags";

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
  allowsSideboard: boolean;
  onMove: (place: DeckPlace) => void;
  tags: CardTag[];
  knownTags: CardTag[];
  onToggleTag: (tag: CardTag) => void;
  onNewTag: () => void;
};

const iconButton = "flex h-6 w-6 items-center justify-center leading-none text-muted";
const menuButton = "w-full px-2 py-1 text-left text-[13px] hover:bg-surface-container";

/** Ações de edição da carta. No grid ficam no menu; no texto, na linha. */
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
  allowsSideboard,
  onMove,
  tags,
  knownTags,
  onToggleTag,
  onNewTag,
}: Props) {
  const coverageBadge = coverage ? (
    <span
      className={`text-center font-mono tabular-nums ${layout === "menu" ? "px-2 py-1 text-[11px]" : "min-w-8 px-0.5 text-[10px]"} ${
        coverage.missing > 0 ? "text-danger" : "text-muted"
      }`}
      title={`${coverage.owned} na coleção · ${coverage.needed} no deck (todas as coleções, qualquer set)`}
    >
      {coverage.owned}/{coverage.needed}
    </span>
  ) : null;

  if (layout === "menu") {
    return (
      <div className="flex flex-col" data-testid="deck-card-actions" role="menu">
        <button type="button" role="menuitem" className={menuButton} onClick={onIncrement}>
          Aumentar
        </button>
        <button type="button" role="menuitem" className={menuButton} onClick={onDecrement}>
          Diminuir
        </button>
        <button type="button" role="menuitem" className={`${menuButton} hover:text-danger`} onClick={onRemoveAll}>
          Remover todas
        </button>
        <button type="button" role="menuitem" className={menuButton} onClick={onInspect}>
          Detalhes
        </button>
        <p className="px-2 pt-2 font-mono text-[10px] tracking-wide text-muted uppercase">Mover para</p>
        <button type="button" role="menuitem" className={menuButton} onClick={() => onMove("out")}>
          Fora do deck
        </button>
        <button type="button" role="menuitem" className={menuButton} onClick={() => onMove("main")}>
          No deck
        </button>
        {allowsSideboard ? (
          <button type="button" role="menuitem" className={menuButton} onClick={() => onMove("side")}>
            Sideboard
          </button>
        ) : null}
        <TagChoices tags={tags} known={knownTags} onToggle={onToggleTag} onNew={onNewTag} />
        {coverageBadge}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="deck-card-actions">
      <div className="flex items-center overflow-hidden rounded-[2px] border border-outline-variant bg-surface-container-lowest">
        <button
          type="button"
          aria-label={`Diminuir ${label}`}
          title="Diminuir"
          className={`${iconButton} text-[13px] hover:text-ink`}
          onClick={onDecrement}
        >
          −
        </button>
        <span
          aria-label={`Quantidade de ${label}`}
          className="flex w-auto min-w-6 items-center justify-center gap-1 px-1 text-center font-mono text-[13px] font-semibold tabular-nums text-ink"
        >
          {quantity}
          <TagDots tags={tags} />
        </span>
        <button
          type="button"
          aria-label={`Aumentar ${label}`}
          title="Aumentar"
          className={`${iconButton} text-[13px] hover:text-ink`}
          onClick={onIncrement}
        >
          +
        </button>
      </div>
      <div className="flex items-center gap-1">
        <span className="flex rounded-[2px] border border-outline-variant hover:border-danger">
          <button
            type="button"
            aria-label={`Remover todas as cópias de ${label}`}
            title="Remover todas"
            className={`${iconButton} hover:text-danger`}
            onClick={onRemoveAll}
          >
            <TrashIcon />
          </button>
        </span>
        <button type="button" aria-label={inspectTitle} title={inspectTitle} className={`${iconButton} hover:text-ink`} onClick={onInspect}>
          <EyeIcon />
        </button>
        <CardTagButton label={label} tags={tags} known={knownTags} onToggle={onToggleTag} onNew={onNewTag} />
        {coverageBadge}
      </div>
      <label className="flex items-center gap-2 text-[11px] text-muted">
        Mover para
        <select
          aria-label={`Mover ${label}`}
          value=""
          onChange={(event) => {
            const place = event.target.value;
            if (place === "out" || place === "main" || place === "side") onMove(place);
          }}
          className="ui-input h-7 w-auto"
        >
          <option value="">Escolher…</option>
          <option value="out">Fora do deck</option>
          <option value="main">No deck</option>
          {allowsSideboard ? <option value="side">Sideboard</option> : null}
        </select>
      </label>
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
