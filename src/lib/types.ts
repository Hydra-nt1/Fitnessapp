export type SetType = 'warmup' | 'normal' | 'drop' | 'failure'

export interface AppSettings {
  user_id?: string
  display_name: string | null
  birthday: string | null
  sex: string | null
  height_cm: number | null
  goal_weight: number | null
  goal: string | null
  level: string | null
  days_per_week: number | null
  equipment: string | null
  theme: 'dark' | 'light'
  accent: string
  rest_seconds: number
  weight_increment: number
  bar_weight: number
  streak_threshold: number
  hidden_exercises: string[]
  legacy_imported_at: string | null
  updated_at?: string
}

export interface CustomExercise {
  id: string
  name: string
  muscle_group: string
  primary_muscles: string[]
  secondary_muscles: string[]
  created_at?: string
}

export interface Routine {
  id: string
  name: string
  muscle_group: string | null
  color: string | null
  position: number
  archived: boolean
  created_at?: string
}

export interface RoutineExercise {
  id: string
  routine_id: string
  exercise_name: string
  position: number
  sets: number
  reps_min: number
  reps_max: number
  weight: number
  rest_seconds: number | null
  superset_group: string | null
  note: string | null
}

export interface WeekPlanDay {
  weekday: number // 0 = Montag
  routine_ids: string[]
}

export interface Workout {
  id: string
  routine_id: string | null
  name: string
  kind: 'full' | 'attendance'
  started_at: string
  ended_at: string | null
  duration_s: number | null
  rating: number | null
  note: string | null
}

export interface WorkoutSet {
  id: string
  workout_id: string
  exercise_name: string
  exercise_position: number
  set_number: number
  set_type: SetType
  weight: number
  reps: number
  rpe: number | null
  done: boolean
  superset_group: string | null
  note: string | null
}

export interface QuickLog {
  id: string
  routine_exercise_id: string | null
  exercise_name: string
  week_start: string // YYYY-MM-DD (Montag)
  sets: number
  reps: number
  weight: number
}

export interface BodyMetric {
  id: string
  measured_at: string
  weight: number | null
  body_fat: number | null
  chest: number | null
  waist: number | null
  hips: number | null
  arms: number | null
  thighs: number | null
  note: string | null
}

export interface TableMap {
  app_settings: AppSettings
  custom_exercises: CustomExercise
  routines: Routine
  routine_exercises: RoutineExercise
  week_plan: WeekPlanDay
  workouts: Workout
  workout_sets: WorkoutSet
  quick_logs: QuickLog
  body_metrics: BodyMetric
}
export type TableName = keyof TableMap

export const DEFAULT_SETTINGS: AppSettings = {
  display_name: null,
  birthday: null,
  sex: null,
  height_cm: null,
  goal_weight: null,
  goal: null,
  level: null,
  days_per_week: null,
  equipment: null,
  theme: 'dark',
  accent: '#c8ff2e',
  rest_seconds: 90,
  weight_increment: 2.5,
  bar_weight: 20,
  streak_threshold: 3,
  hidden_exercises: [],
  legacy_imported_at: null,
}
