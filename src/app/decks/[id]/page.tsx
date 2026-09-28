"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CardMetaModal, type CardMetaValues } from "@/components/card-meta-modal";
import { CardQuantityControls } from "@/components/card-quantity-controls";
import { CardScanner } from "@/components/card-scanner";
import { CardSearch, type Suggestion } from "@/components/card-search";
import { DeckCanvas, type DeckCanvasHandle } from "@/components/deck-canvas";
import { DeckCoverageBadge } from "@/components/deck-coverage-badge";
import { DeckExportMenu } from "@/components/deck-export-menu";
import { DeckStatsCharts } from "@/components/deck-stats-charts";
import { LoadingModal } from "@/components/loading-modal";
import { SectionMultiSelect } from "@/components/section-multi-select";
import { groupCardsByType } from "@/lib/card-types";
import type { DeckCoverageSummary } from "@/lib/deck-coverage";
import { FORMATS } from "@/lib/formats";
import { groupCardsByManaCost } from "@/lib/mana-cost-groups";
import { formatBRLFromCents } from "@/lib/money-br";

type CardRow = {
  id: string;
  deck_card_id?: string;
  quantity: number;
  included: boolean;
  section_ids: string[];
  name_en: string;
  name_pt: string | null;
  set_code: string;
  type_line?: string | null;
  mana_cost?: string | null;
  price_cents?: number | null;
  note?: string | null;
  image_normal: string | null;
  image_small: string | null;
  oracle_id?: string | null;
  owned?: number;
  needed?: number;
  missing?: number;
};

type Section = { id: string; name: string; kind?: "user" | "type" | string; type_key?: string | null };

type DeckView = "lista" | "canvas";

const VIEW_OPTIONS: Array<{ id: DeckView; label: string }> = [
  { id: "lista", label: "Lista" },
  { id: "canvas", label: "Canvas" },
];

function normalizeSectionIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return value ? [value] : [];
    }
  }
  return [];
}

