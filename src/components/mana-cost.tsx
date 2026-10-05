/** Símbolos do custo de mana (F-017 / US-017-03). `{W/U}` vira o svg `WU` da Scryfall. */
export function ManaCost({ cost }: { cost: string }) {
  const tokens = cost.match(/\{[^}]+\}/g);
  if (!tokens?.length) return null;

  return (
    <span className="inline-flex shrink-0 items-center gap-0.5" aria-label={`Custo de mana ${cost}`} data-testid="mana-cost">
      {tokens.map((token, index) => {
        const slug = symbolSlug(token);
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${token}-${index}`}
            src={`https://svgs.scryfall.io/card-symbols/${slug}.svg`}
            alt=""
            className="h-4 w-4"
          />
        );
      })}
    </span>
  );
}

/** A Scryfall publica o arquivo em maiúsculas (`R.svg`, `2W.svg`). Minúscula devolve 404 e some a cor. */
function symbolSlug(token: string) {
  const inner = token.slice(1, -1);
  if (inner === "½" || inner === "1/2") return "HALF";
  return inner.replace(/\//g, "").toUpperCase();
}
