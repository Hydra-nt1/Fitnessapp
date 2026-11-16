import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query'
import { db, uid } from './db'
import { DEFAULT_SETTINGS, type AppSettings, type TableMap, type TableName } from './types'
import { setCustomCache } from '../data/exercises'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, gcTime: 1000 * 60 * 60 * 24 * 7, networkMode: 'offlineFirst', retry: 1 },
    mutations: { networkMode: 'offlineFirst' },
  },
})

export function useTable<T extends TableName>(table: T) {
  return useQuery({
    queryKey: [table],
    queryFn: async () => {
      const rows = await db().list(table)
      if (table === 'custom_exercises') setCustomCache(rows as any)
      return rows
    },
  })
}
/** Convenience: returns rows (empty array while loading) */
export function useRows<T extends TableName>(table: T): TableMap[T][] {
  return useTable(table).data ?? (EMPTY as TableMap[T][])
}
const EMPTY: never[] = []

export function useSettings(): AppSettings {
  const rows = useRows('app_settings')
  return { ...DEFAULT_SETTINGS, ...(rows[0] ?? {}) }
}

/** Optimistic write helpers: update cache immediately, persist, then refetch. */
export async function save<T extends TableName>(table: T, rows: Partial<TableMap[T]> | Partial<TableMap[T]>[]) {
  const arr = (Array.isArray(rows) ? rows : [rows]).map((r) =>
    table === 'app_settings' || table === 'week_plan' || (r as any).id ? r : { ...r, id: uid() },
  )
  const key = table === 'app_settings' ? null : table === 'week_plan' ? 'weekday' : 'id'
  queryClient.setQueryData<any[]>([table], (old = []) => {
    if (!key) return [{ ...(old[0] ?? {}), ...arr[0] }]
    const next = [...old]
    for (const r of arr as any[]) {
      const i = next.findIndex((x) => x[key] === r[key])
      if (i >= 0) next[i] = { ...next[i], ...r }
      else next.push(r)
    }
    return next
  })
  try {
    await db().upsert(table, arr as any)
  } finally {
    queryClient.invalidateQueries({ queryKey: [table] })
  }
  return arr as TableMap[T][]
}

export async function remove<T extends TableName>(table: T, id: string, cascade: TableName[] = []) {
  queryClient.setQueryData<any[]>([table], (old = []) => old.filter((x) => x.id !== id))
  try {
    await db().remove(table, { id })
  } finally {
    for (const t of [table, ...cascade]) queryClient.invalidateQueries({ queryKey: [t] })
  }
}

export async function saveSettings(patch: Partial<AppSettings>) {
  const cur = queryClient.getQueryData<AppSettings[]>(['app_settings'])?.[0]
  await save('app_settings', { ...(cur ?? {}), ...patch, updated_at: new Date().toISOString() } as any)
}

export function useInvalidateAll() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries()
}
