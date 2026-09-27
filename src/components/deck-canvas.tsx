"use client";

import dynamic from "next/dynamic";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  AssetRecordType,
  createShapeId,
  getSnapshot,
  loadSnapshot,
  toRichText,
  type Editor,
  type TLAssetId,
  type TLEditorSnapshot,
  type TLShapeId,
} from "tldraw";
import "tldraw/tldraw.css";
import { useCardOverlays } from "@/components/deck-canvas-overlays";
import {
  CARD_H,
  CARD_W,
  cardOpacity,
  defaultInSectionPos,
  defaultSectionFrameSize,
  defaultUntaggedPos,
  expand,
  imageSrc,
  primarySection,
  sectionColsForWidth,
  sectionOriginY,
  type CanvasCard,
  type CanvasSaveState,
  type CanvasSection,
  type DeckCanvasHandle,
} from "@/lib/deck-canvas-model";

export type { CanvasCard, CanvasSection, DeckCanvasHandle } from "@/lib/deck-canvas-model";

const Tldraw = dynamic(async () => (await import("tldraw")).Tldraw, {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-neutral-500">
      Carregando canvas…
    </div>
  ),
});

function ensureImageAsset(editor: Editor, key: string, src: string, name: string) {
  const assetId = AssetRecordType.createId(key) as TLAssetId;
  if (!editor.getAsset(assetId)) {
    editor.createAssets([
      AssetRecordType.create({
        id: assetId,
        type: "image",
        props: {
          src,
          w: CARD_W,
          h: CARD_H,
          mimeType: "image/jpeg",
          name,
          isAnimated: false,
        },
      }),
    ]);
  }
  return assetId;
}

/** Marcador visual para cartas com included=false (F-008). */
function syncOutOfDeckMarker(
  editor: Editor,
  shapes: Parameters<Editor["createShapes"]>[0],
  desired: Set<string>,
  cardShapeId: TLShapeId,
  card: CanvasCard & { copy: number },
) {
  const badgeKey = `badge:${card.id}:${card.copy}`;
  if (card.included) return;
  desired.add(badgeKey);
  const badgeId = createShapeId(badgeKey);
  const props = {
    geo: "ellipse" as const,
    w: 16,
    h: 16,
    color: "orange" as const,
    fill: "solid" as const,
    dash: "solid" as const,
    size: "s" as const,
    font: "draw" as const,
    align: "middle" as const,
    verticalAlign: "middle" as const,
    labelColor: "black" as const,
    url: "",
    growY: 0,
    scale: 1,
    flipX: false,
    flipY: false,
    richText: toRichText(""),
  };
  if (!editor.getShape(badgeId)) {
    shapes.push({
      id: badgeId,
      type: "geo",
      parentId: cardShapeId,
      x: 5,
      y: 5,
      isLocked: true,
      meta: { mtgKey: badgeKey, kind: "included-badge", catalogId: card.id },
      props,
    });
  } else {
    editor.updateShape({
      id: badgeId,
      type: "geo",
      parentId: cardShapeId,
      x: 5,
      y: 5,
      isLocked: true,
      meta: { mtgKey: badgeKey, kind: "included-badge", catalogId: card.id },
      props,
    });
  }
}

/**
 * Sincroniza shapes com o domínio sem sobrescrever layout persistido (F-008).
 * - Shape novo → posição/tamanho default
 * - Shape existente → mantém x/y/w/h; só atualiza meta/opacidade/nome e reparent se a seção mudou
 */
