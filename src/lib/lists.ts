export type ParsedListLine = {
  quantity: number;
  name: string;
  line: number;
};

export function unresolvedCardsMessage(missing: Array<{ name: string }>, added = 0) {
  const names = missing.map((item) => item.name).join(", ");
  if (!names) return "Cartas adicionadas.";
  const lead = added > 0 ? "Parte da lista entrou. " : "";
  return `${lead}Ajuste o nome destas: ${names}`;
}

export function parseCardList(text: string): ParsedListLine[] {
  const lines = text.split(/\r?\n/);
  const parsed: ParsedListLine[] = [];

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) return;

    const csv = line.split(/[;,]/).map((part) => part.trim()).filter(Boolean);
    const candidate = csv.length >= 2 && /^\d+$/.test(csv[0]) ? `${csv[0]} ${csv.slice(1).join(" ")}` : line;
    const match = candidate.match(/^(\d+)\s*[xX]?\s+(.+)$/);
    if (!match) {
      parsed.push({ quantity: 1, name: candidate, line: index + 1 });
      return;
    }

    parsed.push({
      quantity: Number(match[1]),
      name: match[2].trim(),
      line: index + 1,
    });
  });

  return parsed.filter((item) => item.name && item.quantity > 0);
}
