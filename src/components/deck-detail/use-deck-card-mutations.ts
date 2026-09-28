import type { CardMetaValues } from "@/components/card-meta-modal";
import type { CardRow, DeckPlace } from "@/components/deck-detail/deck-detail-types";

type Options = {
  deckId: string;
  setStatus: (status: string) => void;
  load: () => Promise<void>;
};

/** Escritas nas cartas do deck, exclusivas do modo edição (F-011 / US-011-04). */
export function useDeckCardMutations({ deckId, setStatus, load }: Options) {
  const cardsUrl = `/api/decks/${deckId}/cards`;

  async function addText(text: string, set?: string, place: DeckPlace = "main") {
    setStatus("Buscando cartas…");
    const response = await fetch(cardsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, set, place }),
    });
    const data = await response.json();
    setStatus(
      data.missing?.length
        ? `Não encontradas: ${data.missing.map((item: { name: string }) => item.name).join(", ")}`
        : "Cartas adicionadas.",
    );
    await load();
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
  }

  async function addOneCopy(card: CardRow) {
    const place: DeckPlace = !card.included ? "out" : card.in_sideboard ? "side" : "main";
    await addText(`1 ${card.name_pt ?? card.name_en}`, undefined, place);
  }

  async function moveCard(catalogCardId: string, place: DeckPlace) {
    const response = await fetch(cardsUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogCardId, place }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(typeof data.error === "string" ? data.error : "Não foi possível mover a carta.");
      return;
    }
    await load();
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

  return { addText, removeCard, addOneCopy, moveCard, saveCardMeta };
}
