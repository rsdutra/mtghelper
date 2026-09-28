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
  /** Visualização do deck (F-011): sem ações e com o Texto condensado em colunas. */
  readOnly?: boolean;
};

/** Renderiza cartas do deck como Texto, Grid visual ou Grid visual agrupada (F-010). */
export function DeckCardView({ view, groups, collapsedGroups, onToggleGroup, readOnly = false }: Props) {
  const preview = useCardHoverPreview(LIST_PREVIEW_DELAY_MS);
  const grouped = groups.some((group) => group.label !== null);
  const actionsW = readOnly ? 0 : ACTIONS_W;

  function body(items: DeckViewItem[]) {
    if (view === "grid") return <CardGrid items={items} preview={preview} actionsW={actionsW} />;
    return <TextList items={items} preview={preview} />;
  }

  let content: ReactNode;
  if (view === "texto" && readOnly) {
    content = (
      <CompactColumns
        groups={groups}
        grouped={grouped}
        collapsedGroups={collapsedGroups}
        onToggleGroup={onToggleGroup}
        preview={preview}
      />
    );
  } else if (view === "pilhas") {
    const columns = grouped
      ? groups
      : chunk(
          groups.flatMap((group) => group.items),
          STACK_MAX,
        ).map((items, index) => ({ key: `stack-${index}`, label: null, items }));
    content = (
      <div className="flex flex-wrap items-start gap-x-4 gap-y-6 p-4">
        {columns.map((column) => {
          const collapsed = column.label !== null && collapsedGroups.has(column.key);
          return (
            <div key={column.key} style={{ width: CARD_W + actionsW }}>
              {column.label !== null ? (
                <StackHeader
                  label={column.label}
                  items={column.items}
                  collapsed={collapsed}
                  onToggle={() => onToggleGroup(column.key)}
                />
              ) : null}
              {collapsed ? null : <CardStack items={column.items} preview={preview} actionsW={actionsW} />}
            </div>
          );
        })}
      </div>
    );
  } else if (grouped) {
    content = groups.map((group) => {
      const collapsed = collapsedGroups.has(group.key);
      return (
        <div key={group.key} className="border-b border-outline-variant last:border-b-0">
          <AccordionHeader
            label={group.label ?? ""}
            items={group.items}
            collapsed={collapsed}
            onToggle={() => onToggleGroup(group.key)}
          />
          {collapsed ? null : body(group.items)}
        </div>
      );
    });
  } else {
    content = body(groups.flatMap((group) => group.items));
  }

  return (
    <div data-testid={`deck-view-${view}`}>
      {content}
      {preview.overlay}
    </div>
  );
}

function groupQuantity(items: DeckViewItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

function Chevron({ collapsed }: { collapsed: boolean }) {
  return (
    <span className="w-4 shrink-0 text-center text-[11px] text-muted" aria-hidden>
      {collapsed ? "▸" : "▾"}
    </span>
  );
}

type HeaderProps = { label: string; items: DeckViewItem[]; collapsed: boolean; onToggle: () => void };

/** Acordeão do layout Stitch “Detalhes do Deck” (F-011 / US-011-01). */
function AccordionHeader({ label, items, collapsed, onToggle }: HeaderProps) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 border-b border-surface-variant bg-surface px-4 py-2 text-left hover:bg-surface-container-low"
      aria-expanded={!collapsed}
      onClick={onToggle}
    >
      <Chevron collapsed={collapsed} />
      <span className="flex-1 truncate text-[15px] font-semibold tracking-tight text-ink">{label}</span>
      <span className="font-mono text-[10px] font-semibold text-on-surface-variant">{groupQuantity(items)}</span>
    </button>
  );
}

function StackHeader({ label, items, collapsed, onToggle }: HeaderProps) {
  return (
    <button
      type="button"
      className="mb-2 flex w-full items-center gap-1 border border-outline-variant bg-surface-container-low px-2 py-1.5 text-left text-[11px] font-semibold uppercase"
      aria-expanded={!collapsed}
      onClick={onToggle}
    >
      <Chevron collapsed={collapsed} />
      <span className="flex-1 truncate">{label}</span>
      <span className="font-mono text-[10px] font-normal text-muted">{groupQuantity(items)}</span>
    </button>
  );
}

