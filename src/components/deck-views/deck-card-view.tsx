"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useCardHoverPreview } from "@/components/card-hover-preview";
import { TagDots, TagQuantityFill } from "@/components/card-tags";
import { ManaCost } from "@/components/mana-cost";
import { ESTIMATED_PRICE_HINT } from "@/lib/estimated-price";
import {
  LIST_PREVIEW_DELAY_MS,
  type DeckListView,
  type DeckViewGroup,
  type DeckViewItem,
} from "@/components/deck-views/deck-view-types";

const CARD_W = 210;
const CARD_H = Math.round((CARD_W * 88) / 63);
/** Grid visual: quantidade à direita da faixa do nome. */
const CHIP_TOP = Math.round((37 / 241) * CARD_H);
const CHIP_RIGHT = Math.round(((182 - 162) / 182) * CARD_W);
/** Onde o nome começa numa carta moderna. */
const NAME_START_X = Math.round((20 / 488) * CARD_W);
/** Três pontos: mesma linha da quantidade do grid visual, à esquerda e dentro da imagem. */
const MENU_LEFT = 8;
/** Grid agrupada: três pontos na linha da quantidade, espelhados no lado direito da carta. */
const STACK_MENU_RIGHT = NAME_START_X + 8;
const chipClass =
  "flex h-6 items-center justify-center rounded-[4px] bg-black font-mono text-[12px] font-bold leading-none text-white";
/** Grid visual: cada linha cobre a metade de baixo da anterior (US-010-03). */
const GRID_ROW_H = Math.round(CARD_H / 2);
/** Grid agrupada: faixa visível de cada carta, o suficiente para o título (US-010-04). */
const STACK_OFFSET = 44;
const STACK_MAX = 12;

type Preview = ReturnType<typeof useCardHoverPreview>;

type Props = {
  view: DeckListView;
  groups: DeckViewGroup[];
  collapsedGroups: ReadonlySet<string>;
  onToggleGroup: (key: string) => void;
  /**
   * View Texto com preview fixo ao lado (F-017, e na visualização pela US-011-06): sem preview flutuante.
   * O painel ao lado recebe `onPreviewCard`.
   */
  sidePreview?: boolean;
  previewCardId?: string | null;
  onPreviewCard?: (id: string) => void;
  /** Itens do menu “Exibir” (F-017 / F-019); valem só para a view Texto. */
  showManaCost?: boolean;
  showTags?: boolean;
  showPrice?: boolean;
};

