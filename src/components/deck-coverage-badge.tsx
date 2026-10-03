"use client";

import type { DeckCoverageSummary } from "@/lib/deck-coverage";

type Props = {
  coverage: DeckCoverageSummary | null;
  /** Abre a lista das cartas que faltam (US-004-19). */
  onOpenMissing?: () => void;
};

export function DeckCoverageBadge({ coverage, onOpenMissing }: Props) {
  if (!coverage || coverage.includedCount === 0) return null;

  const title = "Todas as coleções, qualquer impressão. Só cartas No deck.";

  if (coverage.complete) {
    return (
      <span className="ui-badge" title={title}>
        Coleção: completo
      </span>
    );
  }

  const copies = coverage.missingCopies === 1 ? "1 cópia" : `${coverage.missingCopies} cópias`;
  const cards = coverage.missingCards === 1 ? "1 carta" : `${coverage.missingCards} cartas`;

  if (!onOpenMissing) {
    return (
      <span className="ui-badge border-danger text-danger" title={title}>
        Faltam {copies} · {cards}
      </span>
    );
  }

  return (
    <button
      type="button"
      className="ui-badge cursor-pointer border-danger text-danger hover:bg-danger hover:text-white"
      title={`${title} Clique para ver as cartas e adicionar à coleção.`}
      onClick={onOpenMissing}
    >
      Faltam {copies} · {cards}
    </button>
  );
}
