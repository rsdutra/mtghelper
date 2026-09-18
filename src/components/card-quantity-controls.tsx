"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";

/** Mesmo comportamento do canvas (F-008 / US-008-04), com delay de 1s pedido na lista. */
const HOVER_PREVIEW_DELAY_MS = 1000;
const PREVIEW_W = 280;

type Props = {
  quantity: number;
  label: string;
  secondary?: string | null;
  meta?: string | null;
  imageSrc?: string | null;
  previewSrc?: string | null;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemoveAll: () => void;
  onInspect?: () => void;
  inspectTitle?: string;
  extraActions?: React.ReactNode;
  coverage?: { owned: number; needed: number; missing: number } | null;
};

function largePreviewUrl(small: string | null | undefined, normal: string | null | undefined) {
  if (normal) return normal;
  if (!small) return null;
  return small.replace("/small/", "/normal/");
}

function previewPoint(x: number, y: number) {
  const margin = 12;
  const halfW = PREVIEW_W / 2;
  const halfH = (PREVIEW_W * 88) / 63 / 2;
  return {
    x: Math.min(Math.max(x, halfW + margin), window.innerWidth - halfW - margin),
    y: Math.min(Math.max(y, halfH + margin), window.innerHeight - halfH - margin),
  };
}

export function CardQuantityControls({
  quantity,
  label,
  secondary,
  meta,
  imageSrc,
  previewSrc,
  onIncrement,
  onDecrement,
  onRemoveAll,
  onInspect,
  inspectTitle = "Detalhes da carta",
  extraActions,
  coverage,
}: Props) {
  const src = largePreviewUrl(imageSrc, previewSrc);
  const pointerRef = useRef({ x: 0, y: 0 });
  const timerRef = useRef<number | null>(null);
  const visibleRef = useRef(false);
  const [preview, setPreview] = useState<{ x: number; y: number } | null>(null);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function hidePreview() {
    clearTimer();
    visibleRef.current = false;
    setPreview(null);
  }

  function onPointerEnter(event: PointerEvent<HTMLDivElement>) {
    pointerRef.current = { x: event.clientX, y: event.clientY };
    if (!src) return;
    clearTimer();
    visibleRef.current = false;
    setPreview(null);
    timerRef.current = window.setTimeout(() => {
      visibleRef.current = true;
      setPreview(previewPoint(pointerRef.current.x, pointerRef.current.y));
      timerRef.current = null;
    }, HOVER_PREVIEW_DELAY_MS);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    pointerRef.current = { x: event.clientX, y: event.clientY };
    if (!visibleRef.current) return;
    setPreview(previewPoint(event.clientX, event.clientY));
  }

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-sm">
      <div
        className="flex min-w-0 flex-1 items-center gap-3"
        onPointerEnter={onPointerEnter}
        onPointerMove={onPointerMove}
        onPointerLeave={hidePreview}
      >
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc} alt="" className="h-12 w-[34px] shrink-0 rounded-[2px] border border-ink object-cover" />
        ) : (
          <span className="h-12 w-[34px] shrink-0 border border-border-line bg-surface-container" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{label}</p>
          {secondary ? <p className="truncate text-xs text-neutral-500">{secondary}</p> : null}
          {meta ? <p className="text-xs uppercase text-neutral-500">{meta}</p> : null}
        </div>
      </div>

      <div className="flex items-center gap-0.5 text-muted">
        <button
          type="button"
          aria-label={`Diminuir ${label}`}
          className="flex h-6 w-6 items-center justify-center text-[13px] leading-none text-muted hover:text-ink"
          onClick={onDecrement}
        >
          −
        </button>
        <span aria-label={`Quantidade de ${label}`} className="min-w-5 text-center text-[12px] tabular-nums text-ink">
          {quantity}
        </span>
        <button
          type="button"
          aria-label={`Aumentar ${label}`}
          className="flex h-6 w-6 items-center justify-center text-[13px] leading-none text-muted hover:text-ink"
          onClick={onIncrement}
        >
          +
        </button>
        <button
          type="button"
          aria-label={`Remover todas as cópias de ${label}`}
          title="Remover todas"
          className="flex h-6 w-6 items-center justify-center text-muted hover:text-danger"
          onClick={onRemoveAll}
        >
          <TrashIcon />
        </button>
        {onInspect ? (
          <button
            type="button"
            aria-label={inspectTitle}
            title={inspectTitle}
            className="flex h-6 w-6 items-center justify-center text-muted hover:text-ink"
            onClick={onInspect}
          >
            <EyeIcon />
          </button>
        ) : null}
        {coverage ? (
          <span
            className={`min-w-8 px-0.5 text-center font-mono text-[10px] tabular-nums ${
              coverage.missing > 0 ? "text-danger" : "text-muted"
            }`}
            title={`${coverage.owned} na coleção · ${coverage.needed} no deck (todas as coleções, qualquer set)`}
          >
            {coverage.owned}/{coverage.needed}
          </span>
        ) : null}
      </div>

      {extraActions ? <div className="flex items-center gap-2">{extraActions}</div> : null}

      {preview && src && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[120]"
              style={{
                left: preview.x,
                top: preview.y,
                transform: "translate(-50%, -50%)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={label}
                width={PREVIEW_W}
                className="border border-black shadow-2xl"
                style={{ width: PREVIEW_W, height: "auto" }}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
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
