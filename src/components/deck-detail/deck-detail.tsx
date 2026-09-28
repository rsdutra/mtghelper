"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { CardMetaModal } from "@/components/card-meta-modal";
import { DeckCanvas, type DeckCanvasHandle } from "@/components/deck-canvas";
import { DeckCoverageBadge } from "@/components/deck-coverage-badge";
import { DeckEditHeader } from "@/components/deck-detail/deck-edit-header";
import { DeckEditTools } from "@/components/deck-detail/deck-edit-tools";
import {
  DECK_VIEW_OPTIONS,
  deckHref,
  normalizeSectionIds,
  type CardRow,
  type DeckMode,
  type DeckView,
  type Section,
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
import { FORMATS } from "@/lib/formats";
import { groupCardsByManaCost } from "@/lib/mana-cost-groups";
import { formatBRLFromCents } from "@/lib/money-br";

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
  const [sections, setSections] = useState<Section[]>([]);
  const [view, setView] = useState<DeckView>(initialView);
  const isCanvasView = view !== "lista";
  const [status, setStatus] = useState("");
  const [groupByType, setGroupByType] = useState<boolean | null>(null);
  const [groupByCost, setGroupByCost] = useState<boolean | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [listView, setListView] = useState<DeckListView | null>(null);
  const [autoSectionsSyncing, setAutoSectionsSyncing] = useState(false);
  const [canvasToolsOpen, setCanvasToolsOpen] = useState(false);
  const [metaCard, setMetaCard] = useState<CardRow | null>(null);
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
      (data.cards ?? []).map((card: CardRow & { section_ids?: unknown }) => ({
        ...card,
        included: Boolean(card.included),
        section_ids: normalizeSectionIds(card.section_ids),
      })),
    );
    setSections(data.sections ?? []);
    setCoverage(data.coverage ?? null);
  }, [deckId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const savedType = window.localStorage.getItem("mtghelper.deck.groupByType");
    const savedCost = window.localStorage.getItem("mtghelper.deck.groupByCost");
    // Mutuamente exclusivos: tipo tem prioridade se ambos estiverem salvos.
    if (savedType === "1") {
      setGroupByType(true);
      setGroupByCost(false);
    } else if (savedCost === "1") {
      setGroupByType(false);
      setGroupByCost(true);
    } else {
      setGroupByType(false);
      setGroupByCost(false);
    }
    setListView(parseDeckListView(window.localStorage.getItem(DECK_LIST_VIEW_STORAGE_KEY)));
  }, []);

  function changeListView(next: DeckListView) {
    setListView(next);
    window.localStorage.setItem(DECK_LIST_VIEW_STORAGE_KEY, next);
  }

  useEffect(() => {
    if (groupByType === null || groupByCost === null) return;
    window.localStorage.setItem("mtghelper.deck.groupByType", groupByType ? "1" : "0");
    window.localStorage.setItem("mtghelper.deck.groupByCost", groupByCost ? "1" : "0");
    // Visualização só reagrupa no cliente; seções automáticas são sincronizadas na edição.
    if (!editing) return;
    let cancelled = false;
    setAutoSectionsSyncing(true);
    void (async () => {
      const typeRes = await fetch(`/api/decks/${deckId}/type-sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: groupByType }),
      });
      const costRes = await fetch(`/api/decks/${deckId}/cost-sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: groupByCost }),
      });
      if (cancelled) return;
      if (typeRes.ok && costRes.ok) await load();
      if (!cancelled) setAutoSectionsSyncing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [groupByType, groupByCost, deckId, load, editing]);

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

  async function ensureAutoSections() {
    if (!groupByType && !groupByCost) return;
    const kind = groupByType ? "type-sections" : "cost-sections";
    const response = await fetch(`/api/decks/${deckId}/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });
    if (response.ok) await load();
  }

  const mutations = useDeckCardMutations({ deckId, sections, setCards, setStatus, load, ensureAutoSections });

  const includedCards = useMemo(() => cards.filter((card) => card.included), [cards]);
  const workingCards = useMemo(() => cards.filter((card) => !card.included), [cards]);
  const groupedIncluded = useMemo(() => groupCardsByType(includedCards), [includedCards]);
  const groupedByCost = useMemo(() => groupCardsByManaCost(includedCards), [includedCards]);
  const userSections = useMemo(
    () => sections.filter((section) => section.kind !== "type" && section.kind !== "cost"),
    [sections],
  );
  const formatLabel = FORMATS.find((item) => item.id === format)?.label ?? format;

  function toggleCollapsedGroup(group: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  function enableGroupByType(checked: boolean) {
    setGroupByType(checked);
    if (checked) setGroupByCost(false);
  }

  function enableGroupByCost(checked: boolean) {
    setGroupByCost(checked);
    if (checked) setGroupByType(false);
  }

  const groupingToggles = (
    <div className="flex flex-wrap items-center gap-4 text-[13px] font-semibold">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(groupByType)}
          disabled={groupByType === null || autoSectionsSyncing}
          onChange={(event) => enableGroupByType(event.target.checked)}
        />
        Agrupar por tipo{autoSectionsSyncing && groupByType ? "…" : ""}
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(groupByCost)}
          disabled={groupByCost === null || autoSectionsSyncing}
          onChange={(event) => enableGroupByCost(event.target.checked)}
        />
        Agrupar por custo{autoSectionsSyncing && groupByCost ? "…" : ""}
      </label>
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
    const tags = userSections.filter((section) => card.section_ids.includes(section.id));
    const label = card.name_pt ?? card.name_en;
    return {
      id: card.id,
      quantity: card.quantity,
      label,
      secondary: card.name_pt ? card.name_en : null,
      setCode: card.set_code || null,
      tags: tags.map((tag) => tag.name),
      priceLabel: formatBRLFromCents(card.price_cents ?? null) || null,
      imageSrc: card.image_normal ?? card.image_small,
      renderActions: (layout) =>
        editing ? (
          <DeckCardActions
            layout={layout}
            label={label}
            quantity={card.quantity}
            onDecrement={() => void mutations.removeCard(card.id)}
            onIncrement={() => void mutations.addOneCopy(card)}
            onRemoveAll={() => void mutations.removeCard(card.id, true)}
            onInspect={() => setMetaCard(card)}
            coverage={
              card.included && card.needed != null
                ? { owned: card.owned ?? 0, needed: card.needed, missing: card.missing ?? 0 }
                : null
            }
            included={card.included}
            onIncludedChange={(included) => void mutations.setIncluded(card.id, included)}
            sections={userSections}
            selectedTagIds={tags.map((tag) => tag.id)}
            onTagsChange={(nextIds) => void mutations.setCardUserSections(card.id, nextIds)}
          />
        ) : null,
    };
  }

  const includedGroups: DeckViewGroup[] = groupByType
    ? groupedIncluded.map((bucket) => ({ key: bucket.group, label: bucket.label, items: bucket.cards.map(toViewItem) }))
    : groupByCost
      ? groupedByCost.map((bucket) => ({ key: bucket.key, label: bucket.label, items: bucket.cards.map(toViewItem) }))
      : [{ key: "included", label: null, items: includedCards.map(toViewItem) }];
  const workingGroups: DeckViewGroup[] = [{ key: "working", label: null, items: workingCards.map(toViewItem) }];

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
  ) : null;

  const tools = editing ? (
    <DeckEditTools
      deckId={deckId}
      userSections={userSections}
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
              sections={sections}
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

  const includedCount = includedCards.reduce((total, card) => total + card.quantity, 0);
  const workingCount = workingCards.reduce((total, card) => total + card.quantity, 0);

  const deckPanel = (
    <ListPanel title="No deck" count={includedCount}>
      {includedCards.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-muted">
          Nenhuma carta incluída.{editing ? "" : " Use Editar para adicionar cartas."}
        </p>
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

  const workingPanel =
    editing || workingCards.length ? (
      <ListPanel
        title="Em trabalho"
        count={workingCount}
        dashed
        note="Cartas para upgrade, corte ou consideração — ainda não entram no deck."
      >
        {workingCards.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-muted">Nenhuma carta em trabalho.</p>
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

  return (
    <AppShell wide>
      <div className="space-y-4">
        <div className="flex flex-col gap-4 border-b border-outline-variant pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            {editing ? (
              <DeckEditHeader deckId={deckId} name={name} format={format} onNameChange={setName} onFormatChange={setFormat} />
            ) : (
              deckTitle
            )}
            <DeckExportMenu cards={cards} />
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
                Só “No deck”. Cartas já em sessão manual (tag) não mudam de sessão ao agrupar. Os modos são exclusivos.
              </span>
            ) : null}
          </div>
          {listViewSelect}
        </div>

        {editing ? (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <div className="min-w-0 space-y-5 lg:col-span-8">
              <DeckStatsCharts cards={includedCards} />
              {deckPanel}
              {workingPanel}
            </div>
            <aside className="border border-outline-variant bg-surface-container-lowest p-4 lg:col-span-4">{tools}</aside>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-5">
              {deckPanel}
              {workingPanel}
            </div>
            <aside className="min-w-0">
              <DeckStatsCharts cards={includedCards} stacked />
            </aside>
          </div>
        )}
      </div>
      {metaModal}
    </AppShell>
  );
}

function ListPanel({
  title,
  count,
  note,
  dashed = false,
  children,
}: {
  title: string;
  count: number;
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
          <span className="bg-surface-container-high px-1.5 py-0.5 font-mono text-[10px] font-semibold text-on-surface">
            ({count})
          </span>
        </div>
        {note ? <span className="font-mono text-[10px] text-on-surface-variant">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}
