import { useState, type ReactNode } from 'react'
import { MUSCLE_LABEL, type Muscle } from '../data/exercises'

type Shape = { m: Muscle; d?: string; e?: [number, number, number, number, number?] } // ellipse: cx, cy, rx, ry, rotate

// Halbe Figur (linke Bildseite = rechte Körperseite), wird gespiegelt.
const FRONT: Shape[] = [
  { m: 'front_shoulder', e: [70, 84, 10, 12, -20] },
  { m: 'side_shoulder', e: [60, 92, 7, 12, 10] },
  { m: 'chest', d: 'M99 80 C 90 76, 80 78, 76 86 C 72 96, 74 108, 82 113 C 90 117, 97 114, 99 108 Z' },
  { m: 'biceps', e: [58, 124, 8, 18, 8] },
  { m: 'forearms', e: [52, 168, 7, 22, 10] },
  { m: 'abs', d: 'M88 120 h10 v12 h-10 z M88 135 h10 v13 h-10 z M88 151 h10 v14 h-10 z M89 168 h9 v16 c-4 0-9-6-9-10 z' },
  { m: 'abs', d: 'M78 118 C 82 130, 85 150, 86 178 L 80 176 C 77 160, 74 135, 78 118 Z' },
  { m: 'quads', d: 'M80 200 C 74 220, 74 260, 82 292 L 96 292 C 99 265, 99 230, 97 205 Z' },
  { m: 'calves', e: [84, 335, 7, 26, -2] },
]
const BACK: Shape[] = [
  { m: 'upper_back', d: 'M100 62 L 86 70 L 74 82 L 88 92 L 100 128 Z' },
  { m: 'rear_shoulder', e: [70, 86, 10, 11, 20] },
  { m: 'side_shoulder', e: [60, 92, 7, 12, 10] },
  { m: 'lats', d: 'M76 96 C 76 120, 84 145, 97 160 L 99 132 L 88 96 Z' },
  { m: 'triceps', e: [58, 124, 8, 18, 8] },
  { m: 'forearms', e: [52, 168, 7, 22, 10] },
  { m: 'lower_back', d: 'M90 160 L 99 168 L 99 190 L 86 190 C 86 178, 87 168, 90 160 Z' },
  { m: 'glutes', d: 'M99 196 L 99 228 C 90 234, 80 230, 78 218 C 77 206, 84 196, 99 196 Z' },
  { m: 'hamstrings', d: 'M80 234 C 78 252, 80 275, 84 292 L 96 292 C 98 270, 98 250, 97 236 Z' },
  { m: 'calves', e: [84, 330, 9, 28, -2] },
]

const SILHOUETTE =
  'M100 8 C 112 8 119 18 119 32 C 119 44 113 52 108 56 L 108 62 C 120 66 132 70 138 78 C 146 84 148 96 147 108 L 152 140 C 156 156 160 174 160 190 L 156 194 C 150 184 146 170 142 156 L 137 130 C 135 150 133 172 132 190 C 134 214 132 250 126 292 C 124 315 125 340 122 368 L 120 384 L 106 384 L 106 360 C 104 330 104 300 102 260 L 100 222 L 98 260 C 96 300 96 330 94 360 L 94 384 L 80 384 L 78 368 C 75 340 76 315 74 292 C 68 250 66 214 68 190 C 67 172 65 150 63 130 L 58 156 C 54 170 50 184 44 194 L 40 190 C 40 174 44 156 48 140 L 53 108 C 52 96 54 84 62 78 C 68 70 80 66 92 62 L 92 56 C 87 52 81 44 81 32 C 81 18 88 8 100 8 Z'

function ShapeEl({ s, fill, onTap, stroke }: { s: Shape; fill: string; onTap: () => void; stroke: string }) {
  const common = { fill, stroke, strokeWidth: 0.8, onClick: onTap, style: { cursor: 'pointer', transition: 'fill .3s' } }
  if (s.e) {
    const [cx, cy, rx, ry, rot = 0] = s.e
    return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${rot} ${cx} ${cy})`} {...common} />
  }
  return <path d={s.d} {...common} />
}

function Figure({ shapes, colorOf, onTap, label }: { shapes: Shape[]; colorOf: (m: Muscle) => string; onTap: (m: Muscle) => void; label: string }) {
  const stroke = 'var(--bg)'
  const draw = (mirror: boolean) => (
    <g transform={mirror ? 'translate(200,0) scale(-1,1)' : undefined}>
      {shapes.map((s, i) => (
        <ShapeEl key={i} s={s} fill={colorOf(s.m)} stroke={stroke} onTap={() => onTap(s.m)} />
      ))}
    </g>
  )
  return (
    <div className="flex-1 min-w-0">
      <svg viewBox="30 0 140 392" className="w-full h-auto max-h-[340px]">
        <path d={SILHOUETTE} fill="var(--surface-3)" />
        {draw(false)}
        {draw(true)}
      </svg>
      <div className="text-center text-[11px] text-muted font-semibold uppercase tracking-wider -mt-1">{label}</div>
    </div>
  )
}

/** values: 0…1 je Muskel. mode bestimmt die Farbskala. */
export function BodyMap({
  values,
  mode = 'accent',
  legend,
  onSelect,
  renderInfo,
}: {
  values: Partial<Record<Muscle, number>>
  mode?: 'accent' | 'recovery' | 'volume'
  legend?: ReactNode
  onSelect?: (m: Muscle) => void
  renderInfo?: (m: Muscle) => ReactNode
}) {
  const [sel, setSel] = useState<Muscle | null>(null)
  const colorOf = (m: Muscle) => {
    const v = values[m]
    if (v == null || v <= 0) return mode === 'recovery' ? 'color-mix(in srgb, var(--accent) 22%, var(--surface-3))' : 'var(--surface-2)'
    if (mode === 'recovery') {
      // 0 = erschöpft (warm/rot) … 1 = erholt (zartes Volt)
      if (v >= 0.85) return 'color-mix(in srgb, var(--accent) 30%, var(--surface-3))'
      const c = v < 0.5 ? 'var(--bad)' : 'var(--warn)'
      return `color-mix(in srgb, ${c} 62%, var(--surface-3))`
    }
    if (mode === 'volume') {
      const c = v > 1 ? 'var(--bad)' : v >= 0.999 ? 'var(--good)' : 'var(--accent)'
      return `color-mix(in srgb, ${c} ${Math.round(25 + Math.min(v, 1) * 70)}%, var(--surface-3))`
    }
    return `color-mix(in srgb, var(--accent) ${Math.round(30 + Math.min(v, 1) * 70)}%, var(--surface-3))`
  }
  const tap = (m: Muscle) => {
    setSel((s) => (s === m ? null : m))
    onSelect?.(m)
  }
  return (
    <div>
      <div className="flex gap-2">
        <Figure shapes={FRONT} colorOf={colorOf} onTap={tap} label="Vorne" />
        <Figure shapes={BACK} colorOf={colorOf} onTap={tap} label="Hinten" />
      </div>
      <div className="min-h-6 mt-2 text-center text-sm">
        {sel ? (
          <span>
            <b>{MUSCLE_LABEL[sel]}</b>
            {renderInfo && <span className="text-muted"> · {renderInfo(sel)}</span>}
          </span>
        ) : (
          legend ?? <span className="text-muted text-xs">Tippe auf einen Muskel</span>
        )}
      </div>
    </div>
  )
}

export function musclesToValues(primary: Muscle[], secondary: Muscle[]) {
  const v: Partial<Record<Muscle, number>> = {}
  for (const m of secondary) v[m] = 0.35
  for (const m of primary) v[m] = 1
  return v
}
