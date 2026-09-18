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

export function isFormat(value: string): value is FormatId {
  return FORMATS.some((format) => format.id === value);
}
