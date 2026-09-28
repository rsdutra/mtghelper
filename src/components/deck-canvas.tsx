"use client";

import dynamic from "next/dynamic";
import { forwardRef, useImperativeHandle, useRef } from "react";
import type {
  CanvasCard,
  CanvasSaveState,
  CanvasSection,
  DeckCanvasHandle,
} from "@/lib/deck-canvas-model";

export type { CanvasCard, CanvasSection, DeckCanvasHandle } from "@/lib/deck-canvas-model";

/**
 * Snapshot do canvas (F-008 / US-008-08); posições de cartas são relativas ao frame pai.
 * `engine: "konva"` identifica o formato gravado em `deck_canvas_konva`.
 */
export type DeckCanvasSnapshot = {
  engine: "konva";
  version: 1;
  camera: { x: number; y: number; scale: number };
  cards: Record<string, { parent: string | null; x: number; y: number }>;
  frames: Record<string, { x: number; y: number; w: number; h: number }>;
};

export type DeckCanvasBoardProps = {
  deckId: string;
  initialSnapshot: DeckCanvasSnapshot | null;
  cards: CanvasCard[];
  sections: CanvasSection[];
  handleRef: { current: DeckCanvasHandle | null };
  onDirtyChange?: (dirty: boolean) => void;
  onSaveState?: (state: CanvasSaveState, updatedAt?: string | null) => void;
  onDomainChange?: () => void;
  onEditCardMeta?: (catalogCardId: string) => void;
  /** Visualização (F-011 / US-011-02): só pan, zoom, preview e copiar; nada é alterado nem salvo. */
  readOnly?: boolean;
};

const DeckCanvasBoard = dynamic(
  async () => (await import("@/components/deck-canvas-board")).DeckCanvasBoard,
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-neutral-500">
        Carregando canvas…
      </div>
    ),
  },
);

type Props = Omit<DeckCanvasBoardProps, "handleRef" | "initialSnapshot"> & {
  initialSnapshot: unknown;
};

function parseSnapshot(value: unknown): DeckCanvasSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Partial<DeckCanvasSnapshot>;
  if (snapshot.engine !== "konva" || snapshot.version !== 1) return null;
  if (!snapshot.camera || !snapshot.cards || !snapshot.frames) return null;
  return snapshot as DeckCanvasSnapshot;
}

export const DeckCanvas = forwardRef<DeckCanvasHandle, Props>(function DeckCanvas(
  { initialSnapshot, ...props },
  ref,
) {
  const handleRef = useRef<DeckCanvasHandle | null>(null);

  useImperativeHandle(ref, () => ({
    save: (options) => handleRef.current?.save(options) ?? Promise.resolve(false),
    isDirty: () => handleRef.current?.isDirty() ?? false,
  }));

  return (
    <DeckCanvasBoard {...props} initialSnapshot={parseSnapshot(initialSnapshot)} handleRef={handleRef} />
  );
});
