"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";

const PREVIEW_W = 280;
const PREVIEW_H = (PREVIEW_W * 88) / 63;
const GAP = 16;
const VIEWPORT_MARGIN = 12;

/** Faixa horizontal que o preview não deve cobrir (ex.: carta + coluna de ações). */
type Anchor = { left: number; right: number };

type Preview = { src: string; name: string; x: number; y: number; anchor: Anchor | null };

/** À direita do anchor (ou do cursor), vira para a esquerda perto da borda; sempre dentro da viewport. */
function previewBox({ x, y, anchor }: Preview) {
  const { left: avoidLeft, right: avoidRight } = anchor ?? { left: x, right: x };
  const maxLeft = window.innerWidth - PREVIEW_W - VIEWPORT_MARGIN;
  let left = avoidRight + GAP;
  if (left > maxLeft) left = avoidLeft - GAP - PREVIEW_W;
  return {
    left: Math.min(Math.max(left, VIEWPORT_MARGIN), maxLeft),
    top: Math.min(
      Math.max(y - PREVIEW_H / 2, VIEWPORT_MARGIN),
      window.innerHeight - PREVIEW_H - VIEWPORT_MARGIN,
    ),
  };
}

/**
 * Preview ampliado da carta ao pairar (F-008 / US-008-04, F-010 / US-010-05).
 * `hover` deve ser chamado a cada movimento sobre a carta; `key` identifica o alvo.
 */
export function useCardHoverPreview(delayMs: number) {
  const timerRef = useRef<number | null>(null);
  const keyRef = useRef<string | null>(null);
  const visibleRef = useRef(false);
  const pointerRef = useRef<{ x: number; y: number; anchor: Anchor | null }>({ x: 0, y: 0, anchor: null });
  const [preview, setPreview] = useState<Preview | null>(null);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function hide() {
    clearTimer();
    keyRef.current = null;
    visibleRef.current = false;
    setPreview(null);
  }

  function hover(
    key: string,
    src: string | null,
    name: string,
    clientX: number,
    clientY: number,
    anchor: Anchor | null = null,
  ) {
    pointerRef.current = { x: clientX, y: clientY, anchor };
    if (!src) {
      hide();
      return;
    }
    if (keyRef.current === key) {
      if (visibleRef.current) setPreview((prev) => (prev ? { ...prev, ...pointerRef.current } : prev));
      return;
    }
    clearTimer();
    keyRef.current = key;
    visibleRef.current = false;
    setPreview(null);
    timerRef.current = window.setTimeout(() => {
      visibleRef.current = true;
      setPreview({ src, name, ...pointerRef.current });
      timerRef.current = null;
    }, delayMs);
  }

  /**
   * Handlers de ponteiro para um elemento DOM que representa a carta.
   * Com `extendRight`, o preview fica ao lado do elemento (mais essa largura) em vez de seguir o cursor.
   */
  function bind(key: string, src: string | null, name: string, extendRight?: number) {
    const onPointer = (event: PointerEvent<HTMLElement>) => {
      let anchor: Anchor | null = null;
      if (extendRight !== undefined) {
        const rect = event.currentTarget.getBoundingClientRect();
        anchor = { left: rect.left, right: rect.right + extendRight };
      }
      hover(key, src, name, event.clientX, event.clientY, anchor);
    };
    return { onPointerEnter: onPointer, onPointerMove: onPointer, onPointerLeave: hide };
  }

  useEffect(() => {
    return () => clearTimer();
  }, []);

  const box = preview && typeof window !== "undefined" ? previewBox(preview) : null;
  const overlay =
    preview && box && typeof document !== "undefined"
      ? createPortal(
          <div
            data-testid="card-hover-preview"
            className="pointer-events-none fixed z-[120]"
            style={{ left: box.left, top: box.top }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.src}
              alt={preview.name}
              width={PREVIEW_W}
              className="aspect-[63/88] border border-black bg-surface-container object-cover shadow-2xl"
              style={{ width: PREVIEW_W }}
            />
          </div>,
          document.body,
        )
      : null;

  return { hover, hide, bind, overlay };
}
