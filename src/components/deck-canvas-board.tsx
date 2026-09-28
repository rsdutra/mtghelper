"use client";

import type Konva from "konva";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Circle, Group, Image as KonvaImage, Layer, Rect, Stage, Text } from "react-konva";
import type { DeckCanvasBoardProps, DeckCanvasSnapshot } from "@/components/deck-canvas";
import { useCardOverlays } from "@/components/deck-canvas-overlays";
import {
  CARD_H,
  CARD_W,
  cardKey,
  cardOpacity,
  defaultInSectionPos,
  defaultSectionFrameSize,
  defaultUntaggedPos,
  expand,
  groupCopiesBySection,
  imageSrc,
  sectionColsForWidth,
  sectionOriginY,
  type CanvasCard,
  type CanvasSection,
  type CardCopy,
} from "@/lib/deck-canvas-model";
import { useLatestRef } from "@/lib/use-latest-ref";

type CardPos = DeckCanvasSnapshot["cards"][string];
type FrameRect = DeckCanvasSnapshot["frames"][string];
type Camera = DeckCanvasSnapshot["camera"];
type Layout = { cards: Record<string, CardPos>; frames: Record<string, FrameRect> };
type Point = { x: number; y: number };

const MIN_SCALE = 0.1;
const MAX_SCALE = 4;
const FRAME_MIN_W = 180;
const FRAME_MIN_H = 120;
const RESIZE_HANDLE = 14;
const FRAME_GAP = 48;
const SELECTION_COLOR = "#2563eb";

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * Sincroniza o layout com o domínio sem sobrescrever posições salvas (F-008 / US-008-08).
 * Só itens novos ou cuja seção principal mudou recebem posição default.
 */
function syncLayout(prev: Layout, cards: CanvasCard[], sections: CanvasSection[]) {
  const { untagged, bySection } = groupCopiesBySection(cards, sections);
  const next: Layout = { cards: {}, frames: {} };
  let changed = false;

  untagged.forEach((card, index) => {
    if (!imageSrc(card)) return;
    const key = cardKey(card);
    const existing = prev.cards[key];
    if (existing && existing.parent === null) {
      next.cards[key] = existing;
    } else {
      next.cards[key] = { parent: null, ...defaultUntaggedPos(index) };
      changed = true;
    }
  });

  const originY = sectionOriginY(untagged.length);
  let cursorX = FRAME_GAP;
  sections.forEach((section) => {
    const copies = bySection.get(section.id) ?? [];
    const defaults = defaultSectionFrameSize(copies.length);
    const existingFrame = prev.frames[section.id];
    const frame = existingFrame ?? { x: cursorX, y: originY, w: defaults.w, h: defaults.h };
    if (!existingFrame) changed = true;
    next.frames[section.id] = frame;
    if (!existingFrame) cursorX = frame.x + frame.w + FRAME_GAP;

    const cols = sectionColsForWidth(frame.w, defaults.cols);
    copies.forEach((card, index) => {
      if (!imageSrc(card)) return;
      const key = cardKey(card);
      const existing = prev.cards[key];
      if (existing && existing.parent === section.id) {
        next.cards[key] = existing;
      } else {
        next.cards[key] = { parent: section.id, ...defaultInSectionPos(index, cols) };
        changed = true;
      }
    });
  });

  if (
    Object.keys(prev.cards).some((key) => !(key in next.cards)) ||
    Object.keys(prev.frames).some((key) => !(key in next.frames))
  ) {
    changed = true;
  }
  return { layout: next, changed };
}

function absolutePos(pos: CardPos, frames: Layout["frames"]): Point {
  const frame = pos.parent ? frames[pos.parent] : undefined;
  return frame ? { x: frame.x + pos.x, y: frame.y + pos.y } : { x: pos.x, y: pos.y };
}