/** Renderiza cartas do deck como Texto, Grid visual ou Grid visual agrupada (F-010). */
export function DeckCardView({
  view,
  groups,
  collapsedGroups,
  onToggleGroup,
  sidePreview = false,
  previewCardId = null,
  onPreviewCard,
  showManaCost = false,
  showTags = false,
  showPrice = false,
}: Props) {
  const preview = useCardHoverPreview(LIST_PREVIEW_DELAY_MS);
  const grouped = groups.some((group) => group.label !== null);
  const pinPreview = sidePreview && view === "texto";

  function body(items: DeckViewItem[]) {
    return <CardGrid items={items} preview={preview} />;
  }

  let content: ReactNode;
  if (view === "texto") {
    content = (
      <CompactColumns
        groups={groups}
        grouped={grouped}
        collapsedGroups={collapsedGroups}
        onToggleGroup={onToggleGroup}
        preview={pinPreview ? null : preview}
        previewCardId={pinPreview ? previewCardId : null}
        onPreviewCard={pinPreview ? onPreviewCard : undefined}
        options={{ mana: showManaCost, tags: showTags, price: showPrice }}
        optionsPinned={false}
      />
    );
  } else if (view === "pilhas") {
    const columns = grouped
      ? groups
      : chunk(
          groups.flatMap((group) => group.items),
          STACK_MAX,
        ).map((items, index): DeckViewGroup => ({ key: `stack-${index}`, label: null, items }));
    content = (
      <div className="flex flex-wrap items-start gap-x-10 gap-y-6 p-4 pl-10">
        {columns.map((column) => {
          const collapsed = column.label !== null && collapsedGroups.has(column.key);
          return (
            <div key={column.key} style={{ width: CARD_W }}>
              {column.label !== null ? (
                <StackHeader
                  label={column.label}
                  color={column.color}
                  items={column.items}
                  collapsed={collapsed}
                  onToggle={() => onToggleGroup(column.key)}
                />
              ) : null}
              {collapsed ? null : <CardStack items={column.items} preview={preview} />}
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
            color={group.color}
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
      {pinPreview ? null : preview.overlay}
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

function GroupDot({ color }: { color?: string | null }) {
  if (!color) return null;
  return (
    <span
      aria-hidden
      data-testid="group-tag-dot"
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-ink"
      style={{ backgroundColor: color }}
    />
  );
}

type HeaderProps = {
  label: string;
  color?: string | null;
  items: DeckViewItem[];
  collapsed: boolean;
  onToggle: () => void;
};

/** Acordeão do layout Stitch “Detalhes do Deck” (F-011 / US-011-01). */
function AccordionHeader({ label, color, items, collapsed, onToggle }: HeaderProps) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 border-b border-surface-variant bg-surface px-4 py-2 text-left hover:bg-surface-container-low"
      aria-expanded={!collapsed}
      onClick={onToggle}
    >
      <Chevron collapsed={collapsed} />
      <GroupDot color={color} />
      <span className="flex-1 truncate text-[15px] font-semibold tracking-tight text-ink">{label}</span>
      <span className="font-mono text-[10px] font-semibold text-on-surface-variant">{groupQuantity(items)}</span>
    </button>
  );
}

function StackHeader({ label, color, items, collapsed, onToggle }: HeaderProps) {
  return (
    <button
      type="button"
      className="mb-2 flex w-full items-center gap-1 border border-outline-variant bg-surface-container-low px-2 py-1.5 text-left text-[11px] font-semibold uppercase"
      aria-expanded={!collapsed}
      onClick={onToggle}
    >
      <Chevron collapsed={collapsed} />
      <GroupDot color={color} />
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
  previewCardId,
  onPreviewCard,
  options,
  optionsPinned,
}: {
  groups: DeckViewGroup[];
  grouped: boolean;
  collapsedGroups: ReadonlySet<string>;
  onToggleGroup: (key: string) => void;
  preview: Preview | null;
  previewCardId: string | null;
  onPreviewCard?: (id: string) => void;
  options: RowOptions;
  optionsPinned: boolean;
}) {
  const columnWidth = `${COLUMN_BASE_REM + (options.tags ? TAGS_COLUMN_REM : 0) + (options.mana ? MANA_COLUMN_REM : 0) + (options.price ? PRICE_COLUMN_REM : 0)}rem`;
  const gridTemplateColumns = rowTemplate(options);
  function row(item: DeckViewItem) {
    return (
      <CompactRow
        key={item.id}
        item={item}
        preview={preview}
        selected={previewCardId === item.id}
        options={options}
        gridTemplateColumns={gridTemplateColumns}
        optionsPinned={optionsPinned}
        onActivate={onPreviewCard}
      />
    );
  }
  if (!grouped) {
    return (
      <ul className="gap-x-8 px-4 py-3" style={{ columnWidth }}>
        {groups.flatMap((group) => group.items).map(row)}
      </ul>
    );
  }
  return (
    <div className="gap-x-8 px-4 py-3" style={{ columnWidth }}>
      {groups.map((group) => {
        const collapsed = collapsedGroups.has(group.key);
        return (
          <div key={group.key} data-testid="deck-text-group" className="mb-4 break-inside-avoid">
            <button
              type="button"
              className="flex w-full items-center gap-1 border-b border-outline-variant pb-1 text-left text-[13px] font-semibold text-ink"
              aria-expanded={!collapsed}
              onClick={() => onToggleGroup(group.key)}
            >
              <GroupDot color={group.color} />
              <span className="truncate">{group.label}</span>
              <span className="font-normal text-muted">({groupQuantity(group.items)})</span>
              <Chevron collapsed={collapsed} />
            </button>
            {collapsed ? null : <ul className="pt-1">{group.items.map(row)}</ul>}
          </div>
        );
      })}
    </div>
  );
}

type RowOptions = { mana: boolean; tags: boolean; price: boolean };

/** Largura mínima de cada coluna do texto condensado; cada item do “Exibir” soma a sua coluna. */
const COLUMN_BASE_REM = 13.5;
const TAGS_COLUMN_REM = 1.75;
const MANA_COLUMN_REM = 7;
const PRICE_COLUMN_REM = 5.25;

function rowTemplate(options: RowOptions) {
  return [
    options.tags ? `${TAGS_COLUMN_REM}rem` : null,
    "1.5rem",
    "minmax(0,1fr)",
    options.mana ? "6.5rem" : null,
    options.price ? "4.75rem" : null,
    "1rem",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Os três pontos ficam fora da área do preview, para a imagem ampliada não cobrir o menu. */
function CompactRow({
  item,
  preview,
  selected = false,
  options,
  gridTemplateColumns,
  optionsPinned = false,
  onActivate,
}: {
  item: DeckViewItem;
  preview: Preview | null;
  selected?: boolean;
  options: RowOptions;
  gridTemplateColumns: string;
  optionsPinned?: boolean;
  onActivate?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li
      className={`group grid items-center gap-x-1.5 break-inside-avoid px-1 py-[3px] text-[13px] leading-5 hover:bg-surface-container-low ${
        selected ? "bg-surface-container" : ""
      }`}
      style={{ gridTemplateColumns }}
      data-testid="deck-card-text"
      data-active={selected ? "true" : undefined}
      onPointerEnter={() => onActivate?.(item.id)}
      onFocusCapture={() => onActivate?.(item.id)}
    >
      {options.tags ? (
        <span className="flex justify-end overflow-hidden">
          <TagDots tags={item.tags} />
        </span>
      ) : null}
      <span
        aria-label={`Quantidade de ${item.label}`}
        className="text-right font-mono text-[12px] tabular-nums text-muted"
      >
        {item.quantity}
      </span>
      <span
        className="min-w-0 truncate"
        {...(preview ? preview.bind(item.id, item.imageSrc, item.label) : {})}
      >
        {item.label}
      </span>
      {options.mana ? (
        <span className="flex justify-end">{item.manaCost ? <ManaCost cost={item.manaCost} /> : null}</span>
      ) : null}
      {options.price ? (
        <span
          title={ESTIMATED_PRICE_HINT}
          data-testid="deck-card-price"
          className="text-right font-mono text-[12px] whitespace-nowrap tabular-nums text-muted"
        >
          {item.estimatedPriceLabel ?? "—"}
        </span>
      ) : null}
      <CardOptionsMenu item={item} placement="row" open={open} onOpenChange={setOpen} pinned={optionsPinned} />
    </li>
  );
}

function CardImage({ item, preview }: { item: DeckViewItem; preview: Preview }) {
  return (
    <div className="relative shrink-0" style={{ width: CARD_W, height: CARD_H }}>
      <div
        className="h-full w-full overflow-hidden rounded-[6px] border border-ink bg-surface-container"
        {...preview.bind(item.id, item.imageSrc, item.label)}
      >
        {item.imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageSrc} alt={item.label} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="block p-2 text-[11px] font-medium">{item.label}</span>
        )}
      </div>
    </div>
  );
}

function CardQuantity({ item, place }: { item: DeckViewItem; place: "title-right" | "name-left" }) {
  const onName = place === "name-left";
  return (
    <span
      aria-label={`Quantidade de ${item.label}`}
      className={`${chipClass} absolute min-w-7 overflow-hidden ${onName ? "-translate-x-full" : ""}`}
      style={onName ? { top: 0, left: NAME_START_X + 8 } : { top: CHIP_TOP, right: CHIP_RIGHT }}
    >
      <TagQuantityFill tags={item.tags} />
      <span className="relative">x{item.quantity}</span>
    </span>
  );
}

function CardGrid({ items, preview }: { items: DeckViewItem[]; preview: Preview }) {
  return (
    <div
      className="grid gap-x-4 p-4"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_W}px, 1fr))`,
        gridAutoRows: GRID_ROW_H,
        paddingBottom: CARD_H - GRID_ROW_H + 16,
      }}
    >
      {items.map((item) => (
        <GridTile key={item.id} item={item} preview={preview} />
      ))}
    </div>
  );
}

function GridTile({ item, preview }: { item: DeckViewItem; preview: Preview }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      data-testid="deck-card-tile"
      className={`group relative ${open ? "z-30" : "z-0"}`}
      style={{ height: CARD_H, width: CARD_W }}
    >
      <CardImage item={item} preview={preview} />
      <CardQuantity item={item} place="title-right" />
      <CardOptionsMenu item={item} open={open} onOpenChange={setOpen} />
    </div>
  );
}

/** Ações da carta ativa (pairada) ficam ao lado dela; as demais só mostram a faixa do título. */
function CardStack({ items, preview }: { items: DeckViewItem[]; preview: Preview }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const height = items.length ? (items.length - 1) * STACK_OFFSET + CARD_H : 0;

  return (
    <div className="relative" data-testid="deck-card-stack" style={{ width: CARD_W, height }}>
      {items.map((item, index) => (
        <div
          key={item.id}
          data-testid="deck-card-tile"
          className="group absolute left-0"
          style={{
            top: index * STACK_OFFSET,
            zIndex: openId === item.id ? items.length + 2 : index,
          }}
        >
          <CardImage item={item} preview={preview} />
          <CardQuantity item={item} place="name-left" />
          <CardOptionsMenu
            item={item}
            placement="stack"
            open={openId === item.id}
            onOpenChange={(open) => setOpenId(open ? item.id : null)}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Na grid agrupada, as cartas de trás cobririam os pontos: só a carta pairada (ou com menu aberto) mostra.
 * Na linha do texto condensado (visualização), os pontos ficam no fim da linha e também só aparecem ao pairar.
 */
function CardOptionsMenu({
  item,
  open,
  onOpenChange,
  placement = "grid",
  pinned = false,
}: {
  item: DeckViewItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placement?: "grid" | "stack" | "row";
  /** Reserva o espaço do ícone mesmo quando ele só aparece no hover. */
  pinned?: boolean;
}) {
  const stack = placement === "stack";
  const row = placement === "row";
  const hoverOnly = pinned || open ? "visible" : "invisible group-hover:visible group-has-[:focus-visible]:visible";
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      onOpenChange(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const menu = open ? (
    <div
      ref={menuRef}
      className={
        row
          ? "fixed z-[80] max-h-[min(24rem,calc(100vh-1rem))] w-44 overflow-auto border border-ink bg-surface-container-lowest p-1 shadow-[4px_4px_0_#09090b]"
          : "absolute top-full z-40 mt-1 w-44 border border-ink bg-surface-container-lowest p-1 shadow-[4px_4px_0_#09090b]"
      }
      style={row ? (menuPos ?? { top: 0, left: 0 }) : { left: 0 }}
    >
      {item.renderActions("menu")}
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={row ? `relative shrink-0 ${hoverOnly}` : stack ? `absolute translate-x-full ${hoverOnly}` : "absolute"}
      style={row ? undefined : stack ? { top: 0, right: STACK_MENU_RIGHT } : { top: CHIP_TOP, left: MENU_LEFT }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Opções de ${item.label}`}
        aria-expanded={open}
        className={`flex ${row ? "h-5 w-4" : "h-6 w-5"} flex-col items-center justify-center gap-0.5 rounded-[4px] bg-black`}
        onClick={(event) => {
          event.stopPropagation();
          if (open) {
            onOpenChange(false);
            return;
          }
          if (row && buttonRef.current) setMenuPos(menuPosition(buttonRef.current.getBoundingClientRect()));
          onOpenChange(true);
        }}
      >
        <span className="h-[3px] w-[3px] rounded-full bg-white" />
        <span className="h-[3px] w-[3px] rounded-full bg-white" />
        <span className="h-[3px] w-[3px] rounded-full bg-white" />
      </button>
      {row ? (open && menuPos && typeof document !== "undefined" ? createPortal(menu, document.body) : null) : menu}
    </div>
  );
}

/** O menu da linha sai das colunas CSS, que quebram um painel absoluto alto (F-017). */
function menuPosition(rect: DOMRect) {
  const width = 176;
  const margin = 8;
  let left = rect.right - width;
  if (left < margin) left = margin;
  if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
  let top = rect.bottom + 4;
  const estimated = 280;
  if (top + estimated > window.innerHeight - margin) top = Math.max(margin, rect.top - estimated);
  return { top, left };
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}
