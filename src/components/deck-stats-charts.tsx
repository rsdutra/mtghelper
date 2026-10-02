"use client";

import { useMemo, useState } from "react";
import { PieChart } from "@/components/pie-chart";
import { manaCurve, typeDistribution, type ManaBucket, type TypeSlice } from "@/lib/deck-stats";

type CardLike = {
  quantity: number;
  type_line?: string | null;
  mana_cost?: string | null;
};

type Props = {
  cards: CardLike[];
  /** Um gráfico por linha, para painéis laterais estreitos (F-011 / US-011-02). */
  stacked?: boolean;
};

function TypePie({ slices, stacked }: { slices: TypeSlice[]; stacked: boolean }) {
  if (!slices.length) {
    return <p className="text-sm text-neutral-500">Sem cartas no deck.</p>;
  }
  return (
    <PieChart
      slices={slices.map((slice) => ({ ...slice, key: slice.group }))}
      ariaLabel="Distribuição por tipo"
      stacked={stacked}
    />
  );
}

function ManaBars({ buckets }: { buckets: ManaBucket[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const chartH = 140;
  const chartW = 280;
  const padL = 8;
  const padB = 24;
  const padT = 8;
  const innerH = chartH - padB - padT;
  const barGap = 8;
  const barW = (chartW - padL * 2 - barGap * (buckets.length - 1)) / buckets.length;

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="h-44 w-full max-w-md" role="img" aria-label="Curva de mana">
      {[0.25, 0.5, 0.75, 1].map((t) => {
        const y = padT + innerH * (1 - t);
        return (
          <line
            key={t}
            x1={padL}
            x2={chartW - padL}
            y1={y}
            y2={y}
            stroke="#d4d4d4"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
        );
      })}
      {buckets.map((bucket, index) => {
        const h = (bucket.count / max) * innerH;
        const x = padL + index * (barW + barGap);
        const y = padT + innerH - h;
        const active = hover === index;
        return (
          <g key={bucket.label} onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)}>
            <rect x={x} y={padT} width={barW} height={innerH} fill="transparent" />
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, bucket.count ? 2 : 0)}
              fill={active ? "#1d4ed8" : "#3b82f6"}
              aria-label={`${bucket.label}: ${bucket.count}`}
            />
            <text
              x={x + barW / 2}
              y={chartH - 6}
              textAnchor="middle"
              className="fill-neutral-700"
              style={{ fontSize: 11 }}
            >
              {bucket.label}
            </text>
            {active ? (
              <text
                x={x + barW / 2}
                y={Math.max(12, y - 4)}
                textAnchor="middle"
                className="fill-neutral-900"
                style={{ fontSize: 12, fontWeight: 700 }}
              >
                {bucket.count}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/** Charts de tipo e curva de mana para cartas included (F-004 / US-004-09). */
export function DeckStatsCharts({ cards, stacked = false }: Props) {
  const slices = useMemo(() => typeDistribution(cards), [cards]);
  const curve = useMemo(() => manaCurve(cards), [cards]);
  const total = cards.reduce((n, c) => n + c.quantity, 0);

  if (!total) return null;

  return (
    <section className={`grid gap-4 ${stacked ? "" : "md:grid-cols-2"}`}>
      <div className="border border-outline-variant bg-surface-container-lowest p-4">
        <h2 className="mb-3 text-sm font-medium uppercase">Distribuição por tipo</h2>
        <TypePie slices={slices} stacked={stacked} />
      </div>
      <div className="border border-outline-variant bg-surface-container-lowest p-4">
        <h2 className="mb-3 text-sm font-medium uppercase">Curva de mana</h2>
        <p className="mb-2 text-xs text-neutral-500">Exclui terrenos.</p>
        <ManaBars buckets={curve} />
      </div>
    </section>
  );
}