/** Frame mais ao topo que contém o centro da carta (ordem de render = ordem das seções). */
function frameAtCardCenter(abs: Point, sections: CanvasSection[], frames: Layout["frames"]) {
  const cx = abs.x + CARD_W / 2;
  const cy = abs.y + CARD_H / 2;
  for (let i = sections.length - 1; i >= 0; i -= 1) {
    const frame = frames[sections[i].id];
    if (!frame) continue;
    if (cx >= frame.x && cx <= frame.x + frame.w && cy >= frame.y && cy <= frame.y + frame.h) {
      return sections[i].id;
    }
  }
  return null;
}

function useCardImages(srcs: string[]) {
  const cacheRef = useRef(new Map<string, HTMLImageElement>());
  const [, setVersion] = useState(0);

  useEffect(() => {
    for (const src of srcs) {
      if (cacheRef.current.has(src)) continue;
      const image = new window.Image();
      image.onload = () => setVersion((version) => version + 1);
      image.src = src;
      cacheRef.current.set(src, image);
    }
  }, [srcs]);

  return (src: string | null) => {
    if (!src) return null;
    const image = cacheRef.current.get(src);
    return image && image.complete && image.naturalWidth > 0 ? image : null;
  };
}

type DragState = {
  anchorKey: string;
  anchorStart: Point;
  others: Map<string, Point>;
};

type PointerGesture =
  | { kind: "pan"; startClient: Point; startCamera: Camera }
  | { kind: "marquee"; start: Point; additive: boolean };

