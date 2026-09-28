export const FORMATS = [
  { id: "commander", label: "Commander" },
  { id: "standard", label: "Standard" },
  { id: "modern", label: "Modern" },
  { id: "pioneer", label: "Pioneer" },
  { id: "legacy", label: "Legacy" },
  { id: "vintage", label: "Vintage" },
  { id: "pauper", label: "Pauper" },
  { id: "paupercommander", label: "Pauper Commander" },
  { id: "brawl", label: "Brawl" },
  { id: "timeless", label: "Timeless" },
] as const;

export type FormatId = (typeof FORMATS)[number]["id"];

/** Commander, Brawl e Pauper Commander: 100 cartas, sem sideboard. */
const NO_SIDEBOARD = new Set<FormatId>(["commander", "brawl", "paupercommander"]);

export function isFormat(value: string): value is FormatId {
  return FORMATS.some((format) => format.id === value);
}

export function mainDeckLimit(format: string): number {
  return isFormat(format) && NO_SIDEBOARD.has(format) ? 100 : 60;
}

/** `null` quando o formato não tem sideboard. */
export function sideboardLimit(format: string): number | null {
  return isFormat(format) && NO_SIDEBOARD.has(format) ? null : 15;
}
