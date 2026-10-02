"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { isTagName, sameTag, type CardTag } from "@/lib/tags";

/**
 * Painel do filtro do deck por tag — F-013 / US-013-03. Uma tag por vez.
 * Na edição, cada linha ganha editar/excluir (US-013-04).
 */
export function DeckTagFilterPanel({
  tags,
  active,
  onSelect,
  onClear,
  onEdit,
  onDelete,
}: {
  tags: CardTag[];
  active: string | null;
  onSelect: (tag: string | null) => void;
  onClear: () => void;
  onEdit?: (tag: CardTag) => void;
  onDelete?: (tag: CardTag) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="ui-label text-ink">Filtrar por tag</h2>
      {tags.length === 0 ? (
        <p className="text-[13px] text-muted">Nenhuma tag neste deck.</p>
      ) : (
        <ul className="space-y-1" aria-label="Tags do deck">
          {tags.map((tag) => {
            const pressed = active != null && sameTag(active, tag.name);
            return (
              <li key={tag.name} className="flex items-center gap-1">
                {onEdit ? (
                  <RowIconButton label={`Editar tag ${tag.name}`} onClick={() => onEdit(tag)}>
                    <PencilIcon />
                  </RowIconButton>
                ) : null}
                {onDelete ? (
                  <RowIconButton label={`Excluir tag ${tag.name}`} onClick={() => onDelete(tag)}>
                    <TrashIcon />
                  </RowIconButton>
                ) : null}
                <button
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => onSelect(pressed ? null : tag.name)}
                  className={`flex min-w-0 flex-1 items-center gap-2 border px-2 py-1.5 text-left text-[13px] ${
                    pressed ? "border-ink bg-ink font-semibold text-white" : "border-transparent text-ink hover:bg-surface-container"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-3 w-3 shrink-0 rounded-full border border-ink"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="truncate">{tag.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className="ui-btn-outline h-8 w-full disabled:opacity-50" disabled={!active} onClick={onClear}>
        Limpar filtro
      </button>
    </div>
  );
}

/** Monte com `key` da tag: o estado inicial vem da tag aberta. */
export function TagEditModal({
  tag,
  onClose,
  onSave,
}: {
  tag: CardTag;
  onClose: () => void;
  onSave: (next: CardTag) => Promise<string | null>;
}) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEscape(onClose);

  async function save() {
    const trimmed = name.trim();
    if (!isTagName(trimmed)) {
      setError("Use um nome de até 32 caracteres, sem vírgula.");
      return;
    }
    setSaving(true);
    const message = await onSave({ name: trimmed, color });
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    onClose();
  }

  return (
    <ModalFrame titleId="tag-edit-title" title="Editar tag">
      <label className="mt-4 mb-1 block text-xs font-medium uppercase" htmlFor="tag-edit-name">
        Nome
      </label>
      <input
        id="tag-edit-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void save();
        }}
        className="ui-input h-10 border-ink"
        maxLength={32}
        autoFocus
      />
      <label className="mt-4 mb-1 block text-xs font-medium uppercase" htmlFor="tag-edit-color">
        Cor
      </label>
      <input
        id="tag-edit-color"
        type="color"
        value={color}
        onChange={(event) => setColor(event.target.value)}
        className="h-10 w-16 border border-ink bg-white p-1"
      />
      {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="h-10 border border-black px-4 text-sm" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="h-10 bg-black px-4 text-sm text-white disabled:opacity-50"
          disabled={saving}
          onClick={() => void save()}
        >
          Salvar
        </button>
      </div>
    </ModalFrame>
  );
}

export function TagDeleteModal({
  tag,
  onClose,
  onConfirm,
}: {
  tag: CardTag;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  useEscape(onClose);

  async function confirm() {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
    onClose();
  }

  return (
    <ModalFrame titleId="tag-delete-title" title="Excluir tag">
      <p className="mt-3 text-sm">
        Excluir a tag <strong>{tag.name}</strong>? Ela sai de todas as cartas do deck. As cartas continuam no deck.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="h-10 border border-black px-4 text-sm" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="h-10 bg-danger px-4 text-sm text-white disabled:opacity-50"
          disabled={deleting}
          onClick={() => void confirm()}
        >
          Excluir
        </button>
      </div>
    </ModalFrame>
  );
}

function ModalFrame({ titleId, title, children }: { titleId: string; title: string; children: React.ReactNode }) {
  return (
    <Modal role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="w-full max-w-sm border border-black bg-white p-4 shadow-xl">
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        {children}
      </div>
    </Modal>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

function RowIconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-7 w-7 shrink-0 items-center justify-center text-muted hover:bg-surface-container hover:text-ink"
    >
      {children}
    </button>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="miter" />
      <path d="M13 7l4 4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="miter" />
    </svg>
  );
}
