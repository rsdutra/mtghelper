"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { CardMetaModal } from "@/components/card-meta-modal";
import { TagCreateModal } from "@/components/card-tags";
import { DeckBuildTools } from "@/components/deck-build-tools/deck-build-tools";
import { DeckCanvas, type DeckCanvasHandle } from "@/components/deck-canvas";
import { DeckCoverageBadge } from "@/components/deck-coverage-badge";
import { DeckEditHeader } from "@/components/deck-detail/deck-edit-header";
import { DeckEditTools } from "@/components/deck-detail/deck-edit-tools";
import { DeckTagFilterPanel, TagDeleteModal, TagEditModal } from "@/components/deck-detail/deck-tag-filter";
import {
  DECK_VIEW_OPTIONS,
  deckHref,
  type CardRow,
  type DeckMode,
  type DeckView,
} from "@/components/deck-detail/deck-detail-types";
import { useDeckCardMutations } from "@/components/deck-detail/use-deck-card-mutations";
import { DeckExportMenu } from "@/components/deck-export-menu";
import { DeckStatsCharts } from "@/components/deck-stats-charts";
import { DeckCardActions } from "@/components/deck-views/deck-card-actions";
import { DeckCardView } from "@/components/deck-views/deck-card-view";
import {
  DECK_LIST_VIEWS,
  DECK_LIST_VIEW_STORAGE_KEY,
  parseDeckListView,
  type DeckListView,
  type DeckViewGroup,
  type DeckViewItem,
} from "@/components/deck-views/deck-view-types";
import { groupCardsByType } from "@/lib/card-types";
import type { DeckCoverageSummary } from "@/lib/deck-coverage";
import { evaluateDeckSize } from "@/lib/deck-size";
import { FORMATS, sideboardLimit } from "@/lib/formats";
import { groupCardsByManaCost } from "@/lib/mana-cost-groups";
import { formatBRLFromCents } from "@/lib/money-br";
import { addTag, collectTags, groupCardsByTag, sameTag, toggleTag, type CardTag } from "@/lib/tags";

/** Agrupamentos exclusivos da lista “No deck”: tipo (US-004-07), custo (US-004-11), tag (US-013-05). */
type GroupMode = "none" | "type" | "cost" | "tag";
const GROUP_MODES = ["type", "cost", "tag"] as const;
const GROUP_STORAGE_KEYS: Record<(typeof GROUP_MODES)[number], string> = {
  type: "mtghelper.deck.groupByType",
  cost: "mtghelper.deck.groupByCost",
  tag: "mtghelper.deck.groupByTag",
};
const GROUP_LABELS: Record<(typeof GROUP_MODES)[number], string> = {
  type: "Agrupar por tipo",
  cost: "Agrupar por custo",
  tag: "Agrupar por tag",
};

type Props = {
  deckId: string;
  mode: DeckMode;
  initialView: DeckView;
};

/**
 * Tela do deck compartilhada entre visualização (`/decks/[id]`) e edição (`/decks/[id]/edit`) — F-011.
 * A edição acrescenta cabeçalho editável, ações nas linhas, painel de ferramentas e canvas editável.
 */
