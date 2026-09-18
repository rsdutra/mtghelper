"use client";

import { FORMATS } from "@/lib/formats";

export type CollectionQuickFilters = {
  colors: string[];
  type: string;
  cmc: string;
  rarity: string;
  format: string;
  set: string;
};

export const EMPTY_QUICK_FILTERS: CollectionQuickFilters = {
  colors: [],
  type: "",
  cmc: "",
  rarity: "",
  format: "",
  set: "",
};

const COLORS = [
  { id: "W", label: "W" },
  { id: "U", label: "U" },
  { id: "B", label: "B" },
  { id: "R", label: "R" },
  { id: "G", label: "G" },
  { id: "C", label: "C" },
  { id: "M", label: "M" },
];

const TYPES = [
  { id: "creature", label: "Criatura" },
  { id: "instant", label: "Instantâneo" },
  { id: "sorcery", label: "Feitiço" },
  { id: "enchantment", label: "Encantamento" },
  { id: "artifact", label: "Artefato" },
  { id: "land", label: "Terreno" },
  { id: "planeswalker", label: "Planeswalker" },
  { id: "battle", label: "Batalha" },
];

const RARITIES = [
  { id: "common", label: "Comum" },
  { id: "uncommon", label: "Incomum" },
  { id: "rare", label: "Rara" },
  { id: "mythic", label: "Mítica" },
];

type Props = {
  syntax: string;
  onSyntaxChange: (value: string) => void;
  quick: CollectionQuickFilters;
  onQuickChange: (value: CollectionQuickFilters) => void;
  error?: string | null;
};

export function compileQuickFilters(quick: CollectionQuickFilters): string {
  const parts: string[] = [];
  const pip = quick.colors.filter((id) => id !== "C" && id !== "M").join("").toLowerCase();
  if (pip) parts.push(`c:${pip}`);
  if (quick.colors.includes("C")) parts.push("c:c");
  if (quick.colors.includes("M")) parts.push("c:m");
  if (quick.type) parts.push(`t:${quick.type}`);
  if (quick.cmc === "7+") parts.push("mv>=7");
  else if (quick.cmc !== "") parts.push(`mv=${quick.cmc}`);
  if (quick.rarity) parts.push(`r:${quick.rarity}`);
  if (quick.format) parts.push(`f:${quick.format}`);
  if (quick.set.trim()) parts.push(`e:${quick.set.trim()}`);
  return parts.join(" ");
}

export function CollectionFilters({ syntax, onSyntaxChange, quick, onQuickChange, error }: Props) {
  function toggleColor(id: string) {
    const colors = quick.colors.includes(id)
      ? quick.colors.filter((item) => item !== id)
      : [...quick.colors, id];
    onQuickChange({ ...quick, colors });
  }

  function clear() {
    onSyntaxChange("");
    onQuickChange(EMPTY_QUICK_FILTERS);
  }

  const active = Boolean(syntax.trim() || compileQuickFilters(quick));

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted">
        Filtros só desta coleção. Sintaxe Scryfall: espaço = AND, <code>or</code>, <code>-</code> nega, <code>!</code> nome
        exato. Ex.: <code>t:creature c:r mv&lt;=3</code>
      </p>
      <input
        aria-label="Query Scryfall"
        value={syntax}
        onChange={(event) => onSyntaxChange(event.target.value)}
        placeholder='t:creature c:wu o:draw f:commander'
        className="ui-input h-9 border-ink font-mono"
      />
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <fieldset>
          <legend className="ui-label mb-1 text-ink">Cor</legend>
          <div className="flex flex-wrap gap-1">
            {COLORS.map((color) => (
              <label
                key={color.id}
                className={`flex h-7 cursor-pointer items-center border px-2 font-mono text-[11px] ${
                  quick.colors.includes(color.id) ? "border-ink bg-ink text-white" : "border-border-line"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={quick.colors.includes(color.id)}
                  onChange={() => toggleColor(color.id)}
                />
                {color.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="space-y-1">
          <span className="ui-label text-ink">Tipo</span>
          <select
            aria-label="Tipo"
            value={quick.type}
            onChange={(event) => onQuickChange({ ...quick, type: event.target.value })}
            className="ui-input h-9 border-ink"
          >
            <option value="">Qualquer</option>
            {TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="ui-label text-ink">Mana value</span>
          <select
            aria-label="Mana value"
            value={quick.cmc}
            onChange={(event) => onQuickChange({ ...quick, cmc: event.target.value })}
            className="ui-input h-9 border-ink"
          >
            <option value="">Qualquer</option>
            {["0", "1", "2", "3", "4", "5", "6", "7+"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="ui-label text-ink">Raridade</span>
          <select
            aria-label="Raridade"
            value={quick.rarity}
            onChange={(event) => onQuickChange({ ...quick, rarity: event.target.value })}
            className="ui-input h-9 border-ink"
          >
            <option value="">Qualquer</option>
            {RARITIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="ui-label text-ink">Formato</span>
          <select
            aria-label="Formato legal"
            value={quick.format}
            onChange={(event) => onQuickChange({ ...quick, format: event.target.value })}
            className="ui-input h-9 border-ink"
          >
            <option value="">Qualquer</option>
            {FORMATS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="ui-label text-ink">Set</span>
          <input
            aria-label="Set do filtro"
            value={quick.set}
            onChange={(event) => onQuickChange({ ...quick, set: event.target.value })}
            placeholder="mh3, otc…"
            className="ui-input h-9 border-ink"
          />
        </label>
      </div>

      {active ? (
        <button type="button" className="ui-btn-outline h-8 px-3 text-[11px]" onClick={clear}>
          Limpar filtros
        </button>
      ) : null}
    </div>
  );
}
