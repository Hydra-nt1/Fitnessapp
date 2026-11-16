import { exerciseInfo, MUSCLES, type Muscle } from '../data/exercises'
import { addDays, startOfWeek, weekdayOf, isoDate, parseIsoDate } from './date'
import type { QuickLog, RoutineExercise, WeekPlanDay, Workout, WorkoutSet } from './types'

// ── Kraftwerte ─────────────────────────────────────────────────────
/** Geschätztes 1RM (Epley; bei >12 Wdh. zu ungenau → null) */
export function e1rm(weight: number, reps: number) {
  if (!weight || !reps || reps > 15) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}
export const round = (v: number, step = 2.5) => Math.round(v / step) * step
export const fmtKg = (v: number) => String(Math.round(Number(v) * 100) / 100).replace('.', ',')
/** '80×8' bzw. '8 Wdh.' bei Körpergewicht */
export const fmtSet = (weight: number, reps: number) => (weight ? `${fmtKg(weight)}×${reps}` : `${reps} Wdh.`)
export function fmtVolume(kg: number) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1).replace('.', ',')} t`
  return `${Math.round(kg)} kg`
}

export const isWorkingSet = (s: Pick<WorkoutSet, 'set_type' | 'done'>) => s.done && s.set_type !== 'warmup'

// ── Verlauf pro Übung ──────────────────────────────────────────────
export interface ExerciseSession {
  date: string
  workoutId: string | null
  sets: { weight: number; reps: number; rpe: number | null; set_type: string }[]
  topWeight: number
  bestE1rm: number
  volume: number
  quick?: boolean
}

export function exerciseHistory(name: string, workouts: Workout[], sets: WorkoutSet[], quick: QuickLog[] = []): ExerciseSession[] {
  const wById = new Map(workouts.map((w) => [w.id, w]))
  const by = new Map<string, ExerciseSession>()
  for (const s of sets) {
    if (s.exercise_name !== name || !isWorkingSet(s)) continue
    const w = wById.get(s.workout_id)
    if (!w) continue
    let e = by.get(w.id)
    if (!e) by.set(w.id, (e = { date: w.started_at, workoutId: w.id, sets: [], topWeight: 0, bestE1rm: 0, volume: 0 }))
    e.sets.push({ weight: +s.weight, reps: s.reps, rpe: s.rpe, set_type: s.set_type })
  }
  const out = [...by.values()]
  for (const q of quick) {
    if (q.exercise_name !== name) continue
    out.push({
      date: parseIsoDate(q.week_start).toISOString(),
      workoutId: null,
      quick: true,
      sets: Array.from({ length: q.sets }, () => ({ weight: +q.weight, reps: q.reps, rpe: null, set_type: 'normal' })),
      topWeight: 0,
      bestE1rm: 0,
      volume: 0,
    })
  }
  for (const e of out) {
    e.topWeight = Math.max(0, ...e.sets.map((s) => s.weight))
    e.bestE1rm = Math.max(0, ...e.sets.map((s) => e1rm(s.weight, s.reps)))
    e.volume = e.sets.reduce((a, s) => a + s.weight * s.reps, 0)
  }
  return out.sort((a, b) => +new Date(b.date) - +new Date(a.date))
}

export interface Records {
  maxWeight: number
  maxE1rm: number
  maxVolumeSession: number
  maxReps: number
}
export function personalRecords(hist: ExerciseSession[]): Records {
  const r: Records = { maxWeight: 0, maxE1rm: 0, maxVolumeSession: 0, maxReps: 0 }
  for (const h of hist) {
    r.maxWeight = Math.max(r.maxWeight, h.topWeight)
    r.maxE1rm = Math.max(r.maxE1rm, h.bestE1rm)
    r.maxVolumeSession = Math.max(r.maxVolumeSession, h.volume)
    r.maxReps = Math.max(r.maxReps, ...h.sets.map((s) => s.reps))
  }
  return r
}

export interface PR {
  exercise: string
  kind: 'Gewicht' | '1RM' | 'Volumen'
  value: number
  previous: number
}
/** Vergleicht die Sätze eines neuen Workouts mit dem bisherigen Verlauf */
export function detectPRs(newSets: Pick<WorkoutSet, 'exercise_name' | 'weight' | 'reps' | 'set_type' | 'done'>[], prevHistory: (name: string) => ExerciseSession[]): PR[] {
  const prs: PR[] = []
  const names = [...new Set(newSets.map((s) => s.exercise_name))]
  for (const name of names) {
    const mine = newSets.filter((s) => s.exercise_name === name && isWorkingSet(s) && s.weight > 0 && s.reps > 0)
    if (!mine.length) continue
    const prev = personalRecords(prevHistory(name))
    if (!prev.maxWeight) continue // erstes Mal → kein PR-Feuerwerk
    const top = Math.max(...mine.map((s) => +s.weight))
    const best = Math.max(...mine.map((s) => e1rm(+s.weight, s.reps)))
    const vol = mine.reduce((a, s) => a + s.weight * s.reps, 0)
    if (top > prev.maxWeight) prs.push({ exercise: name, kind: 'Gewicht', value: top, previous: prev.maxWeight })
    else if (best > prev.maxE1rm + 0.01) prs.push({ exercise: name, kind: '1RM', value: best, previous: prev.maxE1rm })
    else if (vol > prev.maxVolumeSession) prs.push({ exercise: name, kind: 'Volumen', value: vol, previous: prev.maxVolumeSession })
  }
  return prs
}

// ── Progressions-Vorschlag (Double Progression) ────────────────────
export interface Suggestion {
  weight: number
  reps: number
  reason: string
  trend: 'up' | 'same' | 'down' | 'new'
}
export function suggestNext(
  target: Pick<RoutineExercise, 'reps_min' | 'reps_max' | 'weight' | 'sets'> | null,
  hist: ExerciseSession[],
  increment = 2.5,
): Suggestion {
  const repsMin = target?.reps_min ?? 8
  const repsMax = target?.reps_max ?? 12
  const last = hist[0]
  if (!last || !last.sets.length) {
    return { weight: target?.weight ?? 0, reps: repsMin, reason: 'Erste Einheit – starte konservativ', trend: 'new' }
  }
  const work = last.sets
  const top = Math.max(...work.map((s) => s.weight))
  const atTop = work.filter((s) => s.weight === top)
  const minReps = Math.min(...atTop.map((s) => s.reps))
  const rpes = atTop.map((s) => s.rpe).filter((x): x is number => x != null)
  const maxRpe = rpes.length ? Math.max(...rpes) : null
  const step = top === 0 ? 0 : increment
  if (top === 0) {
    // Körpergewicht: Wiederholungen steigern
    return { weight: 0, reps: Math.max(...work.map((s) => s.reps)) + 1, reason: 'Körpergewicht – 1 Wdh. mehr', trend: 'up' }
  }
  if (minReps >= repsMax && (maxRpe == null || maxRpe <= 9)) {
    return { weight: round(top + step, Math.min(step, 2.5) || 2.5), reps: repsMin, reason: `Alle Sätze ${repsMax}+ Wdh. → +${fmtKg(step)} kg`, trend: 'up' }
  }
  if (minReps < Math.max(1, repsMin - 2) || (maxRpe != null && maxRpe >= 10 && minReps < repsMin)) {
    const w = round(top * 0.9, 2.5)
    return { weight: w, reps: repsMin, reason: 'Zu schwer letztes Mal → Gewicht 10 % runter', trend: 'down' }
  }
  return {
    weight: top,
    reps: Math.min(repsMax, minReps + 1),
    reason: `Gewicht halten, Ziel ${Math.min(repsMax, minReps + 1)} Wdh.`,
    trend: 'same',
  }
}

// ── Aufwärmsätze & Scheibenrechner ─────────────────────────────────
export function warmupSets(workWeight: number, bar = 20): { weight: number; reps: number }[] {
  if (workWeight < bar + 10) return []
  const steps: [number, number][] = workWeight >= 100 ? [[0, 10], [0.4, 8], [0.6, 5], [0.75, 3], [0.9, 1]] : [[0, 10], [0.5, 8], [0.7, 4], [0.85, 2]]
  const out: { weight: number; reps: number }[] = []
  for (const [pct, reps] of steps) {
    const w = pct === 0 ? bar : Math.max(bar, round(workWeight * pct, 2.5))
    if (w >= workWeight) continue
    if (out.length && out[out.length - 1].weight === w) continue
    out.push({ weight: w, reps })
  }
  return out
}

export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25]
export function platesFor(total: number, bar = 20, available = PLATES) {
  let side = (total - bar) / 2
  if (side <= 0) return { plates: [] as number[], rest: Math.max(0, total - bar) === 0 ? 0 : total - bar }
  const plates: number[] = []
  for (const p of available) {
    while (side >= p - 1e-9) {
      plates.push(p)
      side -= p
    }
  }
  return { plates, rest: Math.round(side * 2 * 100) / 100 }
}

// ── Muskel-Volumen ──────────────────────────────────────────────────
/** Harte Sätze pro Muskel: primär = 1, sekundär = 0,5 */
export function muscleVolume(sets: Pick<WorkoutSet, 'exercise_name' | 'set_type' | 'done'>[]) {
  const vol = Object.fromEntries(MUSCLES.map((m) => [m.id, 0])) as Record<Muscle, number>
  for (const s of sets) {
    if (!isWorkingSet(s)) continue
    const info = exerciseInfo(s.exercise_name)
    for (const m of info.primary) if (m in vol) vol[m] += 1
    for (const m of info.secondary) if (m in vol) vol[m] += 0.5
  }
  return vol
}
export function quickLogSets(q: QuickLog[]) {
  return q.flatMap((x) => Array.from({ length: x.sets }, () => ({ exercise_name: x.exercise_name, set_type: 'normal' as const, done: true })))
}

/** Erholung je Muskel: 0 (gerade trainiert) … 1 (erholt). ~72 h für volle Erholung, mehr Sätze → länger */
export function muscleRecovery(workouts: Workout[], sets: WorkoutSet[], now = Date.now()) {
  const wById = new Map(workouts.map((w) => [w.id, w]))
  const load: Partial<Record<Muscle, { at: number; sets: number }>> = {}
  for (const s of sets) {
    if (!isWorkingSet(s)) continue
    const w = wById.get(s.workout_id)
    if (!w) continue
    const t = new Date(w.ended_at ?? w.started_at).getTime()
    if (now - t > 5 * 864e5) continue
    const info = exerciseInfo(s.exercise_name)
    for (const [m, f] of [...info.primary.map((m) => [m, 1] as const), ...info.secondary.map((m) => [m, 0.5] as const)]) {
      const cur = load[m]
      if (!cur || t > cur.at + 6 * 3600e3) load[m] = { at: Math.max(t, cur?.at ?? 0), sets: (cur && Math.abs(cur.at - t) < 6 * 3600e3 ? cur.sets : 0) + f }
      else cur.sets += f
    }
  }
  const out = {} as Record<Muscle, { recovery: number; lastAt: number | null }>
  for (const m of MUSCLES) {
    const l = load[m.id]
    if (!l) {
      out[m.id] = { recovery: 1, lastAt: null }
      continue
    }
    const need = (36 + Math.min(l.sets, 12) * 4) * 3600e3
    out[m.id] = { recovery: Math.min(1, (now - l.at) / need), lastAt: l.at }
  }
  return out
}

// ── Streaks ────────────────────────────────────────────────────────
const trainedDays = (workouts: Workout[]) => new Set(workouts.map((w) => isoDate(new Date(w.started_at))))

/** Wochen in Folge mit ≥ threshold Trainings (aktuelle Woche zählt, wenn erreicht, bricht aber nicht) */
export function weekStreak(workouts: Workout[], threshold: number) {
  const counts = new Map<string, number>()
  for (const w of workouts) {
    const k = isoDate(startOfWeek(new Date(w.started_at)))
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  let streak = 0
  let wk = startOfWeek()
  if ((counts.get(isoDate(wk)) ?? 0) >= threshold) streak++
  wk = addDays(wk, -7)
  while ((counts.get(isoDate(wk)) ?? 0) >= threshold) {
    streak++
    wk = addDays(wk, -7)
  }
  return streak
}

/** Geplante Trainingstage in Folge erledigt; bis zu `grace` verpasste Tage werden toleriert (wie v1) */
export function plannedDayStreak(workouts: Workout[], plan: WeekPlanDay[], grace = 2) {
  const plannedWd = new Set(plan.filter((p) => p.routine_ids.length).map((p) => p.weekday))
  if (!plannedWd.size) return 0
  const done = trainedDays(workouts)
  let streak = 0
  let missed = 0
  let d = new Date()
  const today = isoDate(d)
  for (let i = 0; i < 400; i++) {
    const key = isoDate(d)
    if (done.has(key)) streak++
    else if (plannedWd.has(weekdayOf(d)) && key !== today) {
      missed++
      if (missed > grace) break
    }
    d = addDays(d, -1)
  }
  return streak
}

export function dayStreak(workouts: Workout[]) {
  const done = trainedDays(workouts)
  let d = new Date()
  if (!done.has(isoDate(d))) d = addDays(d, -1)
  let n = 0
  while (done.has(isoDate(d))) {
    n++
    d = addDays(d, -1)
  }
  return n
}

export function workoutVolume(sets: WorkoutSet[]) {
  return sets.filter(isWorkingSet).reduce((a, s) => a + s.weight * s.reps, 0)
}