export function DeckCanvasBoard({
  deckId,
  initialSnapshot,
  cards,
  sections,
  handleRef,
  onDirtyChange,
  onSaveState,
  onDomainChange,
  onEditCardMeta,
  readOnly = false,
}: DeckCanvasBoardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const cardNodesRef = useRef(new Map<string, Konva.Group>());
  const [size, setSize] = useState({ width: 0, height: 0 });

  const [layout, setLayoutState] = useState<Layout>(
    () =>
      syncLayout(
        { cards: initialSnapshot?.cards ?? {}, frames: initialSnapshot?.frames ?? {} },
        cards,
        sections,
      ).layout,
  );
  const layoutRef = useRef(layout);
  const setLayout = useCallback((next: Layout) => {
    layoutRef.current = next;
    setLayoutState(next);
  }, []);

  const [camera, setCameraState] = useState<Camera>(
    () => initialSnapshot?.camera ?? { x: 0, y: 0, scale: 1 },
  );
  const cameraRef = useRef(camera);
  const setCamera = useCallback((next: Camera) => {
    cameraRef.current = next;
    setCameraState(next);
  }, []);
  const needsFitRef = useRef(!initialSnapshot);

  const [selected, setSelectedState] = useState<Set<string>>(() => new Set());
  const selectedRef = useRef(selected);
  const setSelected = useCallback((next: Set<string>) => {
    selectedRef.current = next;
    setSelectedState(next);
  }, []);

  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const gestureRef = useRef<PointerGesture | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const readyRef = useRef(false);
  const deckIdRef = useLatestRef(deckId);
  const onDomainChangeRef = useLatestRef(onDomainChange);
  const onDirtyChangeRef = useLatestRef(onDirtyChange);
  const onSaveStateRef = useLatestRef(onSaveState);

  const { overlays, hoverCard, hideHoverPreview, openContextMenu, closeContextMenu, editCardMeta } =
    useCardOverlays({ cards, onEditCardMeta: readOnly ? undefined : onEditCardMeta });

  const copies = useMemo(() => expand(cards), [cards]);
  const copiesByKey = useMemo(() => new Map(copies.map((copy) => [cardKey(copy), copy])), [copies]);
  const srcs = useMemo(
    () => [...new Set(copies.map((copy) => imageSrc(copy)).filter((src): src is string => Boolean(src)))],
    [copies],
  );
  const imageFor = useCardImages(srcs);

  const markDirty = useCallback(() => {
    if (!readyRef.current || readOnly) return;
    dirtyRef.current = true;
    onDirtyChangeRef.current?.(true);
  }, [onDirtyChangeRef, readOnly]);

  const persist = useCallback(async (options?: { force?: boolean; keepalive?: boolean }) => {
    if (savingRef.current || readOnly) return false;
    if (!options?.force && !dirtyRef.current) return true;
    savingRef.current = true;
    onSaveStateRef.current?.("saving");
    try {
      const snapshot: DeckCanvasSnapshot = {
        engine: "konva",
        version: 1,
        camera: cameraRef.current,
        cards: layoutRef.current.cards,
        frames: layoutRef.current.frames,
      };
      const response = await fetch(`/api/decks/${deckIdRef.current}/canvas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
        ...(options?.keepalive ? { keepalive: true } : {}),
      });
      if (!response.ok) throw new Error("save failed");
      const data = (await response.json()) as { updatedAt?: string };
      dirtyRef.current = false;
      onDirtyChangeRef.current?.(false);
      onSaveStateRef.current?.("saved", data.updatedAt ?? null);
      return true;
    } catch {
      onSaveStateRef.current?.("error");
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [deckIdRef, onDirtyChangeRef, onSaveStateRef, readOnly]);

  useEffect(() => {
    handleRef.current = {
      save: (options) => persist({ force: true, keepalive: options?.keepalive }),
      isDirty: () => dirtyRef.current,
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef, persist]);

  useEffect(() => {
    readyRef.current = true;
    dirtyRef.current = false;
    onDirtyChangeRef.current?.(false);
  }, [onDirtyChangeRef]);

  useEffect(() => {
    if (!readyRef.current) return;
    const result = syncLayout(layoutRef.current, cards, sections);
    if (!result.changed) return;
    setLayout(result.layout);
    const alive = new Set(Object.keys(result.layout.cards));
    if ([...selectedRef.current].some((key) => !alive.has(key))) {
      setSelected(new Set([...selectedRef.current].filter((key) => alive.has(key))));
    }
    markDirty();
  }, [cards, sections, setLayout, setSelected, markDirty]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const zoomToFit = useCallback(() => {
    const { width, height } = size;
    if (!width || !height) return;
    const current = layoutRef.current;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const frame of Object.values(current.frames)) {
      minX = Math.min(minX, frame.x);
      minY = Math.min(minY, frame.y - 24);
      maxX = Math.max(maxX, frame.x + frame.w);
      maxY = Math.max(maxY, frame.y + frame.h);
    }
    for (const pos of Object.values(current.cards)) {
      const abs = absolutePos(pos, current.frames);
      minX = Math.min(minX, abs.x);
      minY = Math.min(minY, abs.y);
      maxX = Math.max(maxX, abs.x + CARD_W);
      maxY = Math.max(maxY, abs.y + CARD_H);
    }
    if (!Number.isFinite(minX)) {
      setCamera({ x: 0, y: 0, scale: 1 });
      return;
    }
    const padding = 48;
    const scale = clampScale(
      Math.min(1, (width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxY - minY)),
    );
    setCamera({
      scale,
      x: (width - (maxX - minX) * scale) / 2 - minX * scale,
      y: (height - (maxY - minY) * scale) / 2 - minY * scale,
    });
  }, [size, setCamera]);

  useEffect(() => {
    if (!needsFitRef.current || !size.width || !size.height) return;
    needsFitRef.current = false;
    zoomToFit();
  }, [size, zoomToFit]);

  function zoomAround(factor: number, anchor: Point) {
    const current = cameraRef.current;
    const scale = clampScale(current.scale * factor);
    const pageX = (anchor.x - current.x) / current.scale;
    const pageY = (anchor.y - current.y) / current.scale;
    setCamera({ scale, x: anchor.x - pageX * scale, y: anchor.y - pageY * scale });
  }

  function toPage(point: Point): Point {
    const current = cameraRef.current;
    return { x: (point.x - current.x) / current.scale, y: (point.y - current.y) / current.scale };
  }

  function sendCardPatch(catalogCardId: string, sectionId: string | null) {
    void fetch(`/api/decks/${deckIdRef.current}/cards`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogCardId, setSectionId: sectionId }),
    }).then((response) => {
      if (response.ok) onDomainChangeRef.current?.();
    });
  }

  function deleteSelectedCards() {
    const keys = [...selectedRef.current].filter((key) => key in layoutRef.current.cards);
    if (!keys.length) return;
    const counts = new Map<string, number>();
    for (const key of keys) {
      const copy = copiesByKey.get(key);
      if (!copy) continue;
      counts.set(copy.id, (counts.get(copy.id) ?? 0) + 1);
    }
    const nextCards = { ...layoutRef.current.cards };
    for (const key of keys) delete nextCards[key];
    setLayout({ ...layoutRef.current, cards: nextCards });
    setSelected(new Set());
    markDirty();
    void Promise.all(
      [...counts].map(([catalogCardId, quantity]) =>
        fetch(`/api/decks/${deckIdRef.current}/cards`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ catalogCardId, quantity }),
        }),
      ),
    ).then(() => onDomainChangeRef.current?.());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (readOnly) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelectedCards();
    } else if (event.key === "Escape") {
      setSelected(new Set());
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      setSelected(new Set(Object.keys(layoutRef.current.cards)));
    }
  }

  function finishGesture(clientX: number, clientY: number) {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (!gesture) return;
    if (gesture.kind === "pan") {
      const stage = stageRef.current;
      if (stage) setCamera({ ...cameraRef.current, x: stage.x(), y: stage.y() });
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    setMarquee(null);
    if (!rect) return;
    const end = toPage({ x: clientX - rect.left, y: clientY - rect.top });
    const minX = Math.min(gesture.start.x, end.x);
    const minY = Math.min(gesture.start.y, end.y);
    const maxX = Math.max(gesture.start.x, end.x);
    const maxY = Math.max(gesture.start.y, end.y);
    const next = new Set(gesture.additive ? selectedRef.current : []);
    const current = layoutRef.current;
    for (const [key, pos] of Object.entries(current.cards)) {
      const abs = absolutePos(pos, current.frames);
      if (abs.x < maxX && abs.x + CARD_W > minX && abs.y < maxY && abs.y + CARD_H > minY) next.add(key);
    }
    setSelected(next);
  }

  function handleStageMouseDown(event: Konva.KonvaEventObject<MouseEvent>) {
    hideHoverPreview();
    containerRef.current?.focus();
    const stage = stageRef.current;
    if (!stage || event.evt.button !== 0) return;
    if (event.target !== stage) {
      if (event.target.name() === "frame-body" && !event.evt.shiftKey) setSelected(new Set());
      return;
    }
    if (event.evt.shiftKey && !readOnly) {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const start = toPage(pointer);
      gestureRef.current = { kind: "marquee", start, additive: true };
      setMarquee({ x: start.x, y: start.y, w: 0, h: 0 });
    } else {
      setSelected(new Set());
      gestureRef.current = {
        kind: "pan",
        startClient: { x: event.evt.clientX, y: event.evt.clientY },
        startCamera: cameraRef.current,
      };
    }

    function onMove(moveEvent: MouseEvent) {
      const gesture = gestureRef.current;
      const currentStage = stageRef.current;
      if (!gesture || !currentStage) return;
      if (gesture.kind === "pan") {
        const x = gesture.startCamera.x + moveEvent.clientX - gesture.startClient.x;
        const y = gesture.startCamera.y + moveEvent.clientY - gesture.startClient.y;
        currentStage.position({ x, y });
        cameraRef.current = { ...cameraRef.current, x, y };
        return;
      }
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const point = toPage({ x: moveEvent.clientX - rect.left, y: moveEvent.clientY - rect.top });
      setMarquee({
        x: Math.min(gesture.start.x, point.x),
        y: Math.min(gesture.start.y, point.y),
        w: Math.abs(point.x - gesture.start.x),
        h: Math.abs(point.y - gesture.start.y),
      });
    }
    function onUp(upEvent: MouseEvent) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      finishGesture(upEvent.clientX, upEvent.clientY);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleWheel(event: Konva.KonvaEventObject<WheelEvent>) {
    event.evt.preventDefault();
    hideHoverPreview();
    const stage = stageRef.current;
    if (!stage) return;
    if (event.evt.ctrlKey || event.evt.metaKey) {
      const pointer = stage.getPointerPosition() ?? { x: size.width / 2, y: size.height / 2 };
      zoomAround(Math.pow(1.0015, -event.evt.deltaY), pointer);
      return;
    }
    const current = cameraRef.current;
    const horizontal = event.evt.shiftKey && event.evt.deltaX === 0;
    const dx = horizontal ? event.evt.deltaY : event.evt.deltaX;
    const dy = horizontal ? 0 : event.evt.deltaY;
    setCamera({ ...current, x: current.x - dx, y: current.y - dy });
  }

  /** No mousedown só amplia a seleção, para arrastar várias cartas juntas; o clique reduz. */
  function handleCardMouseDown(key: string, additive: boolean) {
    if (readOnly) return;
    if (additive) {
      const next = new Set(selectedRef.current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setSelected(next);
    } else if (!selectedRef.current.has(key)) {
      setSelected(new Set([key]));
    }
  }

  function handleCardClick(key: string, additive: boolean) {
    if (!additive && selectedRef.current.size > 1) setSelected(new Set([key]));
  }

  function handleCardDragStart(key: string, event: Konva.KonvaEventObject<DragEvent>) {
    hideHoverPreview();
    closeContextMenu();
    let selection = selectedRef.current;
    if (!selection.has(key)) {
      selection = new Set([key]);
      setSelected(selection);
    }
    const node = event.target;
    node.moveToTop();
    const others = new Map<string, Point>();
    for (const otherKey of selection) {
      if (otherKey === key) continue;
      const otherNode = cardNodesRef.current.get(otherKey);
      if (!otherNode) continue;
      otherNode.moveToTop();
      others.set(otherKey, { x: otherNode.x(), y: otherNode.y() });
    }
    dragRef.current = { anchorKey: key, anchorStart: { x: node.x(), y: node.y() }, others };
  }

  function handleCardDragMove(event: Konva.KonvaEventObject<DragEvent>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.target.x() - drag.anchorStart.x;
    const dy = event.target.y() - drag.anchorStart.y;
    for (const [otherKey, start] of drag.others) {
      cardNodesRef.current.get(otherKey)?.position({ x: start.x + dx, y: start.y + dy });
    }
  }

  function handleCardDragEnd() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const current = layoutRef.current;
    const nextCards = { ...current.cards };
    const patches = new Map<string, string | null>();
    for (const key of [drag.anchorKey, ...drag.others.keys()]) {
      const node = cardNodesRef.current.get(key);
      const prev = current.cards[key];
      if (!node || !prev) continue;
      const abs = { x: node.x(), y: node.y() };
      const parent = frameAtCardCenter(abs, sections, current.frames);
      const frame = parent ? current.frames[parent] : undefined;
      nextCards[key] = frame
        ? { parent, x: abs.x - frame.x, y: abs.y - frame.y }
        : { parent: null, x: abs.x, y: abs.y };
      if (parent !== prev.parent) {
        const copy = copiesByKey.get(key);
        if (copy) patches.set(copy.id, parent);
      }
    }
    setLayout({ ...current, cards: nextCards });
    markDirty();
    for (const [catalogCardId, sectionId] of patches) sendCardPatch(catalogCardId, sectionId);
  }

  function updateFrame(sectionId: string, patch: Partial<FrameRect>) {
    const current = layoutRef.current;
    const frame = current.frames[sectionId];
    if (!frame) return;
    setLayout({ ...current, frames: { ...current.frames, [sectionId]: { ...frame, ...patch } } });
  }

  const cardEntries = useMemo(() => {
    const entries: Array<{ key: string; copy: CardCopy; abs: Point }> = [];
    for (const [key, pos] of Object.entries(layout.cards)) {
      const copy = copiesByKey.get(key);
      if (!copy) continue;
      entries.push({ key, copy, abs: absolutePos(pos, layout.frames) });
    }
    return entries;
  }, [layout, copiesByKey]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="relative h-full w-full overflow-hidden bg-neutral-100 outline-none"
      onKeyDown={handleKeyDown}
      onContextMenu={(event) => event.preventDefault()}
      data-testid="konva-canvas"
    >
      {size.width > 0 && size.height > 0 ? (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={camera.x}
          y={camera.y}
          scaleX={camera.scale}
          scaleY={camera.scale}
          onMouseDown={handleStageMouseDown}
          onWheel={handleWheel}
          onContextMenu={(event) => {
            event.evt.preventDefault();
            if (event.target === stageRef.current) closeContextMenu();
          }}
        >
          <Layer>
            {sections.map((section) => {
              const frame = layout.frames[section.id];
              if (!frame) return null;
              return (
                <Group
                  key={section.id}
                  x={frame.x}
                  y={frame.y}
                  draggable={!readOnly}
                  onDragStart={(event) => {
                    if (event.target !== event.currentTarget) return;
                    hideHoverPreview();
                  }}
                  onDragMove={(event) => {
                    if (event.target !== event.currentTarget) return;
                    updateFrame(section.id, { x: event.target.x(), y: event.target.y() });
                  }}
                  onDragEnd={(event) => {
                    if (event.target !== event.currentTarget) return;
                    updateFrame(section.id, { x: event.target.x(), y: event.target.y() });
                    markDirty();
                  }}
                >
                  <Text
                    text={section.name}
                    y={-22}
                    fontSize={14}
                    fontStyle="600"
                    fill="#404040"
                    fontFamily="Inter, system-ui, sans-serif"
                  />
                  <Rect
                    name="frame-body"
                    width={frame.w}
                    height={frame.h}
                    fill="#ffffff"
                    stroke="#a3a3a3"
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                  />
                  {readOnly ? null : (
                    <Rect
                      x={frame.w - RESIZE_HANDLE}
                      y={frame.h - RESIZE_HANDLE}
                      width={RESIZE_HANDLE}
                      height={RESIZE_HANDLE}
                      fill="#e5e5e5"
                      stroke="#737373"
                      strokeWidth={1}
                      strokeScaleEnabled={false}
                      draggable
                      onMouseEnter={() => {
                        if (containerRef.current) containerRef.current.style.cursor = "nwse-resize";
                      }}
                      onMouseLeave={() => {
                        if (containerRef.current) containerRef.current.style.cursor = "";
                      }}
                      onDragMove={(event) => {
                        event.cancelBubble = true;
                        const w = Math.max(FRAME_MIN_W, event.target.x() + RESIZE_HANDLE);
                        const h = Math.max(FRAME_MIN_H, event.target.y() + RESIZE_HANDLE);
                        event.target.position({ x: w - RESIZE_HANDLE, y: h - RESIZE_HANDLE });
                        updateFrame(section.id, { w, h });
                      }}
                      onDragEnd={(event) => {
                        event.cancelBubble = true;
                        markDirty();
                      }}
                      onDragStart={(event) => {
                        event.cancelBubble = true;
                      }}
                    />
                  )}
                </Group>
              );
            })}
          </Layer>
          <Layer>
            {cardEntries.map(({ key, copy, abs }) => {
              const image = imageFor(imageSrc(copy));
              const isSelected = selected.has(key);
              return (
                <Group
                  key={key}
                  ref={(node) => {
                    if (node) cardNodesRef.current.set(key, node);
                    else cardNodesRef.current.delete(key);
                  }}
                  x={abs.x}
                  y={abs.y}
                  draggable={!readOnly}
                  onMouseDown={(event) => {
                    if (event.evt.button !== 0) return;
                    handleCardMouseDown(key, event.evt.shiftKey);
                  }}
                  onClick={(event) => {
                    if (event.evt.button !== 0) return;
                    handleCardClick(key, event.evt.shiftKey);
                  }}
                  onDragStart={(event) => handleCardDragStart(key, event)}
                  onDragMove={handleCardDragMove}
                  onDragEnd={handleCardDragEnd}
                  onDblClick={() => {
                    if (!readOnly) editCardMeta(copy.id);
                  }}
                  onContextMenu={(event) => {
                    event.evt.preventDefault();
                    event.cancelBubble = true;
                    openContextMenu(copy.id, event.evt.clientX, event.evt.clientY);
                  }}
                  onMouseMove={(event) => {
                    if (event.evt.buttons !== 0 || dragRef.current) {
                      hideHoverPreview();
                      return;
                    }
                    hoverCard(key, copy.id, event.evt.clientX, event.evt.clientY);
                  }}
                  onMouseLeave={() => hideHoverPreview()}
                >
                  {image ? (
                    <KonvaImage
                      image={image}
                      width={CARD_W}
                      height={CARD_H}
                      opacity={cardOpacity(copy.included)}
                      cornerRadius={6}
                      perfectDrawEnabled={false}
                    />
                  ) : (
                    <>
                      <Rect
                        width={CARD_W}
                        height={CARD_H}
                        fill="#fafafa"
                        stroke="#d4d4d4"
                        cornerRadius={6}
                        opacity={cardOpacity(copy.included)}
                      />
                      <Text
                        text={copy.name_pt ?? copy.name_en}
                        width={CARD_W}
                        padding={8}
                        fontSize={12}
                        fill="#525252"
                        fontFamily="Inter, system-ui, sans-serif"
                      />
                    </>
                  )}
                  {!copy.included ? (
                    <Circle x={13} y={13} radius={8} fill="#f97316" stroke="#09090b" strokeWidth={1} />
                  ) : null}
                  {isSelected ? (
                    <Rect
                      x={-3}
                      y={-3}
                      width={CARD_W + 6}
                      height={CARD_H + 6}
                      stroke={SELECTION_COLOR}
                      strokeWidth={2}
                      strokeScaleEnabled={false}
                      cornerRadius={8}
                      listening={false}
                    />
                  ) : null}
                </Group>
              );
            })}
            {marquee ? (
              <Rect
                x={marquee.x}
                y={marquee.y}
                width={marquee.w}
                height={marquee.h}
                fill="rgba(37, 99, 235, 0.08)"
                stroke={SELECTION_COLOR}
                strokeWidth={1}
                strokeScaleEnabled={false}
                listening={false}
              />
            ) : null}
          </Layer>
        </Stage>
      ) : null}
      <div className="absolute bottom-4 left-16 z-10 flex items-center border border-ink bg-surface-container-lowest text-[13px] shadow-[4px_4px_0_#09090b]">
        <button
          type="button"
          className="h-8 w-8 hover:bg-neutral-100"
          aria-label="Diminuir zoom"
          onClick={() => zoomAround(1 / 1.2, { x: size.width / 2, y: size.height / 2 })}
        >
          −
        </button>
        <button
          type="button"
          className="h-8 min-w-14 border-x border-ink px-2 font-mono text-[11px] hover:bg-neutral-100"
          aria-label="Zoom 100%"
          onClick={() => zoomAround(1 / cameraRef.current.scale, { x: size.width / 2, y: size.height / 2 })}
        >
          {Math.round(camera.scale * 100)}%
        </button>
        <button
          type="button"
          className="h-8 w-8 hover:bg-neutral-100"
          aria-label="Aumentar zoom"
          onClick={() => zoomAround(1.2, { x: size.width / 2, y: size.height / 2 })}
        >
          +
        </button>
        <button type="button" className="h-8 border-l border-ink px-3 hover:bg-neutral-100" onClick={zoomToFit}>
          Ajustar
        </button>
      </div>
      <p className="pointer-events-none absolute bottom-4 left-[20rem] z-10 hidden font-mono text-[10px] tracking-wide text-muted uppercase md:block">
        {readOnly
          ? "Somente leitura · Arrastar fundo: mover · Ctrl+roda: zoom"
          : "Arrastar fundo: mover · Shift+arrastar: selecionar · Ctrl+roda: zoom · Del: remover"}
      </p>
      {overlays}
    </div>
  );
}