function syncBoard(editor: Editor, cards: CanvasCard[], sections: CanvasSection[]): boolean {
  const desired = new Set<string>();
  const shapes: Parameters<Editor["createShapes"]>[0] = [];
  const pageId = editor.getCurrentPageId();
  const sectionsById = new Map(sections.map((section) => [section.id, section]));
  let layoutMutated = false;

  const untagged = expand(cards.filter((card) => !primarySection(card, sectionsById)));
  const bySection = new Map<string, Array<CanvasCard & { copy: number }>>();
  for (const card of expand(cards)) {
    const sectionId = primarySection(card, sectionsById);
    if (!sectionId) continue;
    const list = bySection.get(sectionId) ?? [];
    list.push(card);
    bySection.set(sectionId, list);
  }

  untagged.forEach((card, index) => {
    const src = imageSrc(card);
    if (!src) return;
    const key = `card:${card.id}:${card.copy}`;
    desired.add(key);
    ensureImageAsset(editor, key, src, card.name_en);
    const shapeId = createShapeId(key);
    const fallback = defaultUntaggedPos(index);
    const existing = editor.getShape(shapeId);
    if (!existing) {
      shapes.push({
        id: shapeId,
        type: "image",
        parentId: pageId,
        x: fallback.x,
        y: fallback.y,
        opacity: cardOpacity(card.included),
        meta: { mtgKey: key, catalogId: card.id, kind: "card", included: card.included },
        props: {
          assetId: AssetRecordType.createId(key),
          w: CARD_W,
          h: CARD_H,
        },
      });
      syncOutOfDeckMarker(editor, shapes, desired, shapeId, card);
      layoutMutated = true;
    } else {
      const parentChanged = existing.parentId !== pageId;
      editor.updateShape({
        id: shapeId,
        type: "image",
        parentId: pageId,
        ...(parentChanged ? { x: fallback.x, y: fallback.y } : {}),
        opacity: cardOpacity(card.included),
        meta: { mtgKey: key, catalogId: card.id, kind: "card", included: card.included },
      });
      syncOutOfDeckMarker(editor, shapes, desired, shapeId, card);
      if (parentChanged) layoutMutated = true;
    }
  });

  const framesOriginY = sectionOriginY(untagged.length);

  sections.forEach((section, sectionIndex) => {
    const frameKey = `frame:${section.id}`;
    desired.add(frameKey);
    const frameId = createShapeId(frameKey);
    const cardsInSection = bySection.get(section.id) ?? [];
    const defaults = defaultSectionFrameSize(cardsInSection.length);
    const existingFrame = editor.getShape(frameId);

    if (!existingFrame) {
      shapes.push({
        id: frameId,
        type: "frame",
        parentId: pageId,
        x: 48 + sectionIndex * (defaults.w + 48),
        y: framesOriginY,
        meta: {
          mtgKey: frameKey,
          sectionId: section.id,
          kind:
            section.kind === "type"
              ? "type-section-frame"
              : section.kind === "cost"
                ? "cost-section-frame"
                : "section-frame",
        },
        props: { w: defaults.w, h: defaults.h, name: section.name },
      });
      layoutMutated = true;
    } else {
      // Preserva x/y/w/h do usuário; só nome + meta.
      editor.updateShape({
        id: frameId,
        type: "frame",
        props: { name: section.name },
        meta: {
          mtgKey: frameKey,
          sectionId: section.id,
          kind:
            section.kind === "type"
              ? "type-section-frame"
              : section.kind === "cost"
                ? "cost-section-frame"
                : "section-frame",
        },
      });
    }

    // cols para layout inicial de cartas novas dentro do frame (usa largura atual se já existir).
    const frameW =
      existingFrame && existingFrame.type === "frame"
        ? Number(existingFrame.props.w) || defaults.w
        : defaults.w;
    const cols = sectionColsForWidth(frameW, defaults.cols);

    cardsInSection.forEach((card, index) => {
      const src = imageSrc(card);
      if (!src) return;
      const key = `card:${card.id}:${card.copy}`;
      desired.add(key);
      ensureImageAsset(editor, key, src, card.name_en);
      const shapeId = createShapeId(key);
      const fallback = defaultInSectionPos(index, cols);
      const existing = editor.getShape(shapeId);
      if (!existing) {
        shapes.push({
          id: shapeId,
          type: "image",
          parentId: frameId,
          x: fallback.x,
          y: fallback.y,
          opacity: cardOpacity(card.included),
          meta: {
            mtgKey: key,
            catalogId: card.id,
            kind: "card",
            included: card.included,
            sectionId: section.id,
          },
          props: {
            assetId: AssetRecordType.createId(key),
            w: CARD_W,
            h: CARD_H,
          },
        });
        syncOutOfDeckMarker(editor, shapes, desired, shapeId, card);
        layoutMutated = true;
      } else {
        const parentChanged = existing.parentId !== frameId;
        editor.updateShape({
          id: shapeId,
          type: "image",
          parentId: frameId,
          ...(parentChanged ? { x: fallback.x, y: fallback.y } : {}),
          opacity: cardOpacity(card.included),
          meta: {
            mtgKey: key,
            catalogId: card.id,
            kind: "card",
            included: card.included,
            sectionId: section.id,
          },
        });
        syncOutOfDeckMarker(editor, shapes, desired, shapeId, card);
        if (parentChanged) layoutMutated = true;
      }
    });
  });

  if (shapes.length) {
    editor.createShapes(shapes);
    layoutMutated = true;
  }

  const removable: TLShapeId[] = [];
  for (const shape of editor.getCurrentPageShapes()) {
    const key = shape.meta?.mtgKey;
    if (typeof key === "string" && !desired.has(key)) {
      removable.push(shape.id);
    }
  }
  if (removable.length) {
    editor.deleteShapes(removable);
    layoutMutated = true;
  }
  return layoutMutated;
}