export function DeckDetail({ deckId, mode, initialView }: Props) {
  const editing = mode === "edit";
  const [name, setName] = useState("");
  const [format, setFormat] = useState("commander");
  const [cards, setCards] = useState<CardRow[]>([]);
  const [coverage, setCoverage] = useState<DeckCoverageSummary | null>(null);
  const [view, setView] = useState<DeckView>(initialView);
  const isCanvasView = view !== "lista";
  const [status, setStatus] = useState("");
  const [groupMode, setGroupMode] = useState<GroupMode | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [listView, setListView] = useState<DeckListView | null>(null);
  const [canvasToolsOpen, setCanvasToolsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [chartsOpen, setChartsOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [buildToolsOpen, setBuildToolsOpen] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<CardTag | null>(null);
  const [deletingTag, setDeletingTag] = useState<CardTag | null>(null);
  const closeTagModals = useCallback(() => {
    setEditingTag(null);
    setDeletingTag(null);
  }, []);
  const [metaCard, setMetaCard] = useState<CardRow | null>(null);
  const [tagCard, setTagCard] = useState<CardRow | null>(null);
  const [canvasSnapshot, setCanvasSnapshot] = useState<unknown>(null);
  const [canvasLoadedView, setCanvasLoadedView] = useState<DeckView | null>(null);
  const canvasReady = isCanvasView && canvasLoadedView === view;
  const [canvasDirty, setCanvasDirty] = useState(false);
  const [canvasSaveState, setCanvasSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [canvasUpdatedAt, setCanvasUpdatedAt] = useState<string | null>(null);
  const canvasRef = useRef<DeckCanvasHandle | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/decks/${deckId}`);
    const data = await response.json();
    setName(data.deck.name);
    setFormat(data.deck.format);
    setCards(
      (data.cards ?? []).map((card: CardRow) => ({
        ...card,
        place: card.place === "side" || card.place === "out" ? card.place : "main",
      })),
    );
    setCoverage(data.coverage ?? null);
  }, [deckId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    // Mutuamente exclusivos: vale o primeiro salvo na ordem tipo, custo, tag.
    const saved = GROUP_MODES.find((mode) => window.localStorage.getItem(GROUP_STORAGE_KEYS[mode]) === "1");
    setGroupMode(saved ?? "none");
    setListView(parseDeckListView(window.localStorage.getItem(DECK_LIST_VIEW_STORAGE_KEY)));
  }, []);

  function changeListView(next: DeckListView) {
    setListView(next);
    window.localStorage.setItem(DECK_LIST_VIEW_STORAGE_KEY, next);
  }

  useEffect(() => {
    if (groupMode === null) return;
    for (const mode of GROUP_MODES) {
      window.localStorage.setItem(GROUP_STORAGE_KEYS[mode], groupMode === mode ? "1" : "0");
    }
  }, [groupMode]);

  useEffect(() => {
    if (view === "lista") {
      setCanvasLoadedView(null);
      return;
    }
    let cancelled = false;
    setCanvasLoadedView(null);
    void fetch(`/api/decks/${deckId}/canvas`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        setCanvasSnapshot(data.snapshot ?? null);
        setCanvasUpdatedAt(data.updatedAt ?? null);
        setCanvasLoadedView(view);
        setCanvasDirty(false);
        setCanvasSaveState("idle");
      })
      .catch(() => {
        if (cancelled) return;
        setCanvasSnapshot(null);
        setCanvasLoadedView(view);
      });
    return () => {
      cancelled = true;
    };
  }, [view, deckId]);

  useEffect(() => {
    if (!editing || !isCanvasView || !canvasReady) return;
    const timer = window.setInterval(() => {
      if (canvasRef.current?.isDirty()) void canvasRef.current.save();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [editing, isCanvasView, canvasReady]);

  useEffect(() => {
    if (!editing || !isCanvasView) return;
    function onBeforeUnload() {
      if (!canvasRef.current?.isDirty()) return;
      void canvasRef.current.save({ keepalive: true });
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (canvasRef.current?.isDirty()) void canvasRef.current.save({ keepalive: true });
    };
  }, [editing, isCanvasView]);

  async function switchView(next: DeckView) {
    if (next === view) return;
    if (canvasRef.current?.isDirty()) await canvasRef.current.save();
    setView(next);
    window.history.replaceState(null, "", deckHref(deckId, mode, next));
  }

  const mutations = useDeckCardMutations({ deckId, cards, setStatus, setCards, load });

  const knownTags = useMemo(() => collectTags(cards.map((card) => card.tags ?? [])), [cards]);
  const includedCards = useMemo(() => cards.filter((card) => card.place !== "out"), [cards]);
  const workingCards = useMemo(() => cards.filter((card) => card.place === "out"), [cards]);
  const allowsSideboard = sideboardLimit(format) != null;
  const mainCards = useMemo(
    () => includedCards.filter((card) => !allowsSideboard || card.place !== "side"),
    [includedCards, allowsSideboard],
  );
  const sideboardCards = useMemo(
    () => (allowsSideboard ? includedCards.filter((card) => card.place === "side") : []),
    [includedCards, allowsSideboard],
  );
  const activeTag = useMemo(
    () => (tagFilter ? (knownTags.find((tag) => sameTag(tag.name, tagFilter)) ?? null) : null),
    [knownTags, tagFilter],
  );
  const shownMain = useMemo(() => filterByTag(mainCards, activeTag?.name), [mainCards, activeTag]);
  const shownSideboard = useMemo(() => filterByTag(sideboardCards, activeTag?.name), [sideboardCards, activeTag]);
  const shownWorking = useMemo(() => filterByTag(workingCards, activeTag?.name), [workingCards, activeTag]);
  const groupedIncluded = useMemo(() => groupCardsByType(shownMain), [shownMain]);
  const groupedByCost = useMemo(() => groupCardsByManaCost(shownMain), [shownMain]);
  const groupedByTag = useMemo(() => groupCardsByTag(shownMain), [shownMain]);
  const sizeStatus = useMemo(() => {
    const sum = (rows: CardRow[]) => rows.reduce((total, card) => total + card.quantity, 0);
    return evaluateDeckSize(format, sum(mainCards), sum(sideboardCards));
  }, [format, mainCards, sideboardCards]);
  const formatLabel = FORMATS.find((item) => item.id === format)?.label ?? format;

  function toggleCollapsedGroup(group: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  const groupingToggles = (
    <div className="flex flex-wrap items-center gap-4 text-[13px] font-semibold">
      {GROUP_MODES.map((mode) => (
        <label key={mode} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={groupMode === mode}
            disabled={groupMode === null}
            onChange={(event) => setGroupMode(event.target.checked ? mode : "none")}
          />
          {GROUP_LABELS[mode]}
        </label>
      ))}
    </div>
  );

  function canvasStatusLabel() {
    if (canvasSaveState === "saving") return "Salvando…";
    if (canvasSaveState === "error") return "Erro ao salvar";
    if (canvasSaveState === "saved") return "Salvo";
    if (canvasDirty) return "Alterações não salvas";
    if (canvasUpdatedAt) return `Salvo ${new Date(canvasUpdatedAt).toLocaleString("pt-BR")}`;
    return "Sem alterações";
  }

  function toViewItem(card: CardRow): DeckViewItem {
    const label = card.name_pt ?? card.name_en;
    return {
      id: card.id,
      quantity: card.quantity,
      label,
      secondary: card.name_pt ? card.name_en : null,
      setCode: card.set_code || null,
      tags: card.tags ?? [],
      priceLabel: formatBRLFromCents(card.price_cents ?? null) || null,
      imageSrc: card.image_normal ?? card.image_small,
      thumbSrc: card.image_small ?? card.image_normal,
      renderActions: (layout) =>
        editing ? (
          <DeckCardActions
            layout={layout}
            label={label}
            quantity={card.quantity}
            onDecrement={() => void mutations.removeCard(card.id, card.place)}
            onIncrement={() => void mutations.addOneCopy(card)}
            onRemoveAll={() => void mutations.removeCard(card.id, card.place, true)}
            onInspect={() => setMetaCard(card)}
            coverage={
              card.place !== "out" && card.needed != null
                ? { owned: card.owned ?? 0, needed: card.needed, missing: card.missing ?? 0 }
                : null
            }
            allowsSideboard={allowsSideboard}
            onMove={(place) => void mutations.moveCard(card.id, card.place, place)}
            tags={card.tags ?? []}
            knownTags={knownTags}
            onToggleTag={(tag) => void mutations.updateCardTags(card.id, (current) => toggleTag(current, tag))}
            onNewTag={() => setTagCard(card)}
          />
        ) : null,
    };
  }

  const includedGroups: DeckViewGroup[] =
    groupMode === "type"
      ? groupedIncluded.map((bucket) => ({ key: bucket.group, label: bucket.label, items: bucket.cards.map(toViewItem) }))
      : groupMode === "cost"
        ? groupedByCost.map((bucket) => ({ key: bucket.key, label: bucket.label, items: bucket.cards.map(toViewItem) }))
        : groupMode === "tag"
          ? groupedByTag.map((bucket) => ({
              key: bucket.key,
              label: bucket.label,
              color: bucket.color,
              items: bucket.cards.map(toViewItem),
            }))
          : [{ key: "included", label: null, items: shownMain.map(toViewItem) }];
  const workingGroups: DeckViewGroup[] = [{ key: "working", label: null, items: shownWorking.map(toViewItem) }];

  const listViewSelect = (
    <label className="flex items-center gap-2 text-[13px]">
      Visualização
      <select
        aria-label="Visualização"
        value={listView ?? "texto"}
        disabled={listView === null}
        onChange={(event) => changeListView(event.target.value as DeckListView)}
        className="ui-input h-8 w-auto border-outline-variant"
      >
        {DECK_LIST_VIEWS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  const viewToggle = (
    <div className="inline-flex border border-outline-variant bg-surface-container-lowest p-0.5">
      {DECK_VIEW_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={view === option.id}
          onClick={() => void switchView(option.id)}
          className={`px-4 py-1.5 text-[12px] font-medium ${
            view === option.id ? "bg-ink font-semibold text-white" : "text-ink hover:bg-surface-container"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  const modeLink = editing ? (
    <Link href={deckHref(deckId, "view", view)} className="ui-btn-outline h-8">
      Concluir edição
    </Link>
  ) : (
    <Link href={deckHref(deckId, "edit", view)} className="ui-btn h-8">
      Editar
    </Link>
  );

  const deckTitle = (
    <>
      <h1 className="truncate text-[20px] leading-[26px] font-semibold tracking-tight text-ink">{name}</h1>
      <span className="ui-badge">{formatLabel}</span>
    </>
  );

  const metaModal = editing ? (
    <>
      <CardMetaModal
        open={Boolean(metaCard)}
        title={metaCard ? (metaCard.name_pt ?? metaCard.name_en) : ""}
        initial={{ priceCents: metaCard?.price_cents ?? null, note: metaCard?.note ?? "" }}
        onClose={() => setMetaCard(null)}
        onSave={async (values) => {
          if (!metaCard) return;
          await mutations.saveCardMeta(metaCard.id, values);
        }}
      />
      <TagCreateModal
        open={Boolean(tagCard)}
        known={knownTags}
        onClose={() => setTagCard(null)}
        onCreate={(tag) => {
          if (!tagCard) return;
          void mutations.updateCardTags(tagCard.id, (current, known) => addTag(current, tag, known));
        }}
      />
    </>
  ) : null;

  const tools = editing ? (
    <DeckEditTools
      deckId={deckId}
      allowsSideboard={allowsSideboard}
      status={status}
      setStatus={setStatus}
      addText={mutations.addText}
      reload={load}
    />
  ) : null;

  if (isCanvasView) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-background">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border-line bg-surface-container-lowest px-4">
          {viewToggle}
          <span className="truncate text-[13px] font-semibold text-ink">{name}</span>
          <span className="ui-badge">{formatLabel}</span>
          <DeckSizeStatus status={sizeStatus} />
          <DeckCoverageBadge coverage={coverage} />
          <div className="ml-auto flex items-center gap-3">
            {editing ? groupingToggles : null}
            {editing ? (
              <span className="font-mono text-[10px] tracking-wide text-muted uppercase">{canvasStatusLabel()}</span>
            ) : null}
            <DeckExportMenu cards={cards} buttonClassName="ui-btn-outline h-8" menuAlign="right" />
            {editing ? (
              <button
                type="button"
                className="ui-btn-outline h-8 disabled:opacity-50"
                disabled={!canvasReady || canvasSaveState === "saving"}
                onClick={() => void canvasRef.current?.save()}
              >
                Salvar
              </button>
            ) : null}
            {modeLink}
          </div>
        </header>
        <div className="relative min-h-0 flex-1">
          {canvasReady ? (
            <DeckCanvas
              key={`${deckId}-canvas-${mode}`}
              ref={canvasRef}
              initialSnapshot={canvasSnapshot}
              deckId={deckId}
              cards={cards}
              sections={[]}
              readOnly={!editing}
              onDirtyChange={setCanvasDirty}
              onDomainChange={() => void load()}
              onEditCardMeta={
                editing
                  ? (catalogId: string) => {
                      const card = cards.find((item) => item.id === catalogId);
                      if (card) setMetaCard(card);
                    }
                  : undefined
              }
              onSaveState={(state, updatedAt) => {
                setCanvasSaveState(state);
                if (updatedAt) setCanvasUpdatedAt(updatedAt);
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500">Carregando canvas…</div>
          )}
          {editing && canvasToolsOpen ? (
            <aside className="absolute top-4 right-4 bottom-4 z-50 w-80 overflow-auto border border-ink bg-surface-container-lowest/95 p-4 shadow-[4px_4px_0_#09090b] backdrop-blur">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="ui-label text-ink">Ferramentas</h2>
                <button type="button" className="ui-btn-outline h-7 px-2 text-[11px]" onClick={() => setCanvasToolsOpen(false)}>
                  Fechar
                </button>
              </div>
              {tools}
            </aside>
          ) : null}
          {editing ? (
            <button
              type="button"
              className={`absolute top-1/2 z-[60] -translate-y-1/2 border border-ink bg-surface-container-lowest px-3 py-3 text-[13px] shadow-[4px_4px_0_#09090b] transition-[right] ${
                canvasToolsOpen ? "right-[21.5rem]" : "right-4"
              }`}
              aria-expanded={canvasToolsOpen}
              aria-label={canvasToolsOpen ? "Fechar painel de busca" : "Abrir painel de busca"}
              onClick={() => setCanvasToolsOpen((open) => !open)}
            >
              {canvasToolsOpen ? "›" : "Buscar"}
            </button>
          ) : null}
        </div>
        {metaModal}
      </div>
    );
  }

  const includedCount = mainCards.reduce((total, card) => total + card.quantity, 0);
  const sideboardCount = sideboardCards.reduce((total, card) => total + card.quantity, 0);
  const workingCount = workingCards.reduce((total, card) => total + card.quantity, 0);
  const sideboardGroups: DeckViewGroup[] = [{ key: "sideboard", label: null, items: shownSideboard.map(toViewItem) }];
  const filteredOut = activeTag ? (
    <p className="px-4 py-4 text-[13px] text-muted">Nenhuma carta com a tag {activeTag.name}.</p>
  ) : null;

  const deckPanel = (
    <ListPanel title="No deck" count={includedCount}>
      {mainCards.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-muted">
          Nenhuma carta incluída.{editing ? "" : " Use Editar para adicionar cartas."}
        </p>
      ) : shownMain.length === 0 ? (
        filteredOut
      ) : listView ? (
        <DeckCardView
          view={listView}
          groups={includedGroups}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleCollapsedGroup}
          readOnly={!editing}
        />
      ) : null}
    </ListPanel>
  );

  const sideboardPanel = allowsSideboard ? (
    <ListPanel
      title="Sideboard"
      count={sideboardCount}
      limit={sizeStatus.sideboardLimit ?? undefined}
      over={sizeStatus.overSideboard}
      note="Teto próprio de 15. Entra na coleção junto com o deck."
    >
      {sideboardCards.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-muted">Nenhuma carta no sideboard.</p>
      ) : shownSideboard.length === 0 ? (
        filteredOut
      ) : listView ? (
        <DeckCardView
          view={listView}
          groups={sideboardGroups}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleCollapsedGroup}
          readOnly={!editing}
        />
      ) : null}
    </ListPanel>
  ) : null;

  const workingPanel =
    editing || workingCards.length ? (
      <ListPanel
        title="Fora do deck"
        count={workingCount}
        dashed
        note="Cartas para upgrade, corte ou consideração — ainda não entram no deck."
      >
        {workingCards.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-muted">Nenhuma carta fora do deck.</p>
        ) : shownWorking.length === 0 ? (
          filteredOut
        ) : listView ? (
          <DeckCardView
            view={listView}
            groups={workingGroups}
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleCollapsedGroup}
            readOnly={!editing}
          />
        ) : null}
      </ListPanel>
    ) : null;

  const tagsButton = (
    <ToggleIconButton label="Tags" pressed={tagsOpen} onClick={() => setTagsOpen((open) => !open)}>
      <TagIcon />
    </ToggleIconButton>
  );
  const tagsPanelRight = 4.5 + (editing && toolsOpen ? 20.5 : 0) + (editing && chartsOpen ? 26.5 : 0);
  const tagsPanel = tagsOpen ? (
    <>
      <aside
        className="fixed top-20 z-40 max-h-[calc(100vh-6rem)] w-72 overflow-auto border border-ink bg-surface-container-lowest p-4 shadow-[4px_4px_0_#09090b]"
        style={{ right: `${tagsPanelRight}rem` }}
      >
        <DeckTagFilterPanel
          tags={knownTags}
          active={activeTag?.name ?? null}
          onSelect={setTagFilter}
          onClear={() => setTagFilter(null)}
          onEdit={editing ? setEditingTag : undefined}
          onDelete={editing ? setDeletingTag : undefined}
        />
      </aside>
      {editing && editingTag ? (
        <TagEditModal
          key={editingTag.name}
          tag={editingTag}
          onClose={closeTagModals}
          onSave={async (next) => {
            const error = await mutations.renameDeckTag(editingTag.name, next);
            if (!error && activeTag && sameTag(activeTag.name, editingTag.name)) setTagFilter(next.name);
            return error;
          }}
        />
      ) : null}
      {editing && deletingTag ? (
        <TagDeleteModal
          key={deletingTag.name}
          tag={deletingTag}
          onClose={closeTagModals}
          onConfirm={async () => {
            const deleted = await mutations.deleteDeckTag(deletingTag.name);
            if (deleted && activeTag && sameTag(activeTag.name, deletingTag.name)) setTagFilter(null);
          }}
        />
      ) : null}
    </>
  ) : null;

  const buildToolsButton = (
    <ToggleIconButton
      label="Ferramentas de construção"
      pressed={buildToolsOpen}
      onClick={() => setBuildToolsOpen((open) => !open)}
    >
      <BuildToolsIcon />
    </ToggleIconButton>
  );
  const buildToolsPanel = buildToolsOpen ? (
    <aside
      className="fixed top-20 z-40 max-h-[calc(100vh-6rem)] w-[24rem] overflow-auto border border-ink bg-surface-container-lowest p-4 shadow-[4px_4px_0_#09090b]"
      style={{ right: `${tagsPanelRight + (tagsOpen ? 18.5 : 0)}rem` }}
    >
      <DeckBuildTools cards={includedCards} />
    </aside>
  ) : null;

  return (
    <AppShell wide>
      <div className="space-y-4 pr-12">
        <div className="flex flex-col gap-4 border-b border-outline-variant pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            {editing ? (
              <DeckEditHeader
                deckId={deckId}
                name={name}
                format={format}
                onNameChange={setName}
                onFormatChange={setFormat}
                onSaved={() => void load()}
              />
            ) : (
              deckTitle
            )}
            <DeckExportMenu cards={cards} />
            <DeckSizeStatus status={sizeStatus} />
            <DeckCoverageBadge coverage={coverage} />
          </div>
          <div className="flex items-center gap-2 self-start lg:self-auto">
            {modeLink}
            {viewToggle}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {groupingToggles}
            {editing ? (
              <span className="hidden font-mono text-[10px] tracking-[0.04em] text-on-surface-variant md:inline">
                Só “No deck”. Os modos são exclusivos.
              </span>
            ) : null}
            {activeTag ? (
              <span className="flex items-center gap-1.5 text-[13px] font-semibold" data-testid="deck-tag-filter-active">
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 rounded-full border border-ink"
                  style={{ backgroundColor: activeTag.color }}
                />
                Filtrando pela tag {activeTag.name}
              </span>
            ) : null}
          </div>
          {listViewSelect}
        </div>

        {editing ? (
          <div className="relative min-w-0 space-y-5">
            {deckPanel}
            {sideboardPanel}
            {workingPanel}
            <div className="fixed top-20 right-4 z-40 flex flex-col gap-2">
              <ToggleIconButton
                label="Busca"
                pressed={toolsOpen}
                onClick={() => setToolsOpen((open) => !open)}
              >
                <SearchIcon />
              </ToggleIconButton>
              <ToggleIconButton
                label="Gráficos"
                pressed={chartsOpen}
                onClick={() => setChartsOpen((open) => !open)}
              >
                <ChartIcon />
              </ToggleIconButton>
              {tagsButton}
              {buildToolsButton}
            </div>
            {toolsOpen ? (
              <aside className="fixed top-20 right-16 z-40 max-h-[calc(100vh-6rem)] w-80 overflow-auto border border-ink bg-surface-container-lowest p-4 shadow-[4px_4px_0_#09090b]">
                {tools}
              </aside>
            ) : null}
            {chartsOpen ? (
              <aside
                className="fixed top-20 z-40 max-h-[calc(100vh-6rem)] w-[26rem] overflow-auto border border-ink bg-surface-container-lowest p-4 shadow-[4px_4px_0_#09090b]"
                style={{ right: toolsOpen ? "25rem" : "4.5rem" }}
              >
                <DeckStatsCharts cards={includedCards} stacked />
              </aside>
            ) : null}
            {tagsPanel}
            {buildToolsPanel}
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-5">
              {deckPanel}
              {sideboardPanel}
              {workingPanel}
            </div>
            <aside className="min-w-0">
              <DeckStatsCharts cards={includedCards} stacked />
            </aside>
            <div className="fixed top-20 right-4 z-40 flex flex-col gap-2">
              {tagsButton}
              {buildToolsButton}
            </div>
            {tagsPanel}
            {buildToolsPanel}
          </div>
        )}
      </div>
      {metaModal}
    </AppShell>
  );
}

