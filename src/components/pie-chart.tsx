"use client";

import { useRef, useState, type MouseEvent } from "react";

export type PieSlice = {
  key: string;
  label: string;
  count: number;
  color: string;
};

type Props<T extends PieSlice> = {
  slices: T[];
  ariaLabel: string;
  /** Pizza menor ao lado da legenda, para painéis laterais estreitos. */
  stacked?: boolean;
  /** Pinta o texto da legenda com a cor da fatia. */
  tintLegend?: boolean;
  /** Cor da borda das fatias; escura quando há fatias claras. */
  stroke?: string;
  legendLabel?: (slice: T) => string;
  tooltipLabel?: (slice: T) => string;
};

function polar(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function piePath(cx: number, cy: number, r: number, start: number, end: number) {
  if (end - start >= Math.PI * 2 - 1e-6) {
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
  }
  const a0 = start - Math.PI / 2;
  const a1 = end - Math.PI / 2;
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y} Z`;
}

/** Pizza SVG com legenda e tooltip ao pairar (F-004 / US-004-09, F-015). */
export function PieChart<T extends PieSlice>({
  slices,
  ariaLabel,
  stacked = false,
  tintLegend = true,
  stroke = "#fff",
  legendLabel = (slice) => `${slice.label} (${slice.count})`,
  tooltipLabel = (slice) => `${slice.label}: ${slice.count}`,
}: Props<T>) {
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ text: string; x: number; y: number } | null>(null);
  const total = slices.reduce((n, s) => n + s.count, 0);
  if (!total) return null;

  const cx = 90;
  const cy = 90;
  const r = 72;
  const arcs = slices.map((slice, index) => {
    const before = slices.slice(0, index).reduce((n, s) => n + s.count, 0);
    const start = (before / total) * Math.PI * 2;
    const end = ((before + slice.count) / total) * Math.PI * 2;
    return { slice, start, end };
  });

  function show(event: MouseEvent, slice: T) {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({
      text: tooltipLabel(slice),
      x: event.clientX - rect.left + 10,
      y: event.clientY - rect.top + 10,
    });
  }

  return (
    <div className={`flex gap-4 ${stacked ? "items-center" : "flex-col sm:flex-row sm:items-center"}`}>
      <div ref={box} className="relative shrink-0" onMouseLeave={() => setHover(null)}>
        <svg viewBox="0 0 180 180" className={stacked ? "h-32 w-32" : "mx-auto h-44 w-44"} role="img" aria-label={ariaLabel}>
          {arcs.map(({ slice, start, end }) => (
            <path
              key={slice.key}
              d={piePath(cx, cy, r, start, end)}
              fill={slice.color}
              stroke={stroke}
              strokeWidth={1.5}
              aria-label={tooltipLabel(slice)}
              onMouseEnter={(event) => show(event, slice)}
              onMouseMove={(event) => show(event, slice)}
            />
          ))}
        </svg>
        {hover ? (
          <div
            className="pointer-events-none absolute z-10 border border-ink bg-surface-container-lowest px-2 py-1 font-mono text-[12px] whitespace-nowrap text-ink shadow-[2px_2px_0_#09090b]"
            style={{ left: hover.x, top: hover.y }}
          >
            {hover.text}
          </div>
        ) : null}
      </div>
      <ul className="space-y-1.5 text-sm" aria-label={`Legenda: ${ariaLabel}`}>
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border border-black/20"
              style={{ background: slice.color }}
            />
            <span style={tintLegend ? { color: slice.color } : undefined} className="font-medium">
              {legendLabel(slice)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
