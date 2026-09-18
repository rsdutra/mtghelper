"use client";

import { useState } from "react";
import { LoadingModal } from "@/components/loading-modal";

type Resolved = {
  quantity: number;
  card: {
    id: string;
    name_en: string;
    name_pt: string | null;
    set_code: string;
    image_small: string | null;
  };
};

export function ListImport({
  onResolved,
}: {
  onResolved: (text: string) => Promise<{ missing?: { name: string }[] } | void>;
}) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function runImport(contents: string, doneLabel: string) {
    if (!contents.trim() || busy) return;
    setBusy(true);
    setStatus("Buscando…");
    try {
      const result = await onResolved(contents);
      const missing = result?.missing?.length ?? 0;
      setStatus(missing ? `${missing} carta(s) não encontrada(s).` : doneLabel);
    } catch {
      setStatus("Não foi possível processar a lista.");
    } finally {
      setBusy(false);
    }
  }

  async function submitText() {
    await runImport(text, "Lista processada.");
  }

  async function onFile(file: File | null) {
    if (!file) return;
    const contents = await file.text();
    setText(contents);
    await runImport(contents, "Arquivo processado.");
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={"1 Lightning Bolt\n4 Violência Gratuita"}
        className="ui-textarea h-36 disabled:opacity-60"
        disabled={busy}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void submitText()} className="ui-btn h-9 disabled:opacity-60" disabled={busy}>
          Importar lista
        </button>
        <label
          className={`ui-btn-outline h-9 cursor-pointer px-4 leading-9 ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          Arquivo txt/csv
          <input
            type="file"
            accept=".txt,.csv,text/plain"
            className="hidden"
            disabled={busy}
            onChange={(event) => void onFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <span className="text-[13px] text-muted">{status}</span>
      </div>
      <LoadingModal open={busy} />
    </div>
  );
}

export type { Resolved };
