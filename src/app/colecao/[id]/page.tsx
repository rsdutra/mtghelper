"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CardMetaModal, type CardMetaValues } from "@/components/card-meta-modal";
import { CardScanner } from "@/components/card-scanner";
import { CardSearch } from "@/components/card-search";
import {
  CollectionFilters,
  compileQuickFilters,
  EMPTY_QUICK_FILTERS,
  type CollectionQuickFilters,
} from "@/components/collection-filters";
import { LoadingModal } from "@/components/loading-modal";
import { filtersFromCatalog, type CardFilters } from "@/lib/scryfall-filters";
import { matchScryfallQuery, parseScryfallQuery } from "@/lib/scryfall-query";
import { formatBRLFromCents } from "@/lib/money-br";
import { unresolvedCardsMessage } from "@/lib/lists";
import { addTag, collectTags, toggleTag, type CardTag } from "@/lib/tags";
import { CardTagButton, TagCreateModal, TagDots } from "@/components/card-tags";

type Item = {
  id: string;
  quantity: number;
  name_en: string;
  name_pt: string | null;
  set_code: string;
  set_name: string | null;
  image_normal: string | null;
  image_small: string | null;
  type_line?: string | null;
  mana_cost?: string | null;
  lang?: string | null;
  filters?: CardFilters | null;
  price_cents?: number | null;
  note?: string | null;
  tags?: CardTag[];
};

type CollectionView = "grade" | "lista";

const VIEW_STORAGE_KEY = "mtghelper.collection.view";

function itemHasNote(item: Item) {
  return Boolean(item.note && item.note.replace(/<[^>]+>/g, "").trim());
}

function matchesQuery(item: Item, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.name_en, item.name_pt, item.set_code, item.set_name, ...(item.tags ?? []).map((tag) => tag.name)]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(q));
}

