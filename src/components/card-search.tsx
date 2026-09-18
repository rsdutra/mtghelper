"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type Suggestion = {
  catalogId: string;
  nameEn: string;
  namePt: string | null;
  setCode: string;
  imageSmall: string | null;
  imageNormal?: string | null;
};

type Props = {
  placeholder?: string;
  onSelect: (suggestion: Suggestion) => void;
  initialQuery?: string;
};

const HOVER_DELAY_MS = 1000;

function previewUrl(item: Suggestion) {
  if (item.imageNormal) return item.imageNormal;
  if (!item.imageSmall) return null;
  return item.imageSmall.replace("/small/", "/normal/");
}

export function CardSearch({ placeholder = "Buscar carta", onSelect, initialQuery = "" }: Props) {
  const listId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ src: string; top: number; left: number; name: string } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (query.trim().length < 4) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const handle = setTimeout(() => {
      setLoading(true);
      void fetch(`/api/cards/suggest?q=${encodeURIComponent(query.trim())}`)
        .then((response) => response.json())
        .then((data) => {
          setSuggestions(data.suggestions ?? []);
          setOpen(true);
        })
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) {
        setOpen(false);
        clearHover();
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    return () => clearHover();
  }, []);

  function clearHover() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setPreview(null);
  }

  function schedulePreview(item: Suggestion, target: HTMLElement) {
    clearHover();
    const src = previewUrl(item);
    if (!src) return;
    const rect = target.getBoundingClientRect();
    hoverTimer.current = setTimeout(() => {
      const left = Math.min(rect.right + 12, window.innerWidth - 260);
      const top = Math.min(Math.max(12, rect.top - 40), window.innerHeight - 380);
      setPreview({
        src,
        left,
        top,
        name: item.namePt ?? item.nameEn,
      });
    }, HOVER_DELAY_MS);
  }

  return (
    <div ref={box} className="relative">
      <input
        aria-label="Buscar carta"
        aria-controls={listId}
        aria-expanded={open}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        className="ui-input h-11 border-ink"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            clearHover();
          }
        }}
      />
      {loading ? <span className="absolute top-3 right-3 text-xs">…</span> : null}
      {open ? (
        <ul
          id={listId}
          className="absolute z-20 mt-1 max-h-80 w-full overflow-auto border border-ink bg-surface-container-lowest shadow-[2px_2px_0_rgba(9,9,11,0.08)]"
        >
          {suggestions.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-muted">Nenhuma carta</li>
          ) : (
            suggestions.map((item) => (
              <li key={item.catalogId}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 border-b border-[#f4f4f5] px-3 py-2 text-left hover:bg-[#fafafa]"
                  onMouseEnter={(event) => schedulePreview(item, event.currentTarget)}
                  onMouseLeave={clearHover}
                  onFocus={(event) => schedulePreview(item, event.currentTarget)}
                  onBlur={clearHover}
                  onClick={() => {
                    onSelect(item);
                    setQuery("");
                    setOpen(false);
                    clearHover();
                  }}
                >
                  {item.imageSmall ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageSmall} alt="" className="h-10 w-7 object-cover" />
                  ) : (
                    <span className="h-10 w-7 border border-border-line" />
                  )}
                  <span>
                    <span className="block text-[13px] font-medium text-ink">{item.namePt ?? item.nameEn}</span>
                    <span className="block text-[12px] text-muted">{item.nameEn}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      {preview && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[80] border border-ink bg-surface-container-lowest p-2 shadow-[4px_4px_0_#09090b]"
              style={{ top: preview.top, left: preview.left }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.src} alt={preview.name} className="h-[340px] w-auto" />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