export default function DeckPage() {
  const params = useParams<{ id: string }>();
  const [name, setName] = useState("");
  const [format, setFormat] = useState("commander");
  const [cards, setCards] = useState<CardRow[]>([]);
  const [coverage, setCoverage] = useState<DeckCoverageSummary | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [view, setView] = useState<DeckView>("lista");
  const isCanvasView = view !== "lista";
  const [includeCollection, setIncludeCollection] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [targetSection, setTargetSection] = useState("");
  const [listText, setListText] = useState("");
  const [listImporting, setListImporting] = useState(false);
  const [status, setStatus] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [groupByType, setGroupByType] = useState<boolean | null>(null);
  const [groupByCost, setGroupByCost] = useState<boolean | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
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
    const response = await fetch(`/api/decks/${params.id}`);
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
  }, [params.id]);

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
  }, []);

  useEffect(() => {
    if (groupByType === null || groupByCost === null) return;
    window.localStorage.setItem("mtghelper.deck.groupByType", groupByType ? "1" : "0");
    window.localStorage.setItem("mtghelper.deck.groupByCost", groupByCost ? "1" : "0");
    let cancelled = false;
    setAutoSectionsSyncing(true);
    void (async () => {
      const typeRes = await fetch(`/api/decks/${params.id}/type-sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: groupByType }),
      });
      const costRes = await fetch(`/api/decks/${params.id}/cost-sections`, {
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
  }, [groupByType, groupByCost, params.id, load]);

  useEffect(() => {
    if (view === "lista") {
      setCanvasLoadedView(null);
      return;
    }
    let cancelled = false;
    setCanvasLoadedView(null);
    void fetch(`/api/decks/${params.id}/canvas`)
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
  }, [view, params.id]);

  useEffect(() => {
    if (!isCanvasView || !canvasReady) return;
    const timer = window.setInterval(() => {
      if (canvasRef.current?.isDirty()) void canvasRef.current.save();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [isCanvasView, canvasReady]);

  useEffect(() => {
    if (!isCanvasView) return;
    function onBeforeUnload() {
      if (!canvasRef.current?.isDirty()) return;
      void canvasRef.current.save({ keepalive: true });
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (canvasRef.current?.isDirty()) void canvasRef.current.save({ keepalive: true });
    };
  }, [isCanvasView]);

  async function switchView(next: DeckView) {
    if (next === view) return;
    if (canvasRef.current?.isDirty()) await canvasRef.current.save();
    setView(next);
  }

  async function ensureAutoSections() {
    if (groupByType) {
      const response = await fetch(`/api/decks/${params.id}/type-sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });
      if (response.ok) await load();
      return;
    }
    if (groupByCost) {
      const response = await fetch(`/api/decks/${params.id}/cost-sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });
      if (response.ok) await load();
    }
  }

  const includedCards = useMemo(() => cards.filter((card) => card.included), [cards]);
  const workingCards = useMemo(() => cards.filter((card) => !card.included), [cards]);
  const groupedIncluded = useMemo(() => groupCardsByType(includedCards), [includedCards]);
  const groupedByCost = useMemo(() => groupCardsByManaCost(includedCards), [includedCards]);
  const userSections = useMemo(
    () => sections.filter((section) => section.kind !== "type" && section.kind !== "cost"),
    [sections],
  );

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
    <div className="flex flex-wrap items-center gap-4 text-sm">
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

  async function addText(text: string, sectionId?: string, set?: string, included?: boolean) {
    setStatus("Buscando cartas…");
    const response = await fetch(`/api/decks/${params.id}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, sectionId, set, included }),
    });
    const data = await response.json();
    setStatus(
      data.missing?.length
        ? `Não encontradas: ${data.missing.map((item: { name: string }) => item.name).join(", ")}`
        : "Cartas adicionadas.",
    );
    await load();
    await ensureAutoSections();
  }

  async function importListText(text: string) {
    if (!text.trim() || listImporting) return;
    setListImporting(true);
    try {
      await addText(text);
    } finally {
      setListImporting(false);
    }
  }

  async function addSuggestion(suggestion: Suggestion, sectionId?: string, included?: boolean) {
    const label = suggestion.namePt ?? suggestion.nameEn;
    await addText(`1 ${label}`, sectionId, undefined, included);
  }

  async function createSection(event: React.FormEvent) {
    event.preventDefault();
    if (!sectionName.trim()) return;
    await fetch(`/api/decks/${params.id}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: sectionName }),
    });
    setSectionName("");
    await load();
  }

  async function deleteSection(sectionId: string, sectionLabel: string) {
    if (!window.confirm(`Excluir a tag “${sectionLabel}”? As cartas permanecem no deck.`)) return;
    const response = await fetch(`/api/decks/${params.id}/sections`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(typeof data.error === "string" ? data.error : "Não foi possível excluir a tag.");
      return;
    }
    if (targetSection === sectionId) setTargetSection("");
    setStatus("Tag excluída.");
    await load();
  }

  async function setCardUserSections(catalogCardId: string, sectionIds: string[]) {
    // Otimista: mantém carta em No deck / Em trabalho; só atualiza tags user.
    setCards((prev) =>
      prev.map((card) => {
        if (card.id !== catalogCardId) return card;
        const autoIds = card.section_ids.filter((id) => {
          const section = sections.find((item) => item.id === id);
          return section?.kind === "type" || section?.kind === "cost";
        });
        return { ...card, section_ids: [...autoIds, ...sectionIds] };
      }),
    );
    const response = await fetch(`/api/decks/${params.id}/cards`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogCardId, sectionIds }),
    });
    if (!response.ok) {
      setStatus("Não foi possível atualizar as sessões da carta.");
      await load();
      return;
    }
  }

  async function removeCard(catalogCardId: string, all = false) {
    const response = await fetch(`/api/decks/${params.id}/cards`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogCardId, quantity: 1, all }),
    });
    if (!response.ok) {
      setStatus("Não foi possível remover a carta.");
      return;
    }
    setStatus(all ? "Carta removida." : "Quantidade atualizada.");
    await load();
    await ensureAutoSections();
  }

  async function addOneCopy(card: CardRow) {
    await addText(`1 ${card.name_pt ?? card.name_en}`, undefined, undefined, card.included);
  }

  async function setIncluded(catalogCardId: string, included: boolean) {
    await fetch(`/api/decks/${params.id}/cards`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogCardId, included }),
    });
    await load();
    await ensureAutoSections();
  }

  async function processCollection() {
    const response = await fetch(`/api/decks/${params.id}/process-collection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await response.json();
    setStatus(response.ok ? `${data.added} carta(s) incluídas enviadas à coleção.` : "Não foi possível processar.");
    if (response.ok) await load();
  }

  async function saveMeta() {
    await fetch(`/api/decks/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, format }),
    });
  }

  async function saveCardMeta(catalogCardId: string, values: CardMetaValues) {
    const response = await fetch(`/api/decks/${params.id}/cards`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        catalogCardId,
        priceCents: values.priceCents,
        note: values.note,
      }),
    });
    if (!response.ok) throw new Error("save meta failed");
    await load();
  }

  function renderCardRow(card: CardRow) {
    const tags = userSections.filter((section) => card.section_ids.includes(section.id));
    const userTagIds = tags.map((tag) => tag.id);
    const priceLabel = formatBRLFromCents(card.price_cents ?? null);
    return (
      <CardQuantityControls
        quantity={card.quantity}
        label={card.name_pt ?? card.name_en}
        secondary={card.name_pt ? card.name_en : null}
        imageSrc={card.image_small ?? card.image_normal}
        previewSrc={card.image_normal}
        meta={[card.set_code, ...tags.map((tag) => tag.name), priceLabel || null].filter(Boolean).join(" · ")}
        onDecrement={() => void removeCard(card.id)}
        onIncrement={() => void addOneCopy(card)}
        onRemoveAll={() => void removeCard(card.id, true)}
        onInspect={() => setMetaCard(card)}
        inspectTitle="Detalhes da carta (preço e nota)"
        coverage={
          card.included && card.needed != null
            ? { owned: card.owned ?? 0, needed: card.needed, missing: card.missing ?? 0 }
            : null
        }
        extraActions={
          <>
            <label className="flex items-center gap-1 text-[11px] text-muted">
              <input
                type="checkbox"
                checked={card.included}
                onChange={(event) => void setIncluded(card.id, event.target.checked)}
              />
              No deck
            </label>
            <SectionMultiSelect
              sections={userSections}
              selectedIds={userTagIds}
              onChange={(nextIds) => void setCardUserSections(card.id, nextIds)}
            />
          </>
        }
      />
    );
  }

  const tools = (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2 className="ui-label text-ink">Busca</h2>
        <CardSearch onSelect={(item) => void addSuggestion(item, undefined, true)} />
        <button type="button" className="ui-btn-outline h-9 w-full" onClick={() => setScannerOpen(true)}>
          Escanear carta
        </button>
      </div>
      <div className="space-y-2">
        <h2 className="ui-label text-ink">Lista</h2>
        <textarea
          value={listText}
          onChange={(event) => setListText(event.target.value)}
          className="ui-textarea h-28 disabled:opacity-60"
          placeholder="1 Sol Ring"
          disabled={listImporting}
        />
        <button
          type="button"
          className="ui-btn-outline h-9 w-full disabled:opacity-60"
          disabled={listImporting}
          onClick={() => void importListText(listText)}
        >
          Adicionar ao deck
        </button>
      </div>
      <form onSubmit={(event) => void createSection(event)} className="space-y-2">
        <h2 className="ui-label text-ink">Seção (tag)</h2>
        <input
          aria-label="Nome da seção"
          value={sectionName}
          onChange={(event) => setSectionName(event.target.value)}
          placeholder="upgrade, remover, trocar"
          className="ui-input"
        />
        <button type="submit" className="ui-btn-outline h-9 w-full">
          Criar seção
        </button>
      </form>
      {userSections.length ? (
        <div className="space-y-2">
          <h2 className="ui-label text-ink">Tags</h2>
          <ul className="border border-ink text-[13px]">
            {userSections.map((section) => (
              <li key={section.id} className="ui-row justify-between gap-2">
                <span className="truncate">{section.name}</span>
                <button
                  type="button"
                  className="shrink-0 text-[11px] underline"
                  onClick={() => void deleteSection(section.id, section.name)}
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {userSections.length ? (
        <div className="space-y-2">
          <h2 className="ui-label text-ink">Adicionar em trabalho + tag</h2>
          <select
            aria-label="Seção destino"
            value={targetSection}
            onChange={(event) => setTargetSection(event.target.value)}
            className="ui-input"
          >
            <option value="">Escolher seção…</option>
            {userSections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
          {targetSection ? (
            <CardSearch
              placeholder="Carta em trabalho"
              onSelect={(item) => void addSuggestion(item, targetSection, false)}
            />
          ) : null}
        </div>
      ) : null}
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={includeCollection} onChange={(event) => setIncludeCollection(event.target.checked)} />
        Incluir na coleção (só cartas “No deck”)
      </label>
      {includeCollection ? (
        <button type="button" onClick={() => void processCollection()} className="ui-btn h-9 w-full">
          Processar
        </button>
      ) : null}
      {status ? <p className="text-[12px] text-muted">{status}</p> : null}
    </div>
  );

  const scanner = (
    <CardScanner
      open={scannerOpen}
      onClose={() => setScannerOpen(false)}
      sections={userSections}
      onConfirm={async (payload) => {
        await addText(
          `${payload.quantity} ${payload.name}`,
          payload.sectionId,
          payload.set,
          payload.sectionId ? false : true,
        );
      }}
    />
  );

  const viewToggle = (buttonHeight: string) => (
    <div className="flex border border-ink">
      {VIEW_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={view === option.id}
          onClick={() => void switchView(option.id)}
          className={
            view === option.id
              ? `ui-btn ${buttonHeight} rounded-none px-3`
              : `ui-btn-outline ${buttonHeight} rounded-none border-0 px-3`
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  if (isCanvasView) {
    const canvasCallbacks = {
      deckId: params.id,
      cards,
      sections,
      onDirtyChange: setCanvasDirty,
      onDomainChange: () => void load(),
      onEditCardMeta: (catalogId: string) => {
        const card = cards.find((item) => item.id === catalogId);
        if (card) setMetaCard(card);
      },
      onSaveState: (state: "idle" | "saving" | "saved" | "error", updatedAt?: string | null) => {
        setCanvasSaveState(state);
        if (updatedAt) setCanvasUpdatedAt(updatedAt);
      },
    };
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-background">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border-line bg-surface-container-lowest px-4">
          {viewToggle("h-8")}
          <span className="text-[13px] font-semibold text-ink">{name}</span>
          <span className="ui-badge">{format}</span>
          <DeckCoverageBadge coverage={coverage} />
          <div className="ml-auto flex items-center gap-3">
            {groupingToggles}
            <span className="font-mono text-[10px] tracking-wide text-muted uppercase">{canvasStatusLabel()}</span>
            <DeckExportMenu cards={cards} buttonClassName="ui-btn-outline h-8" menuAlign="right" />
            <button
              type="button"
              className="ui-btn h-8 disabled:opacity-50"
              disabled={!canvasReady || canvasSaveState === "saving"}
              onClick={() => void canvasRef.current?.save()}
            >
              Salvar
            </button>
          </div>
        </header>
        <div className="relative min-h-0 flex-1">
          {canvasReady ? (
            <DeckCanvas
              key={`${params.id}-canvas`}
              ref={canvasRef}
              initialSnapshot={canvasSnapshot}
              {...canvasCallbacks}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500">Carregando canvas…</div>
          )}
          {canvasToolsOpen ? (
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
        </div>
        {scanner}
        <LoadingModal open={listImporting} title="Adicionando cartas" message="Importando a lista para o deck. Aguarde…" />
        <CardMetaModal
          open={Boolean(metaCard)}
          title={metaCard ? (metaCard.name_pt ?? metaCard.name_en) : ""}
          initial={{
            priceCents: metaCard?.price_cents ?? null,
            note: metaCard?.note ?? "",
          }}
          onClose={() => setMetaCard(null)}
          onSave={async (values) => {
            if (!metaCard) return;
            await saveCardMeta(metaCard.id, values);
          }}
        />
      </div>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end gap-2">
          <input
            aria-label="Nome do deck"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="ui-input h-9 max-w-xs border-ink"
          />
          <select
            aria-label="Formato"
            value={format}
            onChange={(event) => setFormat(event.target.value)}
            className="ui-input h-9 w-auto border-ink"
          >
            {FORMATS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void saveMeta()} className="ui-btn h-9">
            Salvar
          </button>
          <DeckExportMenu cards={cards} />
          <DeckCoverageBadge coverage={coverage} />
          <div className="ml-auto">{viewToggle("h-9")}</div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            {groupingToggles}
            <p className="text-[12px] text-muted">
              Só “No deck”. Cartas já em sessão manual (tag) não mudam de sessão ao agrupar por tipo/custo. Os modos são exclusivos.
            </p>

            <DeckStatsCharts cards={includedCards} />

            <section className="space-y-2">
              <h2 className="ui-label text-ink">
                No deck{" "}
                <span className="font-mono text-[12px] text-muted">
                  ({includedCards.reduce((n, c) => n + c.quantity, 0)})
                </span>
              </h2>
              {includedCards.length === 0 ? (
                <div className="border border-ink px-3 py-4 text-[13px] text-muted">Nenhuma carta incluída.</div>
              ) : groupByType ? (
                <div className="space-y-3">
                  {groupedIncluded.map((bucket) => {
                    const collapsed = collapsedGroups.has(bucket.group);
                    const qty = bucket.cards.reduce((n, c) => n + c.quantity, 0);
                    return (
                      <div key={bucket.group} className="border border-ink">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 border-b border-border-line bg-surface-container-low px-3 py-2 text-left text-[13px] font-semibold uppercase tracking-wide"
                          aria-expanded={!collapsed}
                          onClick={() => toggleCollapsedGroup(bucket.group)}
                        >
                          <span className="w-4 shrink-0 text-muted" aria-hidden>
                            {collapsed ? "▸" : "▾"}
                          </span>
                          <span className="flex-1">{bucket.label}</span>
                          <span className="font-mono text-[11px] font-normal text-muted">{qty}</span>
                        </button>
                        {collapsed ? null : (
                          <ul className="divide-y">
                            {bucket.cards.map((card) => (
                              <li key={card.id}>{renderCardRow(card)}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : groupByCost ? (
                <div className="space-y-3">
                  {groupedByCost.map((bucket) => {
                    const collapsed = collapsedGroups.has(bucket.key);
                    const qty = bucket.cards.reduce((n, c) => n + c.quantity, 0);
                    return (
                      <div key={bucket.key} className="border border-ink">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 border-b border-border-line bg-surface-container-low px-3 py-2 text-left text-[13px] font-semibold uppercase tracking-wide"
                          aria-expanded={!collapsed}
                          onClick={() => toggleCollapsedGroup(bucket.key)}
                        >
                          <span className="w-4 shrink-0 text-muted" aria-hidden>
                            {collapsed ? "▸" : "▾"}
                          </span>
                          <span className="flex-1">{bucket.label}</span>
                          <span className="font-mono text-[11px] font-normal text-muted">{qty}</span>
                        </button>
                        {collapsed ? null : (
                          <ul className="divide-y">
                            {bucket.cards.map((card) => (
                              <li key={card.id}>{renderCardRow(card)}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <ul className="divide-y border border-black">
                  {includedCards.map((card) => (
                    <li key={card.id}>{renderCardRow(card)}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-medium uppercase">
                Em trabalho <span className="text-neutral-500">({workingCards.reduce((n, c) => n + c.quantity, 0)})</span>
              </h2>
              <p className="text-xs text-neutral-500">Cartas para upgrade, corte ou consideração — ainda não entram no deck.</p>
              {workingCards.length === 0 ? (
                <div className="border border-black px-3 py-4 text-sm text-neutral-500">Nenhuma carta em trabalho.</div>
              ) : (
                <ul className="divide-y border border-dashed border-neutral-400">
                  {workingCards.map((card) => (
                    <li key={card.id}>{renderCardRow(card)}</li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <div className="border border-black p-4">{tools}</div>
        </div>
      </div>
      {scanner}
      <LoadingModal open={listImporting} title="Adicionando cartas" message="Importando a lista para o deck. Aguarde…" />
      <CardMetaModal
        open={Boolean(metaCard)}
        title={metaCard ? (metaCard.name_pt ?? metaCard.name_en) : ""}
        initial={{
          priceCents: metaCard?.price_cents ?? null,
          note: metaCard?.note ?? "",
        }}
        onClose={() => setMetaCard(null)}
        onSave={async (values) => {
          if (!metaCard) return;
          await saveCardMeta(metaCard.id, values);
        }}
      />
    </AppShell>
  );
}
