export type CoverageRow = {
  card_key: string;
  needed: number;
  owned: number;
};

export type CardCoverage = {
  owned: number;
  needed: number;
  missing: number;
};

export type DeckCoverageSummary = {
  complete: boolean;
  missingCopies: number;
  missingCards: number;
  includedCount: number;
};

export function coverageKey(oracleId: string | null | undefined, catalogId: string): string {
  return oracleId || catalogId;
}

export function asInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function cardCoverageFromRow(row: CoverageRow): CardCoverage {
  const needed = asInt(row.needed);
  const owned = asInt(row.owned);
  return { owned, needed, missing: Math.max(0, needed - owned) };
}

export function coverageByKey(rows: readonly CoverageRow[]): Map<string, CardCoverage> {
  const map = new Map<string, CardCoverage>();
  for (const row of rows) {
    map.set(row.card_key, cardCoverageFromRow(row));
  }
  return map;
}

export type MissingCardSource = {
  id: string;
  oracle_id?: string | null;
  place: "main" | "side" | "out";
  name_en: string;
  name_pt: string | null;
  missing?: number;
};

export type MissingCard = { key: string; name: string; missing: number };

/** Uma linha por carta que falta (deck + sideboard já somados na API), ordenada pelo nome (US-004-19). */
export function missingCardList(cards: readonly MissingCardSource[]): MissingCard[] {
  const byKey = new Map<string, MissingCard>();
  for (const card of cards) {
    if (card.place === "out" || !card.missing || card.missing <= 0) continue;
    const key = coverageKey(card.oracle_id, card.id);
    if (!byKey.has(key)) byKey.set(key, { key, name: card.name_pt ?? card.name_en, missing: card.missing });
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function summarizeCoverage(rows: readonly CoverageRow[]): DeckCoverageSummary {
  let missingCopies = 0;
  let missingCards = 0;
  let includedCount = 0;
  for (const row of rows) {
    const { needed, missing } = cardCoverageFromRow(row);
    includedCount += needed;
    if (missing > 0) {
      missingCopies += missing;
      missingCards += 1;
    }
  }
  return {
    complete: missingCopies === 0,
    missingCopies,
    missingCards,
    includedCount,
  };
}
