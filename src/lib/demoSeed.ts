// Erzeugt Beispieldaten im alten v1-Format und schickt sie durch die echte Migrationslogik.
import { db } from './db'
import { transformLegacy, type LegacyBackup } from './migrate'
import { addDays, startOfWeek } from './date'

let seeding: Promise<void> | null = null
export function seedDemoIfEmpty() {
  return (seeding ??= doSeed())
}
async function doSeed() {
  const a = db()
  if ((await a.list('routines')).length || (await a.list('app_settings')).length) return
  const plans = [
    { id: 1, name: 'Push Day', muscleGroup: 'Brust' },
    { id: 2, name: 'Pull Day', muscleGroup: 'Rücken' },
    { id: 3, name: 'Beine', muscleGroup: 'Beine' },
  ]
  const pe = [
    [1, 'Bankdrücken (Flachbank)', 4, 8, 70],
    [1, 'Bankdrücken (Schrägbank oben)', 3, 10, 55],
    [1, 'Seitheben (Kurzhanteln)', 3, 15, 10],
    [1, 'Trizeps Pushdown (Seil)', 3, 12, 25],
    [2, 'Klimmzüge (weiter Griff)', 4, 8, 0],
    [2, 'Langhantel Rudern (Übergriff)', 4, 8, 60],
    [2, 'Latzug (weiter Griff)', 3, 10, 55],
    [2, 'Bizepscurls (Langhantel)', 3, 10, 30],
    [3, 'Kniebeugen (Langhantel, high bar)', 4, 6, 90],
    [3, 'Beinpresse', 3, 10, 160],
    [3, 'Rumänisches Kreuzheben', 3, 10, 70],
    [3, 'Wadenheben stehend (Maschine)', 4, 12, 60],
  ].map(([planId, name, sets, reps, weight], i) => ({ id: i + 1, planId, name, sets, reps, weight, order: i, note: i === 9 ? 'Sitz Position 4' : undefined }))
  const sessions: any[] = []
  const sets: any[] = []
  const weekExercises: any[] = []
  let sid = 1
  let setId = 1
  const start = startOfWeek(new Date(), -7)
  for (let w = 0; w < 8; w++) {
    ;[0, 2, 4].forEach((dayOff, k) => {
      const day = addDays(start, w * 7 + dayOff)
      day.setHours(7, 30)
      if (day > new Date() || (w === 3 && k === 2)) return
      const plan = plans[k]
      if (w % 3 === 1 && k === 1) {
        // Check-in ohne Sätze + Schnell-Log wie in v1
        sessions.push({ id: sid++, planId: plan.id, planName: plan.name, startedAt: +day, completedAt: +day + 3600e3, duration: 3600, completed: true, attendanceOnly: true })
        pe.filter((p) => p.planId === plan.id).forEach((p) => weekExercises.push({ planExerciseId: p.id, weekStart: +startOfWeek(day), sets: p.sets, reps: p.reps, weight: (p.weight as number) + Math.floor(w / 2) * 2.5 }))
        return
      }
      const id = sid++
      sessions.push({ id, planId: plan.id, planName: plan.name, startedAt: +day, completedAt: +day + 3900e3, duration: 3900 + k * 300, completed: true })
      for (const p of pe.filter((p) => p.planId === plan.id)) {
        for (let i = 0; i < (p.sets as number); i++) {
          const wt = (p.weight as number) ? (p.weight as number) + Math.floor(w / 2) * 2.5 : 0
          sets.push({ id: setId++, sessionId: id, exerciseName: p.name, setNumber: i + 1, reps: (p.reps as number) + (w % 2) - (i === 3 ? 1 : 0), weight: wt, done: true })
        }
      }
    })
  }
  const bodyStats = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, date: +addDays(start, i * 7 + 1), weight: 84.6 - i * 0.35 + (i % 2) * 0.2 })).filter((b) => b.date < Date.now())
  bodyStats.push({ id: 99, date: +addDays(start, 2), chest: 104, waist: 86, arms: 38, hips: 100 } as any)
  const legacy: LegacyBackup = {
    profile: JSON.stringify({ name: 'Demo', height: 182, goalWeight: 80, goal: 'Muskelaufbau', level: 'Fortgeschritten', daysPerWeek: 3, equipment: 'Fitnessstudio' }),
    theme: 'dark',
    plans,
    planExercises: pe,
    workoutSessions: sessions,
    workoutSets: sets,
    bodyStats,
    weekPlan: [
      { day: 'monday', planIds: [1] },
      { day: 'wednesday', planIds: [2] },
      { day: 'friday', planId: 3 },
    ],
    customExercises: [{ id: 1, name: 'Hackenschmidt Kniebeuge', muscleGroup: 'Beine — Quadrizeps' }],
    weekExercises,
  }
  const t = transformLegacy(legacy)
  await a.upsert('custom_exercises', t.customExercises)
  await a.upsert('routines', t.routines)
  await a.upsert('routine_exercises', t.routineExercises)
  await a.upsert('week_plan', t.weekPlan)
  await a.upsert('workouts', t.workouts)
  await a.upsert('workout_sets', t.sets)
  await a.upsert('quick_logs', t.quickLogs)
  await a.upsert('body_metrics', t.bodyMetrics)
  await a.upsert('app_settings', { user_id: 'demo', ...t.settings, legacy_imported_at: new Date().toISOString() } as any)
}
