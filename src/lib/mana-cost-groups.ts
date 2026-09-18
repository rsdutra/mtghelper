import { manaValueFromCost } from "@/lib/mana";

/** Buckets de CMC para agrupar por custo (F-004 / F-008). 7 = 7+. */
export type ManaCostBucket = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const MANA_COST_ORDER: ManaCostBucket[] = [0, 1, 2, 3, 4, 5, 6, 7];

export function manaCostBucket(manaCost: string | null | undefined): ManaCostBucket {
  const value = manaValueFromCost(manaCost);
  return Math.min(7, Math.max(0, value)) as ManaCostBucket;
}

export function manaCostKey(bucket: ManaCostBucket): string {
  return `cmc-${bucket}`;
}

export function manaCostLabel(bucket: ManaCostBucket): string {
  return bucket === 7 ? "CMC 7+" : `CMC ${bucket}`;
}

export function groupCardsByManaCost<T extends { mana_cost?: string | null; quantity?: number }>(
  cards: T[],
): Array<{ bucket: ManaCostBucket; key: string; label: string; cards: T[] }> {
  const buckets = new Map<ManaCostBucket, T[]>();
  for (const card of cards) {
    const bucket = manaCostBucket(card.mana_cost);
    const list = buckets.get(bucket) ?? [];
    list.push(card);
    buckets.set(bucket, list);
  }
  return MANA_COST_ORDER.filter((bucket) => buckets.has(bucket)).map((bucket) => ({
    bucket,
    key: manaCostKey(bucket),
    label: manaCostLabel(bucket),
    cards: buckets.get(bucket) ?? [],
  }));
}
