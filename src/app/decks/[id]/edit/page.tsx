import { DeckDetail } from "@/components/deck-detail/deck-detail";

/** F-011 / US-011-04 — edição do deck. */
export default async function DeckEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const { view } = await searchParams;
  return <DeckDetail deckId={id} mode="edit" initialView={view === "canvas" ? "canvas" : "lista"} />;
}
