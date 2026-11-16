import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { TableMap, TableName } from './types'

// Publishable key — designed to be public; access is protected by Row Level Security.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lambfcrvsvejmrabjspo.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_VlcBmspTvDsI2Rh4OaR2RA_zbI2UA9E'

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
})

/** Demo mode: everything lives in localStorage, no account needed. Enabled via ?demo or the login screen. */
export const isDemo = () => {
  try {
    return localStorage.getItem('ft_demo') === '1'
  } catch {
    return false
  }
}

const PK: Partial<Record<TableName, string[]>> = {
  app_settings: ['user_id'],
  week_plan: ['weekday'],
}
const keyOf = (t: TableName) => PK[t] ?? ['id']

export interface DataAdapter {
  list<T extends TableName>(table: T): Promise<TableMap[T][]>
  upsert<T extends TableName>(table: T, rows: Partial<TableMap[T]> | Partial<TableMap[T]>[]): Promise<void>
  remove<T extends TableName>(table: T, match: Record<string, unknown>): Promise<void>
  removeIn<T extends TableName>(table: T, column: string, values: string[]): Promise<void>
}

const supabaseAdapter: DataAdapter = {
  async list(table) {
    const pageSize = 1000
    const out: any[] = []
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase.from(table).select('*').range(from, from + pageSize - 1)
      if (error) throw error
      out.push(...(data ?? []))
      if (!data || data.length < pageSize) break
    }
    return out
  },
  async upsert(table, rows) {
    const arr = Array.isArray(rows) ? rows : [rows]
    if (!arr.length) return
    for (let i = 0; i < arr.length; i += 500) {
      const { error } = await supabase.from(table).upsert(arr.slice(i, i + 500) as any, { onConflict: table === 'week_plan' ? 'user_id,weekday' : keyOf(table).join(',') })
      if (error) throw error
    }
  },
  async remove(table, match) {
    const { error } = await supabase.from(table).delete().match(match)
    if (error) throw error
  },
  async removeIn(table, column, values) {
    if (!values.length) return
    const { error } = await supabase.from(table).delete().in(column, values)
    if (error) throw error
  },
}

// ── Local adapter (demo mode) ─────────────────────────────────────
const LS = 'ft_demo_db_'
const read = (t: string): any[] => {
  try {
    return JSON.parse(localStorage.getItem(LS + t) || '[]')
  } catch {
    return []
  }
}
const write = (t: string, rows: any[]) => localStorage.setItem(LS + t, JSON.stringify(rows))
const CASCADE: Partial<Record<TableName, [TableName, string][]>> = {
  routines: [['routine_exercises', 'routine_id']],
  workouts: [['workout_sets', 'workout_id']],
  routine_exercises: [['quick_logs', 'routine_exercise_id']],
}

const localAdapter: DataAdapter = {
  async list(table) {
    return read(table) as any
  },
  async upsert(table, rows) {
    const arr = (Array.isArray(rows) ? rows : [rows]) as any[]
    const all = read(table)
    const keys = keyOf(table)
    for (const r of arr) {
      if (keys[0] === 'id' && !r.id) r.id = crypto.randomUUID()
      const idx = all.findIndex((x) => keys.every((k) => x[k] === r[k]))
      if (idx >= 0) all[idx] = { ...all[idx], ...r }
      else all.push(r)
    }
    write(table, all)
  },
  async remove(table, match) {
    const all = read(table)
    const hit = (x: any) => Object.entries(match).every(([k, v]) => x[k] === v)
    const removed = all.filter(hit)
    write(table, all.filter((x) => !hit(x)))
    for (const [child, col] of CASCADE[table] ?? []) {
      await localAdapter.removeIn(child, col, removed.map((r) => r.id))
    }
  },
  async removeIn(table, column, values) {
    const set = new Set(values)
    const all = read(table)
    const removed = all.filter((x) => set.has(x[column]))
    write(table, all.filter((x) => !set.has(x[column])))
    for (const [child, col] of CASCADE[table] ?? []) {
      await localAdapter.removeIn(child, col, removed.map((r) => r.id))
    }
  },
}

export const db = (): DataAdapter => (isDemo() ? localAdapter : supabaseAdapter)
export const uid = () => crypto.randomUUID()