export default function CollectionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [listImporting, setListImporting] = useState(false);
  const [collectionCount, setCollectionCount] = useState(1);
  const [deleting, setDeleting] = useState(false);
  const [metaItem, setMetaItem] = useState<Item | null>(null);
  const [tagItem, setTagItem] = useState<Item | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const tagWrites = useRef(Promise.resolve());
  const [query, setQuery] = useState("");
  const [listText, setListText] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(true);
  const [syntax, setSyntax] = useState("");
  const [quick, setQuick] = useState<CollectionQuickFilters>(EMPTY_QUICK_FILTERS);
  const [view, setView] = useState<CollectionView | null>(null);

  const load = useCallback(async () => {
    const [detail, list] = await Promise.all([
      fetch(`/api/collections/${params.id}`).then((response) => response.json()),
      fetch("/api/collections").then((response) => response.json()),
    ]);
    setName(detail.collection?.name ?? "");
    setItems(detail.items ?? []);
    setCollectionCount((list.collections ?? []).length);
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    setView(saved === "lista" ? "lista" : "grade");
  }, []);

  useEffect(() => {
    if (!view) return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  const scryfallQuery = [syntax, compileQuickFilters(quick)].filter(Boolean).join(" ");
  const parsedQuery = useMemo(() => parseScryfallQuery(scryfallQuery), [scryfallQuery]);
  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (!matchesQuery(item, query)) return false;
      if (!scryfallQuery.trim()) return true;
      if (!parsedQuery.ok) return false;
      return matchScryfallQuery(filtersFromCatalog(item), scryfallQuery);
    });
  }, [items, query, scryfallQuery, parsedQuery]);

  const knownTags = useMemo(() => collectTags(items.map((item) => item.tags ?? [])), [items]);

  async function addText(text: string, preferSet?: string) {
    setStatus("Buscando…");
    const response = await fetch(`/api/collections/${params.id}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, set: preferSet || setCode || undefined }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(typeof data.error === "string" ? data.error : "Não foi possível importar a lista.");
      return;
    }
    setStatus(unresolvedCardsMessage(data.missing ?? [], data.added ?? 0));
    await load();
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

  async function saveItemMeta(catalogCardId: string, values: CardMetaValues) {
    const response = await fetch(`/api/collections/${params.id}/cards`, {
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

  function updateTags(catalogCardId: string, change: (current: CardTag[], known: CardTag[]) => CardTag[]) {
    const run = tagWrites.current.then(async () => {
      const current = itemsRef.current;
      const item = current.find((entry) => entry.id === catalogCardId);
      const known = collectTags(current.map((entry) => entry.tags ?? []));
      const next = change(item?.tags ?? [], known);
      const updated = current.map((entry) => (entry.id === catalogCardId ? { ...entry, tags: next } : entry));
      itemsRef.current = updated;
      setItems(updated);
      const response = await fetch(`/api/collections/${params.id}/cards`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalogCardId, tags: next }),
      });
      if (!response.ok) setStatus("Não foi possível salvar a tag.");
      await load();
    });
    tagWrites.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function deleteCollection() {
    if (collectionCount <= 1) {
      setStatus("Não é possível apagar a última coleção.");
      return;
    }
    const total = items.reduce((n, item) => n + item.quantity, 0);
    const label =
      total > 0
        ? `Excluir “${name}” e suas ${total} carta(s)? Esta ação não pode ser desfeita.`
        : `Excluir “${name}”?`;
    if (!window.confirm(label)) return;

    setDeleting(true);
    const response = await fetch(`/api/collections/${params.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setDeleting(false);
    if (!response.ok) {
      setStatus(typeof data.error === "string" ? data.error : "Não foi possível excluir.");
      return;
    }
    router.push("/colecao");
  }

  function renderMetaButton(item: Item, compact = false) {
    return (
      <button
        type="button"
        className={compact ? "flex h-6 w-6 items-center justify-center text-muted hover:text-ink" : "text-xs underline"}
        aria-label={`Detalhes de ${item.name_pt ?? item.name_en}`}
        title="Detalhes da carta (preço e nota)"
        onClick={() => setMetaItem(item)}
      >
        {compact ? <EyeIcon /> : "Preço / Nota"}
      </button>
    );
  }

  const emptyMessage =
    items.length === 0
      ? "Nenhuma carta nesta coleção."
      : scryfallQuery.trim()
        ? "Nenhuma carta corresponde aos filtros."
        : "Nenhuma carta corresponde à busca.";

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="ui-label mb-1">Archive / Collection</p>
            <h1 className="ui-headline">{name}</h1>
            <p className="mt-1 text-[13px] text-muted">
              {query.trim() || scryfallQuery.trim()
                ? `${visibleItems.length} de ${items.length} cartas`
                : `${items.reduce((n, item) => n + item.quantity, 0)} cartas`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/colecao" className="ui-btn-outline h-9 px-3">
              Voltar
            </Link>
            <button
              type="button"
              className="ui-btn-outline h-9 px-3 hover:border-danger hover:text-danger disabled:opacity-40"
              disabled={deleting || collectionCount <= 1}
              title={collectionCount <= 1 ? "Não é possível apagar a última coleção" : "Excluir coleção"}
              onClick={() => void deleteCollection()}
            >
              {deleting ? "Excluindo…" : "Excluir coleção"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label="Buscar na coleção"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar na coleção…"
            className="ui-input h-9 max-w-md border-ink"
          />
          <div className="ml-auto flex border border-ink">
            <button
              type="button"
              className={`h-9 rounded-none px-3 ${view !== "lista" ? "ui-btn" : "ui-btn-outline border-0"}`}
              onClick={() => setView("grade")}
            >
              Grade
            </button>
            <button
              type="button"
              className={`h-9 rounded-none px-3 ${view === "lista" ? "ui-btn" : "ui-btn-outline border-0"}`}
              onClick={() => setView("lista")}
            >
              Lista
            </button>
          </div>
        </div>

        <section className="border border-ink bg-surface-container-lowest">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold uppercase tracking-wide"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((open) => !open)}
          >
            <span className="w-4 shrink-0 text-muted" aria-hidden>
              {filterOpen ? "▾" : "▸"}
            </span>
            Filtros
          </button>
          {filterOpen ? (
            <div className="border-t border-border-line p-4">
              <CollectionFilters
                syntax={syntax}
                onSyntaxChange={setSyntax}
                quick={quick}
                onQuickChange={setQuick}
                error={parsedQuery.ok ? null : parsedQuery.error}
              />
            </div>
          ) : null}
        </section>

        <section className="border border-ink bg-surface-container-lowest">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold uppercase tracking-wide"
            aria-expanded={editOpen}
            onClick={() => setEditOpen((open) => !open)}
          >
            <span className="w-4 shrink-0 text-muted" aria-hidden>
              {editOpen ? "▾" : "▸"}
            </span>
            Editar coleção
          </button>
          {editOpen ? (
            <div className="space-y-4 border-t border-border-line p-4">
              <p className="text-[12px] text-muted">
                Se o set não for informado, a impressão mais recente é usada.
              </p>
              <div className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
                <CardSearch
                  placeholder="Adicionar carta…"
                  onSelect={(item) => void addText(`1 ${item.namePt ?? item.nameEn}`)}
                />
                <input
                  aria-label="Set"
                  value={setCode}
                  onChange={(event) => setSetCode(event.target.value)}
                  placeholder="Set, ex. mh3"
                  className="ui-input h-11 border-ink"
                />
                <button type="button" className="ui-btn-outline h-11 px-4" onClick={() => setScannerOpen(true)}>
                  Escanear
                </button>
              </div>
              <div className="space-y-2">
                <textarea
                  aria-label="Lista para adicionar"
                  value={listText}
                  onChange={(event) => setListText(event.target.value)}
                  className="ui-textarea h-28 disabled:opacity-60"
                  placeholder="2 Lightning Bolt"
                  disabled={listImporting}
                />
                <button
                  type="button"
                  className="ui-btn-outline h-9 px-4 disabled:opacity-60"
                  disabled={listImporting}
                  onClick={() => void importListText(listText)}
                >
                  Adicionar lista
                </button>
              </div>
              {status ? <p className="text-[13px] text-muted">{status}</p> : null}
            </div>
          ) : null}
        </section>

        {visibleItems.length === 0 ? (
          <div className="border border-ink px-3 py-6 text-[13px] text-muted">{emptyMessage}</div>
        ) : view === "lista" ? (
          <ul className="divide-y border border-ink">
            {visibleItems.map((item) => {
              const price = formatBRLFromCents(item.price_cents ?? null);
              const thumb = item.image_small ?? item.image_normal;
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-3 px-3 py-1.5 text-[13px]">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="h-12 w-[34px] shrink-0 rounded-[2px] border border-ink object-cover" />
                  ) : (
                    <span className="h-12 w-[34px] shrink-0 border border-border-line bg-surface-container" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-1 truncate font-medium">
                      <span className="shrink-0">{item.quantity}×</span>
                      <TagDots tags={item.tags ?? []} />
                      <span className="truncate">{item.name_pt ?? item.name_en}</span>
                    </p>
                    <p className="truncate text-[12px] text-muted">
                      {item.name_en}
                      <span className="ml-2 uppercase">{item.set_code}</span>
                      {price ? <span className="ml-2 tabular-nums">{price}</span> : null}
                      {itemHasNote(item) ? <span className="ml-2">Com nota</span> : null}
                    </p>
                  </div>
                  {renderMetaButton(item, true)}
                  <CardTagButton
                    label={item.name_pt ?? item.name_en}
                    tags={item.tags ?? []}
                    known={knownTags}
                    onToggle={(tag) => void updateTags(item.id, (current) => toggleTag(current, tag))}
                    onNew={() => setTagItem(item)}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {visibleItems.map((item) => {
              const price = formatBRLFromCents(item.price_cents ?? null);
              return (
                <article key={item.id} className="border border-ink bg-surface-container-lowest">
                  {item.image_normal ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image_normal} alt={item.name_en} className="w-full" />
                  ) : null}
                  <div className="space-y-1 p-3 text-[13px]">
                    <p className="flex items-center gap-1">
                      <span>{item.quantity}×</span>
                      <TagDots tags={item.tags ?? []} />
                      <span>{item.name_pt ?? item.name_en}</span>
                    </p>
                    <p className="text-muted">{item.name_en}</p>
                    <p className="uppercase">{item.set_code}</p>
                    {price ? <p className="tabular-nums">{price}</p> : null}
                    {itemHasNote(item) ? <p className="text-[12px] text-muted">Com nota</p> : null}
                    <div className="flex items-center gap-2">
                      {renderMetaButton(item)}
                      <CardTagButton
                        label={item.name_pt ?? item.name_en}
                        tags={item.tags ?? []}
                        known={knownTags}
                        onToggle={(tag) => void updateTags(item.id, (current) => toggleTag(current, tag))}
                        onNew={() => setTagItem(item)}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      <CardScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title="Escanear para a coleção"
        onConfirm={async (payload) => {
          await addText(`${payload.quantity} ${payload.name}`, payload.set);
        }}
      />
      <LoadingModal
        open={listImporting}
        title="Adicionando cartas"
        message="Importando a lista para a coleção. Aguarde…"
      />
      <CardMetaModal
        open={Boolean(metaItem)}
        title={metaItem ? (metaItem.name_pt ?? metaItem.name_en) : ""}
        initial={{
          priceCents: metaItem?.price_cents ?? null,
          note: metaItem?.note ?? "",
        }}
        onClose={() => setMetaItem(null)}
        onSave={async (values) => {
          if (!metaItem) return;
          await saveItemMeta(metaItem.id, values);
        }}
      />
      <TagCreateModal
        open={Boolean(tagItem)}
        known={knownTags}
        onClose={() => setTagItem(null)}
        onCreate={(tag) => {
          if (!tagItem) return;
          void updateTags(tagItem.id, (current, known) => addTag(current, tag, known));
        }}
      />
    </AppShell>
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
