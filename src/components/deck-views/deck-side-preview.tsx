/** Preview fixo da view Texto na edição (F-017 / US-017-01). */
export function DeckSidePreview({ card }: { card: { label: string; imageSrc: string | null } | null }) {
  return (
    <aside data-testid="deck-side-preview" className="sticky top-16 w-full shrink-0 self-start sm:w-56">
      {card?.imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.imageSrc}
          alt={card.label}
          className="aspect-[63/88] w-full border border-ink bg-surface-container object-cover"
        />
      ) : (
        <div className="flex aspect-[63/88] items-center justify-center border border-dashed border-outline-variant px-3 text-center text-[12px] text-muted">
          {card ? card.label : "Passe o cursor sobre uma carta"}
        </div>
      )}
      {card ? <p className="mt-2 truncate text-[13px] font-semibold text-ink">{card.label}</p> : null}
    </aside>
  );
}
