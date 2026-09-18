const COLORS = [
  { id: "W", label: "Branco" },
  { id: "U", label: "Azul" },
  { id: "B", label: "Preto" },
  { id: "R", label: "Vermelho" },
  { id: "G", label: "Verde" },
] as const;

export function FilterPanel() {
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
      <header className="border-b border-zinc-800 px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          MTG Helper
        </p>
        <h1 className="mt-1 text-lg font-semibold text-zinc-50">Filtros</h1>
      </header>

      <div className="flex flex-1 flex-col gap-6 overflow-hidden px-4 py-4">
        <label className="flex flex-col gap-2 text-sm text-zinc-300">
          Buscar carta
          <input
            type="search"
            name="q"
            placeholder="Nome da carta"
            disabled
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-70"
          />
        </label>

        <fieldset disabled className="flex flex-col gap-2">
          <legend className="text-sm text-zinc-300">Cor</legend>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((color) => (
              <label
                key={color.id}
                className="flex items-center gap-2 rounded-md border border-zinc-700 px-2 py-1 text-sm text-zinc-400"
              >
                <input type="checkbox" name="color" value={color.id} />
                {color.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-2 text-sm text-zinc-300">
          Tipo
          <select
            name="type"
            disabled
            defaultValue=""
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <option value="">Qualquer tipo</option>
            <option value="creature">Criatura</option>
            <option value="instant">Instantâneo</option>
            <option value="sorcery">Feitiço</option>
            <option value="enchantment">Encantamento</option>
            <option value="artifact">Artefato</option>
            <option value="land">Terreno</option>
            <option value="planeswalker">Planeswalker</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-zinc-300">
          CMC
          <input
            type="number"
            name="cmc"
            min={0}
            placeholder="Custo de mana"
            disabled
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-70"
          />
        </label>

        <p className="text-xs leading-5 text-zinc-500">
          A busca na Scryfall ainda não está ligada. Estes controles são só o
          lugar dos filtros.
        </p>
      </div>
    </aside>
  );
}