function DeckSizeStatus({ status }: { status: ReturnType<typeof evaluateDeckSize> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
      <span
        className={`font-mono tabular-nums ${status.overMain ? "font-semibold text-danger" : "text-muted"}`}
      >
        Deck {status.mainCount}/{status.mainLimit}
      </span>
      {status.sideboardLimit != null ? (
        <span className={`font-mono tabular-nums ${status.overSideboard ? "font-semibold text-danger" : "text-muted"}`}>
          Sideboard {status.sideboardCount}/{status.sideboardLimit}
        </span>
      ) : null}
      {status.messages.map((message) => (
        <span key={message} className="font-semibold text-danger">
          {message}
        </span>
      ))}
    </div>
  );
}

function ToggleIconButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center border border-ink shadow-[3px_3px_0_#09090b] ${
        pressed ? "bg-ink text-white" : "bg-surface-container-lowest text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16.5 20 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 15v-3M12 15V8M16 15v-5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="miter" />
      <circle cx="8" cy="8.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

function BuildToolsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 4v8l6.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="miter" />
    </svg>
  );
}

function filterByTag(cards: CardRow[], tagName: string | undefined) {
  if (!tagName) return cards;
  return cards.filter((card) => (card.tags ?? []).some((tag) => sameTag(tag.name, tagName)));
}

function ListPanel({
  title,
  count,
  limit,
  over = false,
  note,
  dashed = false,
  children,
}: {
  title: string;
  count: number;
  limit?: number;
  over?: boolean;
  note?: string;
  dashed?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`border bg-surface-container-lowest ${
        dashed ? "border-dashed border-neutral-400" : "border-outline-variant"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant bg-surface-container px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="font-mono text-[12px] font-bold tracking-wide text-ink uppercase">{title}</h2>
          <span
            className={`bg-surface-container-high px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
              over ? "text-danger" : "text-on-surface"
            }`}
          >
            ({limit != null ? `${count}/${limit}` : count})
          </span>
        </div>
        {note ? <span className="font-mono text-[10px] text-on-surface-variant">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}