function sectionIdFromParent(editor: Editor, parentId: string) {
  const parent = editor.getShape(parentId as TLShapeId);
  if (!parent || parent.type !== "frame") return null;
  const key = parent.meta?.mtgKey;
  if (typeof key === "string" && key.startsWith("frame:")) return key.slice("frame:".length);
  const sectionId = parent.meta?.sectionId;
  return typeof sectionId === "string" ? sectionId : null;
}

type Props = {
  deckId: string;
  initialSnapshot: TLEditorSnapshot | null;
  cards: CanvasCard[];
  sections: CanvasSection[];
  onDirtyChange?: (dirty: boolean) => void;
  onSaveState?: (state: CanvasSaveState, updatedAt?: string | null) => void;
  onDomainChange?: () => void;
  onEditCardMeta?: (catalogCardId: string) => void;
};

export const DeckCanvas = forwardRef<DeckCanvasHandle, Props>(function DeckCanvas(
  { deckId, initialSnapshot, cards, sections, onDirtyChange, onSaveState, onDomainChange, onEditCardMeta },
  ref,
) {
  const editorRef = useRef<Editor | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const readyRef = useRef(false);
  const syncingRef = useRef(false);
  const listenUnsubRef = useRef<(() => void) | null>(null);
  const boardRef = useRef({ cards, sections });
  boardRef.current = { cards, sections };
  const onDomainChangeRef = useRef(onDomainChange);
  onDomainChangeRef.current = onDomainChange;
  const { overlays, hoverCard, hideHoverPreview, openContextMenu, closeContextMenu, editCardMeta } =
    useCardOverlays({ cards, onEditCardMeta });

  function cardShapeAtClientPoint(editor: Editor, clientX: number, clientY: number) {
    const pagePoint = editor.screenToPage({ x: clientX, y: clientY });
    let shape =
      editor.getShapeAtPoint(pagePoint, { hitInside: true }) ?? editor.getHoveredShape();
    if (shape?.meta?.kind === "included-badge") {
      shape = editor.getShape(shape.parentId) ?? undefined;
    }
    if (!shape || shape.meta?.kind !== "card") return null;
    const catalogId = shape.meta?.catalogId;
    if (typeof catalogId !== "string") return null;
    return { shape, catalogId };
  }

  function handleEditorContextMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const editor = editorRef.current;
    if (!editor || !readyRef.current) {
      closeContextMenu();
      return;
    }
    const hit = cardShapeAtClientPoint(editor, event.clientX, event.clientY);
    if (!hit) {
      closeContextMenu();
      return;
    }
    openContextMenu(hit.catalogId, event.clientX, event.clientY);
  }

  function handleEditorDoubleClick(event: MouseEvent) {
    const editor = editorRef.current;
    if (!editor || !readyRef.current) return;
    const hit = cardShapeAtClientPoint(editor, event.clientX, event.clientY);
    if (!hit) return;
    event.preventDefault();
    event.stopPropagation();
    editCardMeta(hit.catalogId);
  }

  const handleEditorContextMenuRef = useRef(handleEditorContextMenu);
  handleEditorContextMenuRef.current = handleEditorContextMenu;
  const handleEditorDoubleClickRef = useRef(handleEditorDoubleClick);
  handleEditorDoubleClickRef.current = handleEditorDoubleClick;

  function handleEditorPointerMove(event: PointerEvent) {
    const editor = editorRef.current;
    if (!editor || !readyRef.current || event.buttons !== 0) {
      hideHoverPreview();
      return;
    }

    const hit = cardShapeAtClientPoint(editor, event.clientX, event.clientY);
    if (!hit) {
      hideHoverPreview();
      return;
    }
    const key =
      typeof hit.shape.meta?.mtgKey === "string" ? hit.shape.meta.mtgKey : hit.shape.id;
    hoverCard(key, hit.catalogId, event.clientX, event.clientY);
  }

  const handleEditorPointerMoveRef = useRef(handleEditorPointerMove);
  handleEditorPointerMoveRef.current = handleEditorPointerMove;
  const hideHoverPreviewRef = useRef(hideHoverPreview);
  hideHoverPreviewRef.current = hideHoverPreview;

  function markDirty() {
    if (!readyRef.current || syncingRef.current) return;
    dirtyRef.current = true;
    onDirtyChange?.(true);
  }

  async function persist(options?: { force?: boolean; keepalive?: boolean }) {
    const editor = editorRef.current;
    if (!editor) {
      onSaveState?.("error");
      return false;
    }
    if (savingRef.current) return false;
    if (!options?.force && !dirtyRef.current) return true;

    savingRef.current = true;
    onSaveState?.("saving");
    try {
      const snapshot = getSnapshot(editor.store);
      const response = await fetch(`/api/decks/${deckId}/canvas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
        ...(options?.keepalive ? { keepalive: true } : {}),
      });
      if (!response.ok) throw new Error("save failed");
      const data = (await response.json()) as { updatedAt?: string };
      dirtyRef.current = false;
      onDirtyChange?.(false);
      onSaveState?.("saved", data.updatedAt ?? null);
      return true;
    } catch {
      onSaveState?.("error");
      return false;
    } finally {
      savingRef.current = false;
    }
  }

  useImperativeHandle(ref, () => ({
    save: (options) => persist({ force: true, keepalive: options?.keepalive }),
    isDirty: () => dirtyRef.current,
  }));

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !readyRef.current) return;
    let changed = false;
    syncingRef.current = true;
    editor.run(() => {
      changed = syncBoard(editor, cards, sections);
    });
    syncingRef.current = false;
    if (changed) markDirty();
  }, [cards, sections]);

  useEffect(() => {
    return () => {
      listenUnsubRef.current?.();
      listenUnsubRef.current = null;
    };
  }, []);

  return (
    <div
      className="relative h-full w-full [&_.tl-background]:bg-neutral-100"
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <Tldraw
        hideUi
        onMount={(editor) => {
          editorRef.current = editor;
          editor.user.updateUserPreferences({ colorScheme: "light" });
          editor.setCurrentTool("select");

          syncingRef.current = true;
          editor.run(() => {
            if (initialSnapshot) {
              try {
                loadSnapshot(editor.store, initialSnapshot);
              } catch {
                // snapshot inválido
              }
            }
            const board = boardRef.current;
            syncBoard(editor, board.cards, board.sections);
          });
          syncingRef.current = false;

          if (!initialSnapshot && editor.getCurrentPageShapeIds().size) {
            editor.zoomToFit({ animation: { duration: 0 } });
          }

          const container = editor.getContainer();
          const onPointerMove = (event: PointerEvent) => handleEditorPointerMoveRef.current(event);
          const onPointerLeave = () => hideHoverPreviewRef.current();
          const onPointerDown = () => hideHoverPreviewRef.current();
          const onContextMenu = (event: MouseEvent) => handleEditorContextMenuRef.current(event);
          const onDoubleClick = (event: MouseEvent) => handleEditorDoubleClickRef.current(event);
          container.addEventListener("pointermove", onPointerMove);
          container.addEventListener("pointerleave", onPointerLeave);
          container.addEventListener("pointerdown", onPointerDown);
          container.addEventListener("contextmenu", onContextMenu, true);
          container.addEventListener("dblclick", onDoubleClick);

          const cleanups = [
            () => {
              container.removeEventListener("pointermove", onPointerMove);
              container.removeEventListener("pointerleave", onPointerLeave);
              container.removeEventListener("pointerdown", onPointerDown);
              container.removeEventListener("contextmenu", onContextMenu, true);
              container.removeEventListener("dblclick", onDoubleClick);
            },
            editor.sideEffects.registerAfterDeleteHandler("shape", (shape) => {
              if (syncingRef.current) return;
              if (shape.meta?.kind !== "card") return;
              const catalogId = shape.meta?.catalogId;
              if (typeof catalogId !== "string") return;
              void fetch(`/api/decks/${deckId}/cards`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ catalogCardId: catalogId, quantity: 1 }),
              }).then((response) => {
                if (response.ok) onDomainChangeRef.current?.();
              });
              markDirty();
            }),
            editor.sideEffects.registerAfterChangeHandler("shape", (prev, next) => {
              if (syncingRef.current) return;
              if (next.meta?.kind !== "card") return;
              if (prev.parentId === next.parentId) return;
              const catalogId = next.meta?.catalogId;
              if (typeof catalogId !== "string") return;
              const sectionId = sectionIdFromParent(editor, next.parentId);
              void fetch(`/api/decks/${deckId}/cards`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  catalogCardId: catalogId,
                  setSectionId: sectionId,
                }),
              }).then((response) => {
                if (response.ok) onDomainChangeRef.current?.();
              });
              markDirty();
            }),
            editor.store.listen(() => markDirty(), { source: "user", scope: "document" }),
          ];

          listenUnsubRef.current = () => cleanups.forEach((fn) => fn());
          readyRef.current = true;
          dirtyRef.current = false;
          onDirtyChange?.(false);
        }}
      />
      {overlays}
    </div>
  );
});
