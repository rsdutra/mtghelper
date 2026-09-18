/** Converte mana_cost Scryfall (ex. `{2}{W}{U}`) em mana value (CMC). */

export function manaValueFromCost(manaCost: string | null | undefined): number {
  if (!manaCost) return 0;
  const tokens = manaCost.match(/\{[^}]+\}/g);
  if (!tokens) return 0;

  let total = 0;
  for (const raw of tokens) {
    const token = raw.slice(1, -1).toUpperCase();
    if (token === "X" || token === "Y" || token === "Z") continue;
    if (token === "½" || token === "1/2") {
      total += 0.5;
      continue;
    }
    if (/^\d+$/.test(token)) {
      total += Number(token);
      continue;
    }
    // Pips coloridos, híbridos, phyrexianos, neve, etc. contam 1.
    total += 1;
  }
  return Math.floor(total);
}
