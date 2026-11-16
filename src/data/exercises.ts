import raw from './library.json'
import rec from './recommended.json'
import type { CustomExercise } from '../lib/types'

export type Muscle =
  | 'chest' | 'front_shoulder' | 'side_shoulder' | 'rear_shoulder' | 'biceps' | 'triceps' | 'forearms'
  | 'upper_back' | 'lats' | 'lower_back' | 'abs' | 'glutes' | 'quads' | 'hamstrings' | 'calves'

export const MUSCLES: { id: Muscle; label: string; target: [number, number] }[] = [
  { id: 'chest', label: 'Brust', target: [10, 20] },
  { id: 'front_shoulder', label: 'Vordere Schulter', target: [6, 12] },
  { id: 'side_shoulder', label: 'Seitliche Schulter', target: [8, 20] },
  { id: 'rear_shoulder', label: 'Hintere Schulter', target: [6, 16] },
  { id: 'biceps', label: 'Bizeps', target: [8, 18] },
  { id: 'triceps', label: 'Trizeps', target: [8, 16] },
  { id: 'forearms', label: 'Unterarme', target: [4, 12] },
  { id: 'upper_back', label: 'Oberer Rücken / Trapez', target: [8, 18] },
  { id: 'lats', label: 'Latissimus', target: [10, 20] },
  { id: 'lower_back', label: 'Unterer Rücken', target: [4, 10] },
  { id: 'abs', label: 'Bauch', target: [6, 16] },
  { id: 'glutes', label: 'Gesäß', target: [6, 16] },
  { id: 'quads', label: 'Quadrizeps', target: [8, 18] },
  { id: 'hamstrings', label: 'Beinbeuger', target: [6, 14] },
  { id: 'calves', label: 'Waden', target: [8, 16] },
]
export const MUSCLE_LABEL = Object.fromEntries(MUSCLES.map((m) => [m.id, m.label])) as Record<Muscle, string>

export const GROUPS = [
  'Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Unterarme', 'Beine — Quadrizeps',
  'Beine — Hamstrings & Gesäß', 'Waden', 'Bauch & Core', 'Ganzkörper & Compound', 'Cardio & Kondition', 'Dehnen & Mobility',
]

/** Muskelgruppen für Trainingspläne (grob) */
export const PLAN_GROUPS = ['Brust', 'Rücken', 'Schultern', 'Arme', 'Beine', 'Core', 'Ganzkörper', 'Push', 'Pull', 'Oberkörper', 'Unterkörper', 'Cardio']

export const GROUP_COLOR: Record<string, string> = {
  Brust: '#ef4444', Rücken: '#3b82f6', Schultern: '#f59e0b', Bizeps: '#8b5cf6', Trizeps: '#a855f7', Arme: '#8b5cf6',
  Unterarme: '#a78bfa', Beine: '#22c55e', 'Beine — Quadrizeps': '#22c55e', 'Beine — Hamstrings & Gesäß': '#16a34a',
  Waden: '#4ade80', Core: '#14b8a6', 'Bauch & Core': '#14b8a6', Ganzkörper: '#f97316', 'Ganzkörper & Compound': '#f97316',
  Cardio: '#ec4899', 'Cardio & Kondition': '#ec4899', 'Dehnen & Mobility': '#64748b', Push: '#ef4444', Pull: '#3b82f6',
  Oberkörper: '#6366f1', Unterkörper: '#22c55e',
}
export const groupColor = (g?: string | null) => (g && GROUP_COLOR[g]) || '#64748b'

export interface ExerciseInfo {
  name: string
  group: string
  area: string
  primary: Muscle[]
  secondary: Muscle[]
  custom?: boolean
  compound: boolean
}

const fixShoulder = (name: string, muscles: Muscle[]): Muscle[] => {
  // v1 kannte keine seitliche Schulter: Seitheben & Co. darauf umbuchen
  if (/seitheb|lateral|upright|aufrecht/i.test(name)) return muscles.map((m) => (m === 'front_shoulder' ? 'side_shoulder' : m))
  if (/face pull|reverse fly|butterfly reverse|reverse pec|hintere schulter|vorgebeugt.*seit/i.test(name))
    return muscles.map((m) => (m === 'front_shoulder' ? 'rear_shoulder' : m))
  return muscles
}

const COMPOUND = /bankdr|kniebeug|squat|kreuzheb|deadlift|rudern|row|klimmz|pull.?up|chin|dips|press|drücken|ausfall|lunge|hip thrust|beinpresse|clean|snatch|thruster|latzug/i

const LIBRARY: ExerciseInfo[] = (raw as [string, string, string, string, string][]).map(([name, group, area, p, s]) => ({
  name,
  group,
  area,
  primary: fixShoulder(name, (p ? p.split(',') : []) as Muscle[]),
  secondary: fixShoulder(name, (s ? s.split(',') : []) as Muscle[]),
  compound: COMPOUND.test(name),
}))
const BY_NAME = new Map(LIBRARY.map((e) => [e.name, e]))

