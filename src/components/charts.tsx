import { useMemo, useState } from 'react'
import { addDays, fmtDate, isoDate, startOfWeek } from '../lib/date'
import { cx } from './ui'

export interface Point {
  x: number // timestamp
  y: number
  label?: string
}

export function LineChart({ points, height = 160, unit = '', color = 'var(--accent)', fmt = (v: number) => String(Math.round(v * 10) / 10) }: { points: Point[]; height?: number; unit?: string; color?: string; fmt?: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 320
  const H = height
  const pad = { l: 34, r: 10, t: 12, b: 22 }
  const data = useMemo(() => [...points].sort((a, b) => a.x - b.x), [points])
  const gid = useMemo(() => 'g' + Math.random().toString(36).slice(2), [])
  if (data.length < 2) return <div className="text-sm text-muted text-center py-8">Noch zu wenig Daten für ein Diagramm</div>
  const ys = data.map((p) => p.y)
  let min = Math.min(...ys)
  let max = Math.max(...ys)
  if (min === max) {
    min -= 1
    max += 1
  }
  const span = max - min
  min -= span * 0.1
  max += span * 0.1
  const x0 = data[0].x
  const x1 = data[data.length - 1].x
  const sx = (x: number) => pad.l + ((x - x0) / (x1 - x0 || 1)) * (W - pad.l - pad.r)
  const sy = (y: number) => pad.t + (1 - (y - min) / (max - min)) * (H - pad.t - pad.b)
  const line = data.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')
  const area = `${line} L${sx(x1)},${H - pad.b} L${sx(x0)},${H - pad.b} Z`
  const ticks = [min + (max - min) * 0.15, (min + max) / 2, max - (max - min) * 0.15]
  const h = hover != null ? data[hover] : null
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto touch-none"
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          let best = 0
          data.forEach((p, i) => Math.abs(sx(p.x) - px) < Math.abs(sx(data[best].x) - px) && (best = i))
          setHover(best)
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.28" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={pad.l - 6} y={sy(t) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--muted)">
              {fmt(t)}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 6} fontSize="9.5" fill="var(--muted)">
          {fmtDate(new Date(x0))}
        </text>
        <text x={W - pad.r} y={H - 6} fontSize="9.5" fill="var(--muted)" textAnchor="end">
          {fmtDate(new Date(x1))}
        </text>
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {data.length <= 40 && data.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2.6} fill={color} />)}
        {h && (
          <g>
            <line x1={sx(h.x)} x2={sx(h.x)} y1={pad.t} y2={H - pad.b} stroke="var(--muted)" strokeOpacity=".4" />
            <circle cx={sx(h.x)} cy={sy(h.y)} r={5} fill={color} stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && (
        <div className="absolute top-0 right-0 bg-surface-2 border border-line rounded-lg px-2 py-1 text-xs pointer-events-none">
          <b className="tabular">
            {fmt(h.y)} {unit}
          </b>{' '}
          <span className="text-muted">{h.label ?? fmtDate(new Date(h.x))}</span>
        </div>
      )}
    </div>
  )
}

export function BarChart({ bars, height = 140, fmt = (v: number) => String(Math.round(v)), highlight }: { bars: { label: string; value: number }[]; height?: number; fmt?: (v: number) => string; highlight?: number }) {
  const max = Math.max(1, ...bars.map((b) => b.value))
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {bars.map((b, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0 group">
          <div className="text-[10px] text-muted tabular mb-1 opacity-0 group-hover:opacity-100 transition">{b.value ? fmt(b.value) : ''}</div>
          <div
            className={cx('w-full rounded-md transition-all', i === highlight ? 'bg-accent' : 'bg-accent/35')}
            style={{ height: `${Math.max(b.value ? 4 : 2, (b.value / max) * (height - 34))}px`, opacity: b.value ? 1 : 0.4 }}
          />
          <div className={cx('text-[10px] mt-1.5 truncate w-full text-center', i === highlight ? 'text-fg font-bold' : 'text-muted')}>{b.label}</div>
        </div>
      ))}
    </div>
  )
}

/** GitHub-artige Trainingsheatmap der letzten N Wochen */
export function Heatmap({ counts, weeks = 26, planned }: { counts: Map<string, number>; weeks?: number; planned?: Set<number> }) {
  const start = startOfWeek(new Date(), -(weeks - 1))
  const today = isoDate(new Date())
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)))
  const months: { col: number; label: string }[] = []
  cols.forEach((c, i) => {
    const m = c[0].getMonth()
    if (i === 0 || cols[i - 1][0].getMonth() !== m) months.push({ col: i, label: c[0].toLocaleDateString('de-DE', { month: 'short' }) })
  })
  return (
    <div className="overflow-x-auto no-scrollbar">
      <div className="inline-block min-w-full">
        <div className="relative h-4 text-[10px] text-muted ml-5">
          {months.map((m) => (
            <span key={m.col} className="absolute" style={{ left: m.col * 14 }}>
              {m.label}
            </span>
          ))}
        </div>
        <div className="flex gap-[3px]">
          <div className="flex flex-col gap-[3px] text-[9px] text-muted w-4 mr-0.5">
            {['M', '', 'M', '', 'F', '', 'S'].map((l, i) => (
              <div key={i} className="h-[11px] leading-[11px]">
                {l}
              </div>
            ))}
          </div>
          {cols.map((c, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {c.map((d, j) => {
                const k = isoDate(d)
                const n = counts.get(k) ?? 0
                const future = k > today
                return (
                  <div
                    key={j}
                    title={`${fmtDate(d)}: ${n} Training${n === 1 ? '' : 's'}`}
                    className={cx('w-[11px] h-[11px] rounded-[3px]', k === today && 'ring-1 ring-fg/60')}
                    style={{
                      background: future ? 'transparent' : n ? `color-mix(in srgb, var(--accent) ${n > 1 ? 100 : 70}%, transparent)` : planned?.has(j) ? 'var(--surface-3)' : 'var(--surface-2)',
                      border: future ? '1px dashed var(--border)' : undefined,
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Ring({ value, size = 56, stroke = 6, children, color = 'var(--accent)' }: { value: number; size?: number; stroke?: number; children?: React.ReactNode; color?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-3)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))} style={{ transition: 'stroke-dashoffset .6s' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}
