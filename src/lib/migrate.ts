// Übernimmt die Daten der alten App (v1: JSON-Blob in public.profiles.data) in die neuen Tabellen.
import { db, supabase } from './db'
import { isoDate, startOfWeek } from './date'
import type { AppSettings, BodyMetric, CustomExercise, QuickLog, Routine, RoutineExercise, WeekPlanDay, Workout, WorkoutSet } from './types'

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const num = (v: unknown) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v))
const iso = (ms: unknown) => new Date(Number(ms) || Date.now()).toISOString()

export interface LegacyBackup {
  profile?: string
  theme?: string
  plans?: any[]
  planExercises?: any[]
  workoutSessions?: any[]
  workoutSets?: any[]
  bodyStats?: any[]
  weekPlan?: any[]
  customExercises?: any[]
  weekExercises?: any[]
}

/** Deterministische UUID aus Text (2× FNV-1a 64 Bit) → gleiche alte Daten ergeben gleiche IDs. */
function stableId(text: string) {
  let h1 = 0xcbf29ce484222325n
  let h2 = 0x84222325cbf29ce4n
  const P = 0x100000001b3n
  const M = (1n << 64n) - 1n
  for (let i = 0; i < text.length; i++) {
    const c = BigInt(text.charCodeAt(i))
    h1 = ((h1 ^ c) * P) & M
    h2 = ((h2 ^ (c + 31n)) * P) & M
  }
  const hex = (h1.toString(16).padStart(16, '0') + h2.toString(16).padStart(16, '0')).split('')
  hex[12] = '4'
  hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16)
  const h = hex.join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

export function transformLegacy(b: LegacyBackup, seed = '') {
  const sid = (kind: string, key: unknown) => stableId(`${seed}|${kind}|${String(key)}`)
  let p: any = {}
  try {
    p = JSON.parse(b.profile || '{}')
  } catch {
    /* ignore */
  }
  const settings: Partial<AppSettings> = {
    display_name: p.name || null,
    birthday: p.birthday || null,
    height_cm: num(p.height),
    goal_weight: num(p.goalWeight),
    goal: p.goal || null,
    level: p.level || null,
    days_per_week: num(p.daysPerWeek),
    equipment: p.equipment || null,
    theme: b.theme === 'light' ? 'light' : 'dark',
  }
  try {
    const acc = localStorage.getItem('fittracker_accent')
    if (acc) settings.accent = acc
    const rest = localStorage.getItem('restSecs')
    if (rest) settings.rest_seconds = Number(rest) || 90
  } catch {
    /* ignore */
  }

  const routineId = new Map<number, string>()
  const routines: Routine[] = (b.plans ?? []).map((pl, i) => {
    const id = sid('plan', pl.id)
    routineId.set(pl.id, id)
    return { id, name: pl.name || 'Plan', muscle_group: pl.muscleGroup || null, color: null, position: i, archived: false }
  })

  const reId = new Map<number, string>()
  const routineExercises: RoutineExercise[] = []
  const byPlan = new Map<number, any[]>()
  for (const pe of b.planExercises ?? []) {
    if (!routineId.has(pe.planId)) continue
    if (!byPlan.has(pe.planId)) byPlan.set(pe.planId, [])
    byPlan.get(pe.planId)!.push(pe)
  }
  for (const [planId, list] of byPlan) {
    list.sort((a, c) => (a.order ?? a.id) - (c.order ?? c.id))
    list.forEach((pe, i) => {
      const id = sid('planEx', pe.id)
      reId.set(pe.id, id)
      const reps = Number(pe.reps) || 10
      routineExercises.push({
        id,
        routine_id: routineId.get(planId)!,
        exercise_name: pe.name,
        position: i,
        sets: Number(pe.sets) || 3,
        reps_min: Math.max(1, reps - 2),
        reps_max: reps + 2,
        weight: Number(pe.weight) || 0,
        rest_seconds: null,
        superset_group: null,
        note: pe.note || null,
      })
    })
  }

  const weekPlan: WeekPlanDay[] = (b.weekPlan ?? [])
    .map((e) => {
      const weekday = DAY_KEYS.indexOf(e.day)
      const ids: number[] = e.planIds ?? (e.planId != null ? [e.planId] : [])
      return { weekday, routine_ids: ids.map((x) => routineId.get(x)).filter((x): x is string => !!x) }
    })
    .filter((e) => e.weekday >= 0)

  const workoutId = new Map<number, string>()
  const workouts: Workout[] = []
  for (const s of b.workoutSessions ?? []) {
    if (!s.completed && !s.completedAt) continue
    const id = sid('session', s.id)
    workoutId.set(s.id, id)
    workouts.push({
      id,
      routine_id: s.planId != null ? routineId.get(s.planId) ?? null : null,
      name: s.planName || 'Workout',
      kind: s.attendanceOnly ? 'attendance' : 'full',
      started_at: iso(s.startedAt),
      ended_at: s.completedAt ? iso(s.completedAt) : null,
      duration_s: Number(s.duration) || null,
      rating: null,
      note: null,
    })
  }

  const sets: WorkoutSet[] = []
  const posMap = new Map<string, Map<string, number>>()
  for (const st of [...(b.workoutSets ?? [])].sort((a, c) => a.id - c.id)) {
    const wid = workoutId.get(st.sessionId)
    if (!wid) continue
    if (!posMap.has(wid)) posMap.set(wid, new Map())
    const pm = posMap.get(wid)!
    if (!pm.has(st.exerciseName)) pm.set(st.exerciseName, pm.size)
    sets.push({
      id: sid('set', st.id ?? `${st.sessionId}-${st.exerciseName}-${st.setNumber}`),
      workout_id: wid,
      exercise_name: st.exerciseName,
      exercise_position: pm.get(st.exerciseName)!,
      set_number: Number(st.setNumber) || 1,
      set_type: 'normal',
      weight: Number(st.weight) || 0,
      reps: Number(st.reps) || 0,
      rpe: null,
      done: st.done !== false,
      superset_group: null,
      note: null,
    })
  }

  const bodyMetrics: BodyMetric[] = (b.bodyStats ?? []).map((m) => ({
    id: sid('body', m.id ?? m.date),
    measured_at: iso(m.date),
    weight: num(m.weight),
    body_fat: num(m.bodyFat),
    chest: num(m.chest),
    waist: num(m.waist),
    hips: num(m.hips),
    arms: num(m.arms),
    thighs: null,
    note: null,
  }))

  const seenCustom = new Set<string>()
  const customExercises: CustomExercise[] = (b.customExercises ?? [])
    .filter((c) => c.name && !seenCustom.has(c.name) && seenCustom.add(c.name))
    .map((c) => ({ id: sid('custom', c.name), name: c.name, muscle_group: c.muscleGroup || 'Sonstige', primary_muscles: [], secondary_muscles: [] }))

  const reName = new Map(routineExercises.map((r) => [r.id, r.exercise_name]))
  const quickMap = new Map<string, QuickLog>()
  for (const we of b.weekExercises ?? []) {
    const rid = reId.get(we.planExerciseId)
    if (!rid) continue
    const week = isoDate(startOfWeek(new Date(Number(we.weekStart))))
    quickMap.set(`${rid}|${week}`, {
      id: sid('quick', `${rid}|${week}`),
      routine_exercise_id: rid,
      exercise_name: reName.get(rid)!,
      week_start: week,
      sets: Number(we.sets) || 3,
      reps: Number(we.reps) || 10,
      weight: Number(we.weight) || 0,
    })
  }
  // Letzten Schnell-Log-Stand als aktuelles Planziel übernehmen
  for (const q of quickMap.values()) {
    const re = routineExercises.find((r) => r.id === q.routine_exercise_id)!
    const latest = [...quickMap.values()].filter((x) => x.routine_exercise_id === re.id).sort((a, c) => c.week_start.localeCompare(a.week_start))[0]
    if (latest === q) {
      re.sets = q.sets
      re.weight = q.weight
      re.reps_min = Math.max(1, q.reps - 2)
      re.reps_max = q.reps + 2
    }
  }

  return { settings, routines, routineExercises, weekPlan, workouts, sets, bodyMetrics, customExercises, quickLogs: [...quickMap.values()] }
}

