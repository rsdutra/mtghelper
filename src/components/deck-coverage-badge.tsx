"use client";

import type { DeckCoverageSummary } from "@/lib/deck-coverage";

type Props = {
  coverage: DeckCoverageSummary | null;
};

export function DeckCoverageBadge({ coverage }: Props) {
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

  return (
    <span className="ui-badge border-danger text-danger" title={title}>
      Faltam {copies} · {cards}
    </span>
  );
}
