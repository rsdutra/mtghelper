"use client";

import { useId, useMemo, type ReactNode } from "react";
import { PieChart } from "@/components/pie-chart";
import {
  landProductionDistribution,
  manaSymbolDistribution,
  type ManaColorCard,
  type ManaColorSlice,
} from "@/lib/mana-colors";

type Props = {
  cards: ManaColorCard[];
};

function toPieSlices(slices: ManaColorSlice[]) {
  return slices.map((slice) => ({ ...slice, key: slice.color, color: slice.fill }));
}

function ToolSection({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="border border-outline-variant bg-surface-container-lowest p-4 shadow-panel">
      <h3 id={headingId} className="text-sm font-medium uppercase">
        {title}
      </h3>
      <p className="mt-1 mb-3 font-mono text-[12px] text-muted">{summary}</p>
      {children}
    </section>
  );
}

/** Ferramentas de construção do deck, adaptadas do Moxfield (F-015). */
export function DeckBuildTools({ cards }: Props) {
  const symbols = useMemo(() => manaSymbolDistribution(cards), [cards]);
  const production = useMemo(() => landProductionDistribution(cards), [cards]);

  return (
    <div className="space-y-4">
      <h2 className="ui-label text-ink">Ferramentas de construção</h2>

      <ToolSection
        title="Símbolos de mana por cor"
        summary={`Total: ${symbols.total} ${symbols.total === 1 ? "símbolo" : "símbolos"}. Não conta mana genérica nem terrenos.`}
      >
        {symbols.slices.length ? (
          <PieChart
            slices={toPieSlices(symbols.slices)}
            ariaLabel="Símbolos de mana por cor"
            stacked
            tintLegend={false}
            stroke="#09090b"
            legendLabel={(slice) => `${slice.label}: ${slice.count} (${slice.percent}%)`}
            tooltipLabel={(slice) => `${slice.label}: ${slice.count} (${slice.percent}%)`}
          />
        ) : (
          <p className="text-sm text-neutral-500">Nenhum símbolo de mana de cor no deck.</p>
        )}
      </ToolSection>

      <ToolSection
        title="Produção de mana dos terrenos"
        summary={`Total: ${production.lands} ${production.lands === 1 ? "terreno" : "terrenos"}`}
      >
        {production.slices.length ? (
          <PieChart
            slices={toPieSlices(production.slices)}
            ariaLabel="Produção de mana dos terrenos"
            stacked
            tintLegend={false}
            stroke="#09090b"
            legendLabel={(slice) => `${slice.label}: ${slice.count} (${slice.percent}%)`}
            tooltipLabel={(slice) => `${slice.label}: ${slice.count} (${slice.percent}%)`}
          />
        ) : (
          <p className="text-sm text-neutral-500">Nenhum terreno que gere mana no deck.</p>
        )}
        {production.withoutProduction ? (
          <p className="mt-3 text-[13px] text-muted">
            {production.withoutProduction} {production.withoutProduction === 1 ? "terreno" : "terrenos"} sem produção direta
          </p>
        ) : null}
      </ToolSection>
    </div>
  );
}