export type LegacyResult = { imported: boolean; counts?: Record<string, number> }

/** Läuft einmal pro Konto: legacy_imported_at in app_settings verhindert doppelten Import. */
const running = new Map<string, Promise<LegacyResult>>()
export function migrateLegacyIfNeeded(userId: string): Promise<LegacyResult> {
  if (!running.has(userId)) running.set(userId, doMigrate(userId).finally(() => setTimeout(() => running.delete(userId), 5000)))
  return running.get(userId)!
}
async function doMigrate(userId: string): Promise<LegacyResult> {
  const { data: settings } = await supabase.from('app_settings').select('legacy_imported_at').eq('user_id', userId).maybeSingle()
  if (settings?.legacy_imported_at) return { imported: false }

  const { data: legacy, error } = await supabase.from('profiles').select('data').eq('id', userId).maybeSingle()
  const now = new Date().toISOString()
  if (error || !legacy?.data) {
    await supabase.from('app_settings').upsert({ user_id: userId, legacy_imported_at: now })
    return { imported: false }
  }
  const t = transformLegacy(legacy.data as LegacyBackup, userId)
  const a = db()
  await a.upsert('custom_exercises', t.customExercises)
  await a.upsert('routines', t.routines)
  await a.upsert('routine_exercises', t.routineExercises)
  await a.upsert('week_plan', t.weekPlan)
  await a.upsert('workouts', t.workouts)
  await a.upsert('workout_sets', t.sets)
  await a.upsert('quick_logs', t.quickLogs)
  await a.upsert('body_metrics', t.bodyMetrics)
  await supabase.from('app_settings').upsert({ user_id: userId, ...t.settings, legacy_imported_at: now })
  return {
    imported: true,
    counts: { Pläne: t.routines.length, Workouts: t.workouts.length, Sätze: t.sets.length, Körperdaten: t.bodyMetrics.length },
  }
}
