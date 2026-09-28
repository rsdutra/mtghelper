"use client";

import { useState } from "react";
import { FORMATS } from "@/lib/formats";

type Props = {
  deckId: string;
  name: string;
  format: string;
  onNameChange: (name: string) => void;
  onFormatChange: (format: string) => void;
};

/** Nome e formato editáveis + Salvar, só no modo edição (F-011 / US-011-04). */
export function DeckEditHeader({ deckId, name, format, onNameChange, onFormatChange }: Props) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setSaveState("saving");
    const response = await fetch(`/api/decks/${deckId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, format }),
    });
    setSaveState(response.ok ? "saved" : "error");
  }

  return (
    <>
      {/* `.ui-input` fixa width: 100% fora das layers do Tailwind; a largura vem do wrapper. */}
      <div className="w-52 sm:w-64">
        <input
          aria-label="Nome do deck"
          value={name}
          onChange={(event) => {
            onNameChange(event.target.value);
            setSaveState("idle");
          }}
          className="ui-input h-9 border-outline-variant text-[15px] font-semibold tracking-tight"
        />
      </div>
      <div className="w-36">
        <select
          aria-label="Formato"
          value={format}
          onChange={(event) => {
            onFormatChange(event.target.value);
            setSaveState("idle");
          }}
          className="ui-input h-9 border-outline-variant"
        >
          {FORMATS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <button type="button" onClick={() => void save()} className="ui-btn-outline h-9 px-4" disabled={saveState === "saving"}>
        Salvar
      </button>
      {saveState === "saved" || saveState === "error" ? (
        <span className="hidden font-mono text-[10px] tracking-[0.04em] text-on-surface-variant sm:inline">
          {saveState === "saved" ? "Salvo" : "Erro ao salvar"}
        </span>
      ) : null}
    </>
  );
}
