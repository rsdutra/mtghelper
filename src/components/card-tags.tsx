"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/modal";
import { isTagName, sameTag, tagTint, type CardTag } from "@/lib/tags";

/** F-013: cada cor ocupa uma faixa igual do selo de quantidade. */
export function TagQuantityFill({ tags }: { tags: CardTag[] }) {
  if (!tags.length) return null;
  return (
    <span className="absolute inset-0 flex">
      {tags.map((tag) => (
        <span
          key={tag.name.toLowerCase()}
          title={tag.name}
          className="h-full min-w-0 flex-1"
          style={{ backgroundColor: tagTint(tag.color) }}
        />
      ))}
    </span>
  );
}

export function TagDots({ tags }: { tags: CardTag[] }) {
  if (!tags.length) return null;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={tags.map((tag) => tag.name).join(", ")}>
      {tags.map((tag) => (
        <TagDot key={tag.name.toLowerCase()} tag={tag} />
      ))}
    </span>
  );
}

export function TagChoices({
  tags,
  known,
  onToggle,
  onNew,
}: {
  tags: CardTag[];
  known: CardTag[];
  onToggle: (tag: CardTag) => void;
  onNew: () => void;
}) {
  return (
    <>
      <p className="px-2 pt-2 font-mono text-[10px] tracking-wide text-muted uppercase">Tags</p>
      {known.length === 0 ? <p className="px-2 py-1 text-[12px] text-muted">Nenhuma tag ainda.</p> : null}
      {known.map((tag) => {
        const active = tags.some((item) => sameTag(item.name, tag.name));
        return (
          <button
            key={tag.name.toLowerCase()}
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-2 py-1 text-left text-[13px] hover:bg-surface-container"
            onClick={() => onToggle(tag)}
          >
            <TagDot tag={tag} />
            <span className="min-w-0 flex-1 truncate">{tag.name}</span>
            {active ? <span aria-hidden>✓</span> : null}
          </button>
        );
      })}
      <button type="button" role="menuitem" className="w-full px-2 py-1 text-left text-[13px] hover:bg-surface-container" onClick={onNew}>
        Nova tag…
      </button>
    </>
  );
}

/** Botão de três pontos com as tags da carta. F-013. */
export function CardTagButton({
  label,
  tags,
  known,
  onToggle,
  onNew,
}: {
  label: string;
  tags: CardTag[];
  known: CardTag[];
  onToggle: (tag: CardTag) => void;
  onNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={`Tags de ${label}`}
        aria-expanded={open}
        title="Tags"
        className="flex h-6 w-6 items-center justify-center text-[16px] leading-none tracking-tight text-muted hover:text-ink"
        onClick={() => setOpen((value) => !value)}
      >
        ···
      </button>
      {open ? (
        <div className="absolute right-0 z-30 w-48 border border-ink bg-white py-1 shadow-[2px_2px_0_#09090b]">
          <TagChoices
            tags={tags}
            known={known}
            onToggle={onToggle}
            onNew={() => {
              setOpen(false);
              onNew();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function TagCreateModal({
  open,
  known,
  onClose,
  onCreate,
}: {
  open: boolean;
  known: CardTag[];
  onClose: () => void;
  onCreate: (tag: CardTag) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#2563eb");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setColor("#2563eb");
    setError("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const existing = known.find((tag) => sameTag(tag.name, name));

  function save() {
    const trimmed = name.trim();
    if (!isTagName(trimmed)) {
      setError("Use um nome de até 32 caracteres, sem vírgula.");
      return;
    }
    onCreate(existing ?? { name: trimmed, color });
    onClose();
  }

  return (
    <Modal role="dialog" aria-modal="true" aria-labelledby="tag-modal-title">
      <div className="w-full max-w-sm border border-black bg-white p-4 shadow-xl">
        <h2 id="tag-modal-title" className="text-base font-semibold">
          Nova tag
        </h2>
        <p className="mt-1 text-xs text-neutral-500">O nome identifica a tag. A cor marca a carta.</p>
        <label className="mt-4 mb-1 block text-xs font-medium uppercase" htmlFor="tag-name">
          Nome
        </label>
        <input
          id="tag-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="ui-input h-10 border-ink"
          maxLength={32}
          autoFocus
        />
        <label className="mt-4 mb-1 block text-xs font-medium uppercase" htmlFor="tag-color">
          Cor
        </label>
        <input id="tag-color" type="color" value={existing?.color ?? color} onChange={(event) => setColor(event.target.value)} disabled={Boolean(existing)} className="h-10 w-16 border border-ink bg-white p-1" />
        {existing ? <p className="mt-2 text-xs text-neutral-500">Essa tag já existe e vai usar a cor atual.</p> : null}
        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="h-10 border border-black px-4 text-sm" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="h-10 bg-black px-4 text-sm text-white" onClick={save}>
            Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TagDot({ tag }: { tag: CardTag }) {
  return (
    <span
      title={tag.name}
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-ink"
      style={{ backgroundColor: tag.color }}
    />
  );
}
