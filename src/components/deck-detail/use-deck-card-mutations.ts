import type { Dispatch, SetStateAction } from "react";
import type { CardMetaValues } from "@/components/card-meta-modal";
import type { CardRow, Section } from "@/components/deck-detail/deck-detail-types";

type Options = {
  deckId: string;
  sections: Section[];
  setCards: Dispatch<SetStateAction<CardRow[]>>;
  setStatus: (status: string) => void;
  load: () => Promise<void>;
  ensureAutoSections: () => Promise<void>;
};

/** Escritas nas cartas do deck, exclusivas do modo edição (F-011 / US-011-04). */
export function useDeckCardMutations({ deckId, sections, setCards, setStatus, load, ensureAutoSections }: Options) {
  const cardsUrl = `/api/decks/${deckId}/cards`;

  async function addText(text: string, sectionId?: string, set?: string, included?: boolean) {
    setStatus("Buscando cartas…");
    const response = await fetch(cardsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, sectionId, set, included }),
    });
    const data = await response.json();
    setStatus(
      data.missing?.length
        ? `Não encontradas: ${data.missing.map((item: { name: string }) => item.name).join(", ")}`
        : "Cartas adicionadas.",
    );
    await load();
    await ensureAutoSections();
  }

  async function removeCard(catalogCardId: string, all = false) {
    const response = await fetch(cardsUrl, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogCardId, quantity: 1, all }),
    });
    if (!response.ok) {
      setStatus("Não foi possível remover a carta.");
      return;
    }
    setStatus(all ? "Carta removida." : "Quantidade atualizada.");
    await load();
    await ensureAutoSections();
  }

  async function addOneCopy(card: CardRow) {
    await addText(`1 ${card.name_pt ?? card.name_en}`, undefined, undefined, card.included);
  }

  async function setSideboard(catalogCardId: string, sideboard: boolean) {
    const response = await fetch(cardsUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogCardId, sideboard }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(typeof data.error === "string" ? data.error : "Não foi possível atualizar o sideboard.");
    }
    await load();
    await ensureAutoSections();
  }

  async function setIncluded(catalogCardId: string, included: boolean) {
    await fetch(cardsUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogCardId, included }),
    });
    await load();
    await ensureAutoSections();
  }

  async function setCardUserSections(catalogCardId: string, sectionIds: string[]) {
    // Otimista: mantém carta em No deck / Fora do deck; só atualiza tags user.
    setCards((prev) =>
      prev.map((card) => {
        if (card.id !== catalogCardId) return card;
        const autoIds = card.section_ids.filter((id) => {
          const section = sections.find((item) => item.id === id);
          return section?.kind === "type" || section?.kind === "cost" || section?.kind === "sideboard";
        });
        return { ...card, section_ids: [...autoIds, ...sectionIds] };
      }),
    );
    const response = await fetch(cardsUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogCardId, sectionIds }),
    });
    if (!response.ok) {
      setStatus("Não foi possível atualizar as sessões da carta.");
      await load();
    }
  }

  async function saveCardMeta(catalogCardId: string, values: CardMetaValues) {
    const response = await fetch(cardsUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogCardId, priceCents: values.priceCents, note: values.note }),
    });
    if (!response.ok) throw new Error("save meta failed");
    await load();
  }

  return { addText, removeCard, addOneCopy, setIncluded, setSideboard, setCardUserSections, saveCardMeta };
}