/** Texto condensado em colunas, como o Moxfield (F-011 / US-011-03). */
function CompactColumns({
  groups,
  grouped,
  collapsedGroups,
  onToggleGroup,
  preview,
}: {
  groups: DeckViewGroup[];
  grouped: boolean;
  collapsedGroups: ReadonlySet<string>;
  onToggleGroup: (key: string) => void;
  preview: Preview;
}) {
  if (!grouped) {
    return (
      <ul className="columns-[15rem] gap-x-8 px-4 py-3">
        {groups.flatMap((group) => group.items).map((item) => (
          <CompactRow key={item.id} item={item} preview={preview} />
        ))}
      </ul>
    );
  }
  return (
    <div className="columns-[15rem] gap-x-8 px-4 py-3">
      {groups.map((group) => {
        const collapsed = collapsedGroups.has(group.key);
        return (
          <div key={group.key} className="mb-4 break-inside-avoid">
            <button
              type="button"
              className="flex w-full items-center gap-1 border-b border-outline-variant pb-1 text-left text-[13px] font-semibold text-ink"
              aria-expanded={!collapsed}
              onClick={() => onToggleGroup(group.key)}
            >
              <span className="truncate">{group.label}</span>
              <span className="font-normal text-muted">({groupQuantity(group.items)})</span>
              <Chevron collapsed={collapsed} />
            </button>
            {collapsed ? null : (
              <ul className="pt-1">
                {group.items.map((item) => (
                  <CompactRow key={item.id} item={item} preview={preview} />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CompactRow({ item, preview }: { item: DeckViewItem; preview: Preview }) {
  return (
    <li
      className="flex break-inside-avoid items-baseline gap-2 px-1 py-[3px] text-[13px] leading-5 hover:bg-surface-container-low"
      data-testid="deck-card-text"
      {...preview.bind(item.id, item.imageSrc, item.label)}
    >
      <span className="w-5 shrink-0 text-right font-mono text-[12px] tabular-nums text-muted">{item.quantity}</span>
      <span className="min-w-0 truncate">{item.label}</span>
    </li>
  );
}

function TextList({ items, preview }: { items: DeckViewItem[]; preview: Preview }) {
  return (
    <ul className="divide-y divide-surface-container">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-2 px-4 py-2 hover:bg-surface-bright sm:flex-row sm:items-center sm:justify-between"
        >
          <div
            className="min-w-0 flex-1 cursor-default"
            data-testid="deck-card-text"
            {...preview.bind(item.id, item.imageSrc, item.label)}
          >
            <p className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-ink">
              <span className="truncate">{item.label}</span>
              {item.tags.map((tag) => (
                <span key={tag} className="shrink-0 bg-ink px-1 font-mono text-[9px] font-medium text-white uppercase">
                  {tag}
                </span>
              ))}
            </p>
            <p className="flex min-w-0 items-center gap-2 font-mono text-[10px] tracking-[0.04em] text-on-surface-variant">
              {item.secondary ? <span className="truncate">{item.secondary}</span> : null}
              {item.setCode ? (
                <span className="shrink-0 border border-outline-variant px-1 uppercase">{item.setCode}</span>
              ) : null}
              {item.priceLabel ? <span className="shrink-0">{item.priceLabel}</span> : null}
            </p>
          </div>
          {item.renderActions("row")}
        </li>
      ))}
    </ul>
  );
}

function CardImage({ item, preview, actionsW }: { item: DeckViewItem; preview: Preview; actionsW: number }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[6px] border border-ink bg-surface-container"
      style={{ width: CARD_W, height: CARD_H }}
      {...preview.bind(item.id, item.imageSrc, item.label, actionsW)}
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

function CardGrid({ items, preview, actionsW }: { items: DeckViewItem[]; preview: Preview; actionsW: number }) {
  return (
    <div
      className="grid gap-x-3 p-4"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_W + actionsW}px, 1fr))`,
        gridAutoRows: GRID_ROW_H,
        paddingBottom: CARD_H - GRID_ROW_H + 16,
      }}
    >
      {items.map((item) => (
        <div
          key={item.id}
          data-testid="deck-card-tile"
          className="relative flex hover:z-20 focus-within:z-20"
          style={{ height: CARD_H, width: CARD_W + actionsW }}
        >
          <CardImage item={item} preview={preview} actionsW={actionsW} />
          {actionsW ? (
            <div className="bg-surface-container-lowest" style={{ width: actionsW }}>
              {item.renderActions("column")}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Ações da carta ativa (pairada) ficam ao lado dela; as demais só mostram a faixa do título. */
function CardStack({ items, preview, actionsW }: { items: DeckViewItem[]; preview: Preview; actionsW: number }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const active = actionsW && activeIndex >= 0 ? items[activeIndex] : null;
  const height = items.length ? (items.length - 1) * STACK_OFFSET + CARD_H : 0;

  return (
    <div
      className="relative"
      data-testid="deck-card-stack"
      style={{ width: CARD_W + actionsW, height }}
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
          <CardImage item={item} preview={preview} actionsW={actionsW} />
        </div>
      ))}
      {active ? (
        <div
          className="absolute bg-surface-container-lowest"
          style={{ left: CARD_W, top: activeIndex * STACK_OFFSET, width: actionsW, zIndex: items.length + 1 }}
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
