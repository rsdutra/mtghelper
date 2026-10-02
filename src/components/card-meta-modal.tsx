"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { MoneyInputBr } from "@/components/money-input-br";
import { NoteEditor } from "@/components/note-editor";
import { formatBRLFromCents } from "@/lib/money-br";

export type CardMetaValues = {
  priceCents: number | null;
  note: string;
};

type Props = {
  open: boolean;
  title: string;
  initial: CardMetaValues;
  onClose: () => void;
  onSave: (values: CardMetaValues) => Promise<void> | void;
};

/** Modal de preço (R$) e nota (TipTap) — F-004 / F-005 / F-008. */
export function CardMetaModal({ open, title, initial, onClose, onSave }: Props) {
  const [priceCents, setPriceCents] = useState<number | null>(initial.priceCents);
  const [note, setNote] = useState(initial.note);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setPriceCents(initial.priceCents);
    setNote(initial.note);
    setError("");
  }, [open, initial.priceCents, initial.note]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function save() {
    setSaving(true);
    setError("");
    try {
      await onSave({ priceCents, note });
      onClose();
    } catch {
      setError("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto border border-black bg-white p-4 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-xs text-neutral-500">
              Preço e nota personalizados
              {priceCents != null ? ` · ${formatBRLFromCents(priceCents)}` : ""}
            </p>
          </div>
          <button type="button" className="border border-black px-2 py-1 text-xs" onClick={onClose}>
            Fechar
          </button>
        </div>

        <label className="mb-1 block text-xs font-medium uppercase">Preço (R$)</label>
        <MoneyInputBr valueCents={priceCents} onChangeCents={setPriceCents} />

        <label className="mt-4 mb-1 block text-xs font-medium uppercase">Nota</label>
        {open ? (
          <NoteEditor
            key={`${title}::${initial.note ?? ""}::${String(initial.priceCents)}`}
            value={initial.note || "<p></p>"}
            onChange={setNote}
          />
        ) : null}

        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="h-10 border border-black px-4 text-sm" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className="h-10 bg-black px-4 text-sm text-white disabled:opacity-60"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
