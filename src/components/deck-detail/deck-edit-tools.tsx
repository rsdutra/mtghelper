"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CardSearch, type Suggestion } from "@/components/card-search";
import type { DeckPlace } from "@/components/deck-detail/deck-detail-types";
import { LoadingModal } from "@/components/loading-modal";

type Props = {
  deckId: string;
  allowsSideboard: boolean;
  status: string;
  setStatus: (status: string) => void;
  addText: (text: string, set?: string, place?: DeckPlace) => Promise<void>;
  reload: () => Promise<void>;
};

type ReviewCard = {
  catalogCardId: string;
  name: string;
  deckQuantity: number;
  owned: number;
  include: boolean;
  quantity: number;
};

type FreshCard = { catalogCardId: string; name: string; quantity: number };

const DESTINATION_OPTIONS: Array<{ id: DeckPlace; short: string; label: string }> = [
  { id: "main", short: "Deck", label: "Adicionar ao Deck" },
  { id: "side", short: "Side", label: "Adicionar ao Sideboard" },
  { id: "out", short: "Fora", label: "Adicionar fora do deck" },
];

function DestinationMenu({
  value,
  allowsSideboard,
  onChange,
}: {
  value: DeckPlace;
  allowsSideboard: boolean;
  onChange: (place: DeckPlace) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const options = DESTINATION_OPTIONS.filter((option) => option.id !== "side" || allowsSideboard);
  const current = options.find((option) => option.id === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-label="Destino da busca"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={current.label}
        onClick={() => setOpen((next) => !next)}
        className="ui-input h-11 w-[4.25rem] border-ink px-2 text-[12px]"
      >
        {current.short}
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label="Destino da busca"
          className="absolute top-full right-0 z-30 mt-1 w-max border border-ink bg-surface-container-lowest shadow-[4px_4px_0_#09090b]"
        >
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                aria-selected={option.id === current.id}
                className="block w-full px-3 py-2 text-left text-[13px] whitespace-nowrap hover:bg-surface-container"
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Module({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2 border-b border-outline-variant pb-5 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[10px] font-bold tracking-[0.08em] text-ink uppercase">{title}</h2>
        {aside}
      </div>
      {children}
    </div>
  );
}

/** Painel de ferramentas da edição: busca, lista e coleção. */
export function DeckEditTools({ deckId, allowsSideboard, status, setStatus, addText, reload }: Props) {
  const [place, setPlace] = useState<DeckPlace>("main");
  const [listOpen, setListOpen] = useState(false);
  const [listTarget, setListTarget] = useState<DeckPlace>("main");
  const [lists, setLists] = useState<Record<DeckPlace, string>>({ main: "", side: "", out: "" });
  const [listImporting, setListImporting] = useState(false);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [adding, setAdding] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [includeMain, setIncludeMain] = useState(true);
  const [includeOut, setIncludeOut] = useState(false);
  const [collectionBusy, setCollectionBusy] = useState(false);
  const [review, setReview] = useState<ReviewCard[] | null>(null);
  const [fresh, setFresh] = useState<FreshCard[]>([]);

  const destination = allowsSideboard || place !== "side" ? place : "main";

  /** US-004-18: a sugestão só seleciona; gravar exige o botão Adicionar. */
  async function addSelected() {
    if (!selected) return;
    setAdding(true);
    try {
      await addText(`1 ${selected.namePt ?? selected.nameEn}`, undefined, destination);
      setSelected(null);
    } finally {
      setAdding(false);
    }
  }

  async function saveLists() {
    const jobs: Array<[DeckPlace, string]> = [
      ["main", lists.main],
      ["side", lists.side],
      ["out", lists.out],
    ];
    const pending = jobs.filter(([target, text]) => text.trim() && (target !== "side" || allowsSideboard));
    if (!pending.length) {
      setStatus("Nada para adicionar.");
      return;
    }
    setListImporting(true);
    try {
      for (const [target, text] of pending) {
        await addText(text, undefined, target);
      }
      setLists({ main: "", side: "", out: "" });
      setListOpen(false);
    } finally {
      setListImporting(false);
    }
  }

  async function verifyCollection() {
    setCollectionBusy(true);
    setStatus("");
    try {
      const response = await fetch(`/api/decks/${deckId}/process-collection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", includeMain, includeOut }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus(typeof data.error === "string" ? data.error : "Não foi possível verificar a coleção.");
        return;
      }
      const existing = (data.existing ?? []) as Array<Omit<ReviewCard, "include" | "quantity">>;
      const freshCards = (data.fresh ?? []) as FreshCard[];
      if (!existing.length) {
        await applyCollection(freshCards.map((card) => ({ catalogCardId: card.catalogCardId, quantity: card.quantity })));
        return;
      }
      setFresh(freshCards);
      setReview(
        existing.map((card) => ({
          ...card,
          include: true,
          quantity: card.deckQuantity,
        })),
      );
    } finally {
      setCollectionBusy(false);
    }
  }

  async function applyCollection(items: Array<{ catalogCardId: string; quantity: number }>) {
    setCollectionBusy(true);
    try {
      const response = await fetch(`/api/decks/${deckId}/process-collection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", items }),
      });
      const data = await response.json();
      setStatus(response.ok ? `${data.added} carta(s) incluídas enviadas à coleção.` : "Não foi possível processar.");
      if (response.ok) {
        setCollectionOpen(false);
        setReview(null);
        setFresh([]);
        await reload();
      }
    } finally {
      setCollectionBusy(false);
    }
  }

  function proceedReview() {
    if (!review) return;
    const chosen = review
      .filter((card) => card.include && card.quantity > 0)
      .map((card) => ({ catalogCardId: card.catalogCardId, quantity: card.quantity }));
    const freshItems = fresh.map((card) => ({ catalogCardId: card.catalogCardId, quantity: card.quantity }));
    void applyCollection([...freshItems, ...chosen]);
  }

  return (
    <div className="space-y-5">
      <Module title="Busca">
        <div className="flex">
          <div className="min-w-0 flex-1 [&_input]:border-r-0">
            <CardSearch onSelect={setSelected} />
          </div>
          <DestinationMenu
            value={destination}
            allowsSideboard={allowsSideboard}
            onChange={setPlace}
          />
        </div>
        {selected ? (
          <div
            className="flex items-center gap-3 border border-outline-variant px-2 py-1.5"
            data-testid="search-selected-card"
          >
            {selected.imageSmall ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.imageSmall} alt="" className="h-10 w-7 object-cover" />
            ) : (
              <span className="h-10 w-7 border border-border-line" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">{selected.namePt ?? selected.nameEn}</span>
              {selected.namePt ? <span className="block truncate text-[12px] text-muted">{selected.nameEn}</span> : null}
            </span>
            <button
              type="button"
              aria-label="Limpar carta selecionada"
              title="Limpar carta selecionada"
              className="flex h-7 w-7 shrink-0 items-center justify-center text-muted hover:bg-surface-container hover:text-ink"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className="ui-btn h-8 w-full disabled:opacity-50"
          disabled={!selected || adding}
          onClick={() => void addSelected()}
        >
          Adicionar
        </button>
      </Module>
      <Module title="Lista">
        <button type="button" className="ui-btn-outline h-8 w-full" onClick={() => setListOpen(true)}>
          Adicionar lista
        </button>
      </Module>
      <Module title="Coleção">
        <button type="button" className="ui-btn h-8 w-full" onClick={() => setCollectionOpen(true)}>
          Incluir na coleção
        </button>
      </Module>
      {status ? <p className="text-[12px] text-muted">{status}</p> : null}
      {listOpen ? (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="list-modal-title">
          <div className="flex h-[min(80vh,760px)] w-[min(960px,94vw)] flex-col border border-ink bg-surface-container-lowest shadow-[6px_6px_0_#09090b]">
            <header className="flex items-center justify-between gap-3 border-b border-outline-variant px-5 py-3">
              <h2 id="list-modal-title" className="text-[16px] font-semibold text-ink">
                Adicionar lista
              </h2>
              <label className="flex items-center gap-2 text-[13px]">
                Destino
                <select
                  aria-label="Destino da lista"
                  value={allowsSideboard || listTarget !== "side" ? listTarget : "main"}
                  onChange={(event) => setListTarget(event.target.value as DeckPlace)}
                  className="ui-input h-8 w-auto"
                >
                  <option value="main">No deck</option>
                  {allowsSideboard ? <option value="side">Sideboard</option> : null}
                  <option value="out">Fora do Deck</option>
                </select>
              </label>
            </header>
            <div className="min-h-0 flex-1 p-5">
              <textarea
                aria-label="Lista no deck"
                value={lists.main}
                onChange={(event) => setLists((current) => ({ ...current, main: event.target.value }))}
                placeholder="1 Sol Ring"
                hidden={listTarget !== "main"}
                className="ui-textarea h-full font-mono text-[14px] leading-6"
              />
              <textarea
                aria-label="Lista no sideboard"
                value={lists.side}
                onChange={(event) => setLists((current) => ({ ...current, side: event.target.value }))}
                placeholder="1 Lightning Bolt"
                hidden={!allowsSideboard || listTarget !== "side"}
                className="ui-textarea h-full font-mono text-[14px] leading-6"
              />
              <textarea
                aria-label="Lista fora do deck"
                value={lists.out}
                onChange={(event) => setLists((current) => ({ ...current, out: event.target.value }))}
                placeholder="1 Island"
                hidden={listTarget !== "out"}
                className="ui-textarea h-full font-mono text-[14px] leading-6"
              />
            </div>
            <footer className="flex justify-end gap-2 border-t border-outline-variant px-5 py-3">
              <button type="button" className="ui-btn-outline h-9" onClick={() => setListOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="ui-btn h-9" onClick={() => void saveLists()}>
                Salvar
              </button>
            </footer>
          </div>
        </div>
      ) : null}
      {collectionOpen ? (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="collection-modal-title">
          <div className="flex max-h-[min(80vh,720px)] w-[min(640px,94vw)] flex-col border border-ink bg-surface-container-lowest shadow-[6px_6px_0_#09090b]">
            <header className="border-b border-outline-variant px-5 py-3">
              <h2 id="collection-modal-title" className="text-[16px] font-semibold text-ink">
                Incluir na coleção
              </h2>
            </header>
            <div className="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4">
              {review ? (
                <>
                  <p className="text-[13px] text-ink">
                    Estas cartas já estão na coleção. Marque as que devem entrar mesmo assim e ajuste a quantidade a adicionar.
                  </p>
                  <ul className="space-y-2">
                    {review.map((card) => (
                      <li key={card.catalogCardId} className="flex flex-wrap items-center gap-3 border border-outline-variant px-3 py-2">
                        <label className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
                          <input
                            type="checkbox"
                            aria-label={`Incluir ${card.name}`}
                            checked={card.include}
                            onChange={(event) =>
                              setReview((current) =>
                                current?.map((item) =>
                                  item.catalogCardId === card.catalogCardId ? { ...item, include: event.target.checked } : item,
                                ) ?? null,
                              )
                            }
                          />
                          <span className="truncate font-medium">{card.name}</span>
                        </label>
                        <span className="font-mono text-[12px] text-muted">{card.owned} na coleção</span>
                        <input
                          aria-label={`Quantidade de ${card.name}`}
                          type="number"
                          min={1}
                          max={99}
                          value={card.quantity}
                          onChange={(event) =>
                            setReview((current) =>
                              current?.map((item) =>
                                item.catalogCardId === card.catalogCardId
                                  ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) }
                                  : item,
                              ) ?? null,
                            )
                          }
                          className="ui-input h-8 w-16"
                        />
                      </li>
                    ))}
                  </ul>
                  {fresh.length ? (
                    <p className="text-[13px] text-muted">{fresh.length} carta(s) novas serão incluídas junto.</p>
                  ) : null}
                </>
              ) : (
                <div className="space-y-3 text-[14px]">
                  <p>O grupo “No deck” inclui o sideboard.</p>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={includeMain} onChange={(event) => setIncludeMain(event.target.checked)} />
                    No deck
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={includeOut} onChange={(event) => setIncludeOut(event.target.checked)} />
                    Fora do deck
                  </label>
                </div>
              )}
            </div>
            <footer className="flex justify-end gap-2 border-t border-outline-variant px-5 py-3">
              <button
                type="button"
                className="ui-btn-outline h-9"
                onClick={() => {
                  setCollectionOpen(false);
                  setReview(null);
                  setFresh([]);
                }}
              >
                Cancelar
              </button>
              {review ? (
                <button type="button" className="ui-btn h-9" onClick={proceedReview}>
                  Prosseguir
                </button>
              ) : (
                <button type="button" className="ui-btn h-9" disabled={!includeMain && !includeOut} onClick={() => void verifyCollection()}>
                  Verificar
                </button>
              )}
            </footer>
          </div>
        </div>
      ) : null}
      <LoadingModal
        open={listImporting || collectionBusy}
        title={listImporting ? "Adicionando cartas" : "Processando coleção"}
        message={listImporting ? "Importando a lista para o deck. Aguarde…" : "Conferindo e atualizando a coleção. Aguarde…"}
      />
    </div>
  );
}
