"use client";

import { useMemo, useRef, useState, type MouseEvent } from "react";
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

function TypePie({ slices, stacked }: { slices: TypeSlice[]; stacked: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ label: string; count: number; x: number; y: number } | null>(null);
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

  function show(event: MouseEvent, slice: TypeSlice) {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({
      label: slice.label,
      count: slice.count,
      x: event.clientX - rect.left + 10,
      y: event.clientY - rect.top + 10,
    });
  }

  return (
    <div className={`flex gap-4 ${stacked ? "items-center" : "flex-col sm:flex-row sm:items-center"}`}>
      <div ref={box} className="relative shrink-0" onMouseLeave={() => setHover(null)}>
        <svg viewBox="0 0 180 180" className={stacked ? "h-32 w-32" : "mx-auto h-44 w-44"} role="img" aria-label="Distribuição por tipo">
          {arcs.map((slice) => (
            <path
              key={slice.group}
              d={piePath(cx, cy, r, slice.start, slice.end)}
              fill={slice.color}
              stroke="#fff"
              strokeWidth={1.5}
              aria-label={`${slice.label}: ${slice.count}`}
              onMouseEnter={(event) => show(event, slice)}
              onMouseMove={(event) => show(event, slice)}
            />
          ))}
        </svg>
        {hover ? (
          <div
            className="pointer-events-none absolute z-10 border border-ink bg-surface-container-lowest px-2 py-1 font-mono text-[12px] text-ink shadow-[2px_2px_0_#09090b]"
            style={{ left: hover.x, top: hover.y }}
          >
            {hover.label}: {hover.count}
          </div>
        ) : null}
      </div>
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