export function allExercises(custom: CustomExercise[] = [], hidden: string[] = []): ExerciseInfo[] {
  const h = new Set(hidden)
  const customs: ExerciseInfo[] = custom.map((c) => ({
    name: c.name,
    group: c.muscle_group,
    area: '',
    primary: (c.primary_muscles?.length ? c.primary_muscles : guessMuscles(c.muscle_group)[0]) as Muscle[],
    secondary: (c.secondary_muscles ?? []) as Muscle[],
    custom: true,
    compound: COMPOUND.test(c.name),
  }))
  return [...customs, ...LIBRARY.filter((e) => !h.has(e.name))]
}

function guessMuscles(group: string): [Muscle[], Muscle[]] {
  const g = group.toLowerCase()
  if (g.includes('brust')) return [['chest'], ['front_shoulder', 'triceps']]
  if (g.includes('rücken') || g === 'pull') return [['lats', 'upper_back'], ['biceps']]
  if (g.includes('schulter')) return [['front_shoulder', 'side_shoulder'], ['triceps']]
  if (g.includes('bizeps') || g === 'arme') return [['biceps'], ['forearms']]
  if (g.includes('trizeps')) return [['triceps'], []]
  if (g.includes('unterarm')) return [['forearms'], []]
  if (g.includes('wade')) return [['calves'], []]
  if (g.includes('hamstring') || g.includes('gesäß')) return [['hamstrings', 'glutes'], []]
  if (g.includes('bein') || g.includes('unterkörper')) return [['quads', 'glutes'], ['hamstrings']]
  if (g.includes('bauch') || g.includes('core')) return [['abs'], []]
  return [[], []]
}

let customCache: CustomExercise[] = []
export const setCustomCache = (c: CustomExercise[]) => (customCache = c)

export function exerciseInfo(name: string): ExerciseInfo {
  const hit = BY_NAME.get(name)
  if (hit) return hit
  const c = customCache.find((x) => x.name === name)
  if (c) return allExercises([c])[0]
  // heuristics for names from old default plans ("Bankdrücken", "Latzug weit" …)
  const n = name.toLowerCase()
  const guess = (g: string): ExerciseInfo => {
    const [p, s] = guessMuscles(g)
    return { name, group: g, area: '', primary: fixShoulder(name, p), secondary: s, compound: COMPOUND.test(name) }
  }
  if (/bank|brust|fliegend|butterfly|pec|dips|liegestütz|push.?up|crossover/.test(n)) return guess('Brust')
  if (/rudern|row|latzug|klimm|pull|lat |kreuzheb|deadlift/.test(n)) return guess('Rücken')
  if (/schulter|seitheb|military|overhead|arnold|face/.test(n)) return guess('Schultern')
  if (/curl|bizeps/.test(n)) return guess('Bizeps')
  if (/trizeps|skull|french|pushdown|kickback/.test(n)) return guess('Trizeps')
  if (/wade|calf/.test(n)) return guess('Waden')
  if (/beinbeug|leg curl|rdl|romanian|hip|gesäß|glute/.test(n)) return guess('Beine — Hamstrings & Gesäß')
  if (/knieb|squat|beinpress|ausfall|lunge|beinstreck|leg/.test(n)) return guess('Beine')
  if (/bauch|crunch|plank|core|sit.?up/.test(n)) return guess('Bauch & Core')
  return { name, group: 'Sonstige', area: '', primary: [], secondary: [], compound: COMPOUND.test(name) }
}

export const RECOMMENDED: Record<string, { name: string; sets: number; reps: number; weight: number }[]> = Object.fromEntries(
  Object.entries(rec as unknown as Record<string, [string, number, number, number][]>).map(([g, l]) => [
    g,
    l.map(([name, sets, reps, weight]) => ({ name, sets, reps, weight })),
  ]),
)

/** Simple fuzzy search: all tokens must appear (umlaut-insensitive). */
export function normalize(s: string) {
  return s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
}
export function searchExercises(list: ExerciseInfo[], q: string) {
  const tokens = normalize(q).split(/\s+/).filter(Boolean)
  if (!tokens.length) return list
  return list
    .map((e) => {
      const hay = normalize(`${e.name} ${e.group} ${e.area} ${e.primary.map((m) => MUSCLE_LABEL[m]).join(' ')}`)
      if (!tokens.every((t) => hay.includes(t))) return null
      const nm = normalize(e.name)
      const score = (nm.startsWith(tokens[0]) ? 0 : 1) + (nm.includes(tokens.join(' ')) ? 0 : 1) + nm.length / 200
      return { e, score }
    })
    .filter((x): x is { e: ExerciseInfo; score: number } => !!x)
    .sort((a, b) => a.score - b.score)
    .map((x) => x.e)
}
