/** Monochrome charts: thin ivory/taupe bars, dot matrices and step lines. Pure SVG/CSS, no chart library. */

export function ThinBars({ values, height = 72, label }: { values: number[]; height?: number; label: string }) {
  const max = Math.max(...values, 1);
  return (
    <div role="img" aria-label={label} className="flex items-end justify-between" style={{ height }}>
      {values.map((v, i) => (
        <span
          key={i}
          className={`w-[3px] transition-[height] duration-700 ease-[var(--ease-quiet)] ${i % 3 === 2 ? 'bg-faint' : 'bg-ink'}`}
          style={{ height: `${Math.max(v === 0 ? 4 : 8, (v / max) * 100)}%`, opacity: v === 0 ? 0.35 : 1 }}
        />
      ))}
    </div>
  );
}

/** Each column is one time bucket; lit dots stack from the bottom in proportion to the bucket value. */
export function DotMatrix({ values, rows = 6, label }: { values: number[]; rows?: number; label: string }) {
  const max = Math.max(...values, 1);
  return (
    <div role="img" aria-label={label} className="grid h-[72px] content-end gap-[6px]" style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}>
      {Array.from({ length: rows }).flatMap((_, r) =>
        values.map((v, c) => {
          const lit = rows - r <= Math.round((v / max) * rows) && v > 0;
          return <i key={`${r}-${c}`} className={`size-1 rounded-full transition-colors duration-500 ${lit ? 'bg-ink' : 'bg-faint/70'}`} />;
        }),
      )}
    </div>
  );
}

export function StepLine({ values, label, height = 72 }: { values: number[]; label: string; height?: number }) {
  const data = values.length ? values : [0];
  const max = Math.max(...data, 1);
  const w = 300;
  const step = w / data.length;
  const y = (v: number) => height - 10 - (v / max) * (height - 22);
  const points = data.flatMap((v, i) => [`${i * step},${y(v)}`, `${(i + 1) * step},${y(v)}`]).join(' ');
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <line x1="0" x2={w} y1={height - 4} y2={height - 4} stroke="var(--color-faint)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <polyline fill="none" stroke="var(--color-ink)" strokeWidth="1.5" points={points} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Horizontal proportion bar split into segments (ivory → taupe), used for failure categories. */
export function SegmentBar({ parts, label }: { parts: number[]; label: string }) {
  const total = parts.reduce((a, b) => a + b, 0);
  const tones = ['bg-ink', 'bg-muted', 'bg-faint', 'bg-line-strong'];
  return (
    <div role="img" aria-label={label} className="flex h-[3px] w-full gap-[3px]">
      {total === 0 ? (
        <span className="h-full w-full bg-line-strong" />
      ) : (
        parts.map((p, i) => p > 0 && <span key={i} className={`h-full ${tones[i % tones.length]}`} style={{ width: `${(p / total) * 100}%` }} />)
      )}
    </div>
  );
}
