"use client";

import { useState, type ReactNode } from "react";
import { useCardHoverPreview } from "@/components/card-hover-preview";
import {
  LIST_PREVIEW_DELAY_MS,
  type DeckListView,
  type DeckViewGroup,
  type DeckViewItem,
} from "@/components/deck-views/deck-view-types";

const CARD_W = 140;
const CARD_H = Math.round((CARD_W * 88) / 63);
const ACTIONS_W = 30;
/** Grid visual: cada linha cobre a metade de baixo da anterior (US-010-03). */
const GRID_ROW_H = Math.round(CARD_H / 2);
/** Grid agrupada: faixa visível de cada carta, o suficiente para o título (US-010-04). */
const STACK_OFFSET = 30;
const STACK_MAX = 12;

type Preview = ReturnType<typeof useCardHoverPreview>;

type Props = {
  view: DeckListView;
  groups: DeckViewGroup[];
  collapsedGroups: ReadonlySet<string>;
  onToggleGroup: (key: string) => void;
  /** `working` = seção “Em trabalho”, com borda tracejada. */
  tone?: "deck" | "working";
};

/** Renderiza cartas do deck como Texto, Grid visual ou Grid visual agrupada (F-010). */
export function DeckCardView({ view, groups, collapsedGroups, onToggleGroup, tone = "deck" }: Props) {
  const preview = useCardHoverPreview(LIST_PREVIEW_DELAY_MS);
  const grouped = groups.some((group) => group.label !== null);
  const frame = tone === "working" ? "border border-dashed border-neutral-400" : "border border-ink";

  function body(items: DeckViewItem[]) {
    if (view === "grid") return <CardGrid items={items} preview={preview} />;
    return <TextList items={items} preview={preview} />;
  }

  let content: ReactNode;
  if (view === "pilhas") {
    const columns = grouped
      ? groups
      : chunk(
          groups.flatMap((group) => group.items),
          STACK_MAX,
        ).map((items, index) => ({ key: `stack-${index}`, label: null, items }));
    content = (
      <div className={`${frame} flex flex-wrap items-start gap-x-4 gap-y-6 p-3`}>
        {columns.map((column) => {
          const collapsed = column.label !== null && collapsedGroups.has(column.key);
          return (
            <div key={column.key} style={{ width: CARD_W + ACTIONS_W }}>
              {column.label !== null ? (
                <GroupHeader
                  label={column.label}
                  items={column.items}
                  collapsed={collapsed}
                  onToggle={() => onToggleGroup(column.key)}
                  className="mb-2 border border-ink"
                  compact
                />
              ) : null}
              {collapsed ? null : <CardStack items={column.items} preview={preview} />}
            </div>
          );
        })}
      </div>
    );
  } else if (grouped) {
    content = (
      <div className="space-y-3">
        {groups.map((group) => {
          const collapsed = collapsedGroups.has(group.key);
          return (
            <div key={group.key} className={frame}>
              <GroupHeader
                label={group.label ?? ""}
                items={group.items}
                collapsed={collapsed}
                onToggle={() => onToggleGroup(group.key)}
                className="border-b border-border-line"
              />
              {collapsed ? null : body(group.items)}
            </div>
          );
        })}
      </div>
    );
  } else {
    content = <div className={frame}>{body(groups.flatMap((group) => group.items))}</div>;
  }

  return (
    <div data-testid={`deck-view-${view}`}>
      {content}
      {preview.overlay}
    </div>
  );
}

function GroupHeader({
  label,
  items,
  collapsed,
  onToggle,
  className,
  compact = false,
}: {
  label: string;
  items: DeckViewItem[];
  collapsed: boolean;
  onToggle: () => void;
  className: string;
  compact?: boolean;
}) {
  const quantity = items.reduce((total, item) => total + item.quantity, 0);
  const size = compact ? "gap-1 px-2 py-1.5 text-[11px]" : "gap-2 px-3 py-2 text-[13px] tracking-wide";
  return (
    <button
      type="button"
      className={`flex w-full items-center bg-surface-container-low text-left font-semibold uppercase ${size} ${className}`}
      aria-expanded={!collapsed}
      onClick={onToggle}
    >
      <span className="w-4 shrink-0 text-muted" aria-hidden>
        {collapsed ? "▸" : "▾"}
      </span>
      <span className="flex-1 truncate">{label}</span>
      <span className="font-mono text-[11px] font-normal text-muted">{quantity}</span>
    </button>
  );
}

function TextList({ items, preview }: { items: DeckViewItem[]; preview: Preview }) {
  return (
    <ul className="divide-y">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-sm">
          <div
            className="min-w-0 flex-1 cursor-default"
            data-testid="deck-card-text"
            {...preview.bind(item.id, item.imageSrc, item.label)}
          >
            <p className="truncate font-medium">{item.label}</p>
            {item.secondary ? <p className="truncate text-xs text-neutral-500">{item.secondary}</p> : null}
            {item.meta ? <p className="text-xs uppercase text-neutral-500">{item.meta}</p> : null}
          </div>
          {item.renderActions("row")}
        </li>
      ))}
    </ul>
  );
}

function CardImage({ item, preview }: { item: DeckViewItem; preview: Preview }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[6px] border border-ink bg-surface-container"
      style={{ width: CARD_W, height: CARD_H }}
      {...preview.bind(item.id, item.imageSrc, item.label, ACTIONS_W)}
    >
      {item.imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageSrc} alt={item.label} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="block p-2 pt-7 text-[11px] font-medium">{item.label}</span>
      )}
      <span
        aria-label={`Quantidade de ${item.label}`}
        className="absolute top-1.5 left-1.5 bg-ink/85 px-1.5 font-mono text-[11px] leading-4 text-white"
      >
        x{item.quantity}
      </span>
    </div>
  );
}

function CardGrid({ items, preview }: { items: DeckViewItem[]; preview: Preview }) {
  return (
    <div
      className="grid gap-x-3 p-3"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_W + ACTIONS_W}px, 1fr))`,
        gridAutoRows: GRID_ROW_H,
        paddingBottom: CARD_H - GRID_ROW_H + 12,
      }}
    >
      {items.map((item) => (
        <div
          key={item.id}
          data-testid="deck-card-tile"
          className="relative flex hover:z-20 focus-within:z-20"
          style={{ height: CARD_H, width: CARD_W + ACTIONS_W }}
        >
          <CardImage item={item} preview={preview} />
          <div className="bg-surface-container-lowest" style={{ width: ACTIONS_W }}>
            {item.renderActions("column")}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Ações da carta ativa (pairada) ficam ao lado dela; as demais só mostram a faixa do título. */
function CardStack({ items, preview }: { items: DeckViewItem[]; preview: Preview }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const active = activeIndex >= 0 ? items[activeIndex] : null;
  const height = items.length ? (items.length - 1) * STACK_OFFSET + CARD_H : 0;

  return (
    <div
      className="relative"
      data-testid="deck-card-stack"
      style={{ width: CARD_W + ACTIONS_W, height }}
      onPointerLeave={() => setActiveId(null)}
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          data-testid="deck-card-tile"
          className="absolute left-0"
          style={{ top: index * STACK_OFFSET, zIndex: index }}
          onPointerEnter={() => setActiveId(item.id)}
        >
          <CardImage item={item} preview={preview} />
        </div>
      ))}
      {active ? (
        <div
          className="absolute bg-surface-container-lowest"
          style={{ left: CARD_W, top: activeIndex * STACK_OFFSET, width: ACTIONS_W, zIndex: items.length + 1 }}
        >
          {active.renderActions("column")}
        </div>
      ) : null}
    </div>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}
