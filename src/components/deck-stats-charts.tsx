"use client";

import { useMemo } from "react";
import { manaCurve, typeDistribution, type ManaBucket, type TypeSlice } from "@/lib/deck-stats";

type CardLike = {
  quantity: number;
  type_line?: string | null;
  mana_cost?: string | null;
};

type Props = {
  cards: CardLike[];
};

function polar(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function piePath(cx: number, cy: number, r: number, start: number, end: number) {
  const a0 = start - Math.PI / 2;
  const a1 = end - Math.PI / 2;
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y} Z`;
}

function TypePie({ slices }: { slices: TypeSlice[] }) {
  const total = slices.reduce((n, s) => n + s.count, 0);
  if (!total) {
    return <p className="text-sm text-neutral-500">Sem cartas no deck.</p>;
  }

  const cx = 90;
  const cy = 90;
  const r = 72;
  let angle = 0;
  const arcs = slices.map((slice) => {
    const sweep = (slice.count / total) * Math.PI * 2;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    return { ...slice, start, end };
  });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <svg viewBox="0 0 180 180" className="mx-auto h-44 w-44 shrink-0" role="img" aria-label="Distribuição por tipo">
        {arcs.map((slice) => (
          <path
            key={slice.group}
            d={piePath(cx, cy, r, slice.start, slice.end)}
            fill={slice.color}
            stroke="#fff"
            strokeWidth={1.5}
          />
        ))}
      </svg>
      <ul className="space-y-1.5 text-sm">
        {slices.map((slice) => (
          <li key={slice.group} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: slice.color }} />
            <span style={{ color: slice.color }} className="font-medium">
              {slice.label} ({slice.count})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ManaBars({ buckets }: { buckets: ManaBucket[] }) {
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
        return (
          <g key={bucket.label}>
            <rect x={x} y={y} width={barW} height={Math.max(h, bucket.count ? 2 : 0)} fill="#3b82f6" />
            <text
              x={x + barW / 2}
              y={chartH - 6}
              textAnchor="middle"
              className="fill-neutral-700"
              style={{ fontSize: 11 }}
            >
              {bucket.label}
            </text>
            {bucket.count > 0 ? (
              <text
                x={x + barW / 2}
                y={y - 4}
                textAnchor="middle"
                className="fill-neutral-600"
                style={{ fontSize: 10 }}
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
export function DeckStatsCharts({ cards }: Props) {
  const slices = useMemo(() => typeDistribution(cards), [cards]);
  const curve = useMemo(() => manaCurve(cards), [cards]);
  const total = cards.reduce((n, c) => n + c.quantity, 0);

  if (!total) return null;

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="border border-black p-4">
        <h2 className="mb-3 text-sm font-medium uppercase">Distribuição por tipo</h2>
        <TypePie slices={slices} />
      </div>
      <div className="border border-black p-4">
        <h2 className="mb-3 text-sm font-medium uppercase">Curva de mana</h2>
        <p className="mb-2 text-xs text-neutral-500">Exclui terrenos.</p>
        <ManaBars buckets={curve} />
      </div>
    </section>
  );
}
