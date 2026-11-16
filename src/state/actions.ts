import { queryClient } from '../lib/api'
import { uid } from '../lib/db'
import { exerciseHistory, suggestNext } from '../lib/training'
import { DEFAULT_SETTINGS, type AppSettings, type QuickLog, type Routine, type RoutineExercise, type Workout, type WorkoutSet } from '../lib/types'
import { activeStore, newSet, type ActiveExercise, type ActiveWorkout } from './workout'

const get = <T,>(k: string) => (queryClient.getQueryData<T[]>([k]) ?? []) as T[]
const settings = (): AppSettings => ({ ...DEFAULT_SETTINGS, ...(get<AppSettings>('app_settings')[0] ?? {}) })

export function historyFor(name: string) {
  return exerciseHistory(name, get<Workout>('workouts'), get<WorkoutSet>('workout_sets'), get<QuickLog>('quick_logs'))
}

export function buildExercise(name: string, re?: RoutineExercise | null): ActiveExercise {
  const hist = historyFor(name)
  const s = settings()
  const target = re ? { repsMin: re.reps_min, repsMax: re.reps_max, weight: +re.weight } : null
  const sugg = suggestNext(re ?? null, hist, s.weight_increment)
  const last = hist[0]
  const n = re?.sets ?? Math.max(3, last?.sets.length ?? 3)
  const sets = Array.from({ length: n }, (_, i) => {
    const prev = last?.sets[i]
    // Vorschlag gilt für alle Arbeitssätze; ohne Vorschlag letzter Wert
    const weight = sugg.trend === 'new' ? prev?.weight ?? target?.weight ?? 0 : sugg.weight
    const reps = sugg.trend === 'new' ? prev?.reps ?? target?.repsMin ?? 10 : sugg.reps
    return newSet({ weight, reps })
  })
  return {
    key: uid(),
    name,
    routineExerciseId: re?.id ?? null,
    note: re?.note ?? '',
    supersetGroup: re?.superset_group ?? null,
    restSeconds: re?.rest_seconds ?? null,
    target,
    sets,
  }
}

export function startRoutineWorkout(routineId: string | null, kind: 'full' | 'attendance' = 'full') {
  if (activeStore.get()) return false
  const routine = routineId ? get<Routine>('routines').find((r) => r.id === routineId) : null
  const exs = routineId
    ? get<RoutineExercise>('routine_exercises')
        .filter((e) => e.routine_id === routineId)
        .sort((a, b) => a.position - b.position)
    : []
  const w: ActiveWorkout = {
    id: uid(),
    routineId: routine?.id ?? null,
    name: routine?.name ?? (kind === 'attendance' ? 'Training' : 'Freies Workout'),
    kind,
    startedAt: Date.now(),
    exercises: kind === 'full' ? exs.map((e) => buildExercise(e.exercise_name, e)) : [],
  }
  activeStore.set(w)
  return true
}

/** Wiederholt ein früheres Workout mit denselben Übungen */
export function repeatWorkout(workoutId: string) {
  if (activeStore.get()) return false
  const w = get<Workout>('workouts').find((x) => x.id === workoutId)
  if (!w) return false
  const names: string[] = []
  for (const s of get<WorkoutSet>('workout_sets')
    .filter((s) => s.workout_id === workoutId)
    .sort((a, b) => a.exercise_position - b.exercise_position || a.set_number - b.set_number))
    if (!names.includes(s.exercise_name)) names.push(s.exercise_name)
  const res = get<RoutineExercise>('routine_exercises').filter((e) => e.routine_id === w.routine_id)
  activeStore.set({
    id: uid(),
    routineId: w.routine_id,
    name: w.name,
    kind: 'full',
    startedAt: Date.now(),
    exercises: names.map((n) => buildExercise(n, res.find((r) => r.exercise_name === n))),
  })
  return true
}
