"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HOVER_PREVIEW_DELAY_MS, PREVIEW_W, imageSrc, type CanvasCard } from "@/lib/deck-canvas-model";
import { formatBRLFromCents } from "@/lib/money-br";
import { useLatestRef } from "@/lib/use-latest-ref";

type HoverPreview = {
  src: string;
  name: string;
  x: number;
  y: number;
};

type CardContextMenu = {
  x: number;
  y: number;
  catalogId: string;
  name: string;
  nameEn: string;
  hasPt: boolean;
  priceLabel: string | null;
};

/**
 * Preview ampliado com delay (US-008-04), menu do botão direito (US-008-05/06) e
 * atalho para o modal de preço/nota, independentes da engine do canvas.
 */
export function useCardOverlays({
  cards,
  onEditCardMeta,
}: {
  cards: CanvasCard[];
  onEditCardMeta?: (catalogCardId: string) => void;
}) {
  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const cardsByIdRef = useLatestRef(cardsById);
  const onEditCardMetaRef = useLatestRef(onEditCardMeta);

  const hoverTimerRef = useRef<number | null>(null);
  const hoverKeyRef = useRef<string | null>(null);
  const hoverPreviewVisibleRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0 });
  const [hoverPreview, setHoverPreview] = useState<HoverPreview | null>(null);
  const [contextMenu, setContextMenu] = useState<CardContextMenu | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const contextMenuOpenRef = useLatestRef(Boolean(contextMenu));

  function clearHoverTimer() {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }

  function hideHoverPreview() {
    clearHoverTimer();
    hoverKeyRef.current = null;
    hoverPreviewVisibleRef.current = false;
    setHoverPreview(null);
  }

  function closeContextMenu() {
    setContextMenu(null);
    setCopyFeedback(null);
  }

  /** Chamar a cada movimento do ponteiro sobre uma carta (`key` identifica a cópia). */
  function hoverCard(key: string, catalogId: string, clientX: number, clientY: number) {
    pointerRef.current = { x: clientX, y: clientY };
    if (contextMenuOpenRef.current) {
      hideHoverPreview();
      return;
    }
    if (hoverKeyRef.current === key) {
      if (hoverPreviewVisibleRef.current) {
        setHoverPreview((prev) =>
          prev ? { ...prev, x: pointerRef.current.x, y: pointerRef.current.y } : prev,
        );
      }
      return;
    }
    clearHoverTimer();
    hoverKeyRef.current = key;
    hoverPreviewVisibleRef.current = false;
    setHoverPreview(null);
    hoverTimerRef.current = window.setTimeout(() => {
      const card = cardsByIdRef.current.get(catalogId);
      const src = card ? imageSrc(card) : null;
      if (!src || !card) {
        setHoverPreview(null);
        return;
      }
      hoverPreviewVisibleRef.current = true;
      setHoverPreview({
        src,
        name: card.name_pt ?? card.name_en,
        x: pointerRef.current.x,
        y: pointerRef.current.y,
      });
      hoverTimerRef.current = null;
    }, HOVER_PREVIEW_DELAY_MS);
  }

  function openContextMenu(catalogId: string, clientX: number, clientY: number) {
    hideHoverPreview();
    const card = cardsByIdRef.current.get(catalogId);
    if (!card) {
      closeContextMenu();
      return;
    }
    setCopyFeedback(null);
    setContextMenu({
      x: clientX,
      y: clientY,
      catalogId,
      name: card.name_pt ?? card.name_en,
      nameEn: card.name_en,
      hasPt: Boolean(card.name_pt),
      priceLabel: formatBRLFromCents(card.price_cents ?? null) || null,
    });
  }

  function editCardMeta(catalogId: string) {
    hideHoverPreview();
    closeContextMenu();
    onEditCardMetaRef.current?.(catalogId);
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback("Nome copiado");
      window.setTimeout(() => closeContextMenu(), 700);
    } catch {
      setCopyFeedback("Falha ao copiar");
    }
  }

  useEffect(() => {
    return () => clearHoverTimer();
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeContextMenu();
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-card-context-menu]")) return;
      closeContextMenu();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [contextMenu]);

  const overlays = (
    <>
      {hoverPreview ? (
        <div
          className="pointer-events-none fixed z-[120]"
          style={{
            left: hoverPreview.x,
            top: hoverPreview.y,
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hoverPreview.src}
            alt={hoverPreview.name}
            width={PREVIEW_W}
            className="border border-black shadow-2xl"
            style={{ width: PREVIEW_W, height: "auto" }}
          />
        </div>
      ) : null}
      {contextMenu ? (
        <div
          data-card-context-menu
          className="fixed z-[130] min-w-[180px] border border-black bg-white py-1 text-sm shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left hover:bg-neutral-100"
            onClick={() => void copyText(contextMenu.name)}
          >
            Copiar nome
          </button>
          {contextMenu.hasPt ? (
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left hover:bg-neutral-100"
              onClick={() => void copyText(contextMenu.nameEn)}
            >
              Copiar nome (EN)
            </button>
          ) : null}
          {contextMenu.priceLabel ? (
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left hover:bg-neutral-100"
              onClick={() => void copyText(contextMenu.priceLabel!)}
            >
              Copiar preço ({contextMenu.priceLabel})
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left hover:bg-neutral-100"
            onClick={() => editCardMeta(contextMenu.catalogId)}
          >
            Preço / Nota…
          </button>
          {copyFeedback ? (
            <p className="border-t border-neutral-200 px-3 py-1.5 text-xs text-neutral-600">{copyFeedback}</p>
          ) : null}
        </div>
      ) : null}
    </>
  );

  return {
    overlays,
    hoverCard,
    hideHoverPreview,
    openContextMenu,
    closeContextMenu,
    editCardMeta,
  };
}
