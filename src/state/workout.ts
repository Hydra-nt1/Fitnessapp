import { useSyncExternalStore } from 'react'
import { db, uid } from '../lib/db'
import { queryClient } from '../lib/api'
import type { SetType, Workout, WorkoutSet } from '../lib/types'

export interface ActiveSet {
  id: string
  weight: number
  reps: number
  rpe: number | null
  type: SetType
  done: boolean
}
export interface ActiveExercise {
  key: string
  name: string
  routineExerciseId: string | null
  note: string
  supersetGroup: string | null
  restSeconds: number | null
  target: { repsMin: number; repsMax: number; weight: number } | null
  sets: ActiveSet[]
}
export interface ActiveWorkout {
  id: string
  routineId: string | null
  name: string
  kind: 'full' | 'attendance'
  startedAt: number
  exercises: ActiveExercise[]
}
export interface RestTimer {
  endsAt: number
  total: number
}

// ── tiny persisted store ────────────────────────────────────────────
function persisted<T>(key: string, initial: T) {
  let value: T = initial
  try {
    const raw = localStorage.getItem(key)
    if (raw) value = JSON.parse(raw)
  } catch {
    /* ignore */
  }
  const subs = new Set<() => void>()
  return {
    get: () => value,
    set(next: T | ((v: T) => T)) {
      value = typeof next === 'function' ? (next as (v: T) => T)(value) : next
      try {
        if (value == null) localStorage.removeItem(key)
        else localStorage.setItem(key, JSON.stringify(value))
      } catch {
        /* ignore */
      }
      subs.forEach((f) => f())
    },
    subscribe(f: () => void) {
      subs.add(f)
      return () => subs.delete(f)
    },
  }
}

export const activeStore = persisted<ActiveWorkout | null>('ft_active', null)
export const restStore = persisted<RestTimer | null>('ft_rest', null)
const pendingStore = persisted<{ workout: Workout; sets: WorkoutSet[] }[]>('ft_pending', [])

export const useActive = () => useSyncExternalStore(activeStore.subscribe, activeStore.get)
export const useRest = () => useSyncExternalStore(restStore.subscribe, restStore.get)
export const usePendingCount = () => useSyncExternalStore(pendingStore.subscribe, () => pendingStore.get().length)

export const newSet = (p: Partial<ActiveSet> = {}): ActiveSet => ({ id: uid(), weight: 0, reps: 0, rpe: null, type: 'normal', done: false, ...p })

export function updateActive(fn: (w: ActiveWorkout) => ActiveWorkout | void) {
  activeStore.set((w) => {
    if (!w) return w
    const copy: ActiveWorkout = structuredClone(w)
    return fn(copy) ?? copy
  })
}

// ── Rest timer with beep + vibration ────────────────────────────────
let audioCtx: AudioContext | null = null
function beep() {
  try {
    audioCtx ??= new AudioContext()
    const ctx = audioCtx
    ;[0, 0.25, 0.5].forEach((t, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = i === 2 ? 1100 : 880
      g.gain.setValueAtTime(0.25, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + t)
      o.stop(ctx.currentTime + t + 0.2)
    })
  } catch {
    /* ignore */
  }
  navigator.vibrate?.([200, 100, 200])
}
export function startRest(seconds: number) {
  if (seconds <= 0) return
  try {
    audioCtx ??= new AudioContext() // unlock on user gesture
  } catch {
    /* ignore */
  }
  restStore.set({ endsAt: Date.now() + seconds * 1000, total: seconds })
}
export function adjustRest(delta: number) {
  restStore.set((r) => (r ? { endsAt: r.endsAt + delta * 1000, total: Math.max(5, r.total + delta) } : r))
}
export const stopRest = () => restStore.set(null)
setInterval(() => {
  const r = restStore.get()
  if (r && Date.now() >= r.endsAt) {
    restStore.set(null)
    beep()
  }
}, 500)

// ── Wake lock während des Trainings ─────────────────────────────────
let wakeLock: { release(): Promise<void> } | null = null
export async function syncWakeLock() {
  const want = !!activeStore.get() && document.visibilityState === 'visible'
  try {
    if (want && !wakeLock) wakeLock = await (navigator as any).wakeLock?.request('screen')
    if (!want && wakeLock) {
      await wakeLock.release()
      wakeLock = null
    }
  } catch {
    wakeLock = null
  }
}
document.addEventListener('visibilitychange', () => {
  wakeLock = null
  syncWakeLock()
})
activeStore.subscribe(syncWakeLock)

// ── Speichern mit Offline-Warteschlange ─────────────────────────────
export async function flushPending() {
  const queue = pendingStore.get()
  if (!queue.length) return
  const left: typeof queue = []
  for (const item of queue) {
    try {
      await db().upsert('workouts', item.workout)
      await db().upsert('workout_sets', item.sets)
    } catch {
      left.push(item)
    }
  }
  pendingStore.set(left)
  queryClient.invalidateQueries({ queryKey: ['workouts'] })
  queryClient.invalidateQueries({ queryKey: ['workout_sets'] })
}
window.addEventListener('online', () => flushPending())

export function buildRecords(w: ActiveWorkout, extra: { note?: string; rating?: number | null } = {}) {
  const end = Date.now()
  const workout: Workout = {
    id: w.id,
    routine_id: w.routineId,
    name: w.name,
    kind: w.kind,
    started_at: new Date(w.startedAt).toISOString(),
    ended_at: new Date(end).toISOString(),
    duration_s: Math.round((end - w.startedAt) / 1000),
    rating: extra.rating ?? null,
    note: extra.note || null,
  }
  const sets: WorkoutSet[] = []
  w.exercises.forEach((ex, pos) => {
    let n = 0
    for (const s of ex.sets) {
      if (!s.done) continue
      sets.push({
        id: s.id,
        workout_id: w.id,
        exercise_name: ex.name,
        exercise_position: pos,
        set_number: ++n,
        set_type: s.type,
        weight: s.weight || 0,
        reps: s.reps || 0,
        rpe: s.rpe,
        done: true,
        superset_group: ex.supersetGroup,
        note: null,
      })
    }
  })
  return { workout, sets }
}

/** Speichert lokal-optimistisch und synchronisiert; bei Fehler landet es in der Warteschlange. */
export async function persistWorkout(workout: Workout, sets: WorkoutSet[]) {
  queryClient.setQueryData<Workout[]>(['workouts'], (old = []) => [...old.filter((x) => x.id !== workout.id), workout])
  queryClient.setQueryData<WorkoutSet[]>(['workout_sets'], (old = []) => [...old.filter((x) => x.workout_id !== workout.id), ...sets])
  pendingStore.set((q) => [...q.filter((x) => x.workout.id !== workout.id), { workout, sets }])
  await flushPending()
}
