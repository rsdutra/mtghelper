"use client";

import { sameTag, type CardTag } from "@/lib/tags";

/** Painel do filtro do deck por tag — F-013 / US-013-03. Uma tag por vez. */
export function DeckTagFilterPanel({
  tags,
  active,
  onSelect,
  onClear,
}: {
  tags: CardTag[];
  active: string | null;
  onSelect: (tag: string | null) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="ui-label text-ink">Filtrar por tag</h2>
      {tags.length === 0 ? (
        <p className="text-[13px] text-muted">Nenhuma tag neste deck.</p>
      ) : (
        <ul className="space-y-1" aria-label="Tags do deck">
          {tags.map((tag) => {
            const pressed = active != null && sameTag(active, tag.name);
            return (
              <li key={tag.name}>
                <button
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => onSelect(pressed ? null : tag.name)}
                  className={`flex w-full items-center gap-2 border px-2 py-1.5 text-left text-[13px] ${
                    pressed ? "border-ink bg-ink font-semibold text-white" : "border-transparent text-ink hover:bg-surface-container"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-3 w-3 shrink-0 rounded-full border border-ink"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="truncate">{tag.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className="ui-btn-outline h-8 w-full disabled:opacity-50" disabled={!active} onClick={onClear}>
        Limpar filtro
      </button>
    </div>
  );
}
