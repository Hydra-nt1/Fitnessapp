import { useEffect, useState } from 'react'
import { save, useRows } from '../lib/api'
import { isoDate, startOfWeek, weekLabel } from '../lib/date'
import { fmtKg } from '../lib/training'
import { Button, NumberStepper, Sheet, toast } from './ui'
import { Icon } from './icons'

type Row = { reId: string; name: string; sets: number; reps: number; weight: number; prev?: { sets: number; reps: number; weight: number } }

/** Schnell-Log: pro Übung einmal pro Woche Sätze × Wdh × kg festhalten (wie in v1). */
export function QuickLogSheet({ routineId, open, onClose, weekStart = startOfWeek() }: { routineId: string | null; open: boolean; onClose: () => void; weekStart?: Date }) {
  const routines = useRows('routines')
  const allRe = useRows('routine_exercises')
  const quick = useRows('quick_logs')
  const [rows, setRows] = useState<Row[]>([])
  const week = isoDate(weekStart)
  const routine = routines.find((r) => r.id === routineId)

  useEffect(() => {
    if (!open || !routineId) return
    const res = allRe.filter((e) => e.routine_id === routineId).sort((a, b) => a.position - b.position)
    setRows(
      res.map((re) => {
        const logs = quick.filter((q) => q.routine_exercise_id === re.id).sort((a, b) => b.week_start.localeCompare(a.week_start))
        const cur = logs.find((q) => q.week_start === week)
        const prev = logs.find((q) => q.week_start < week)
        const base = cur ?? prev
        return {
          reId: re.id,
          name: re.exercise_name,
          sets: base?.sets ?? re.sets,
          reps: base?.reps ?? re.reps_max,
          weight: base ? +base.weight : +re.weight,
          prev: prev ? { sets: prev.sets, reps: prev.reps, weight: +prev.weight } : undefined,
        }
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, routineId, week])

  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const submit = async () => {
    const existing = quick.filter((q) => q.week_start === week)
    await save(
      'quick_logs',
      rows.map((r) => ({
        id: existing.find((q) => q.routine_exercise_id === r.reId)?.id,
        routine_exercise_id: r.reId,
        exercise_name: r.name,
        week_start: week,
        sets: r.sets,
        reps: r.reps,
        weight: r.weight,
      })),
    )
    // Planziel mitziehen, damit die nächste Woche mit dem neuen Stand startet
    await save(
      'routine_exercises',
      rows.map((r) => ({ id: r.reId, weight: r.weight, sets: r.sets })),
    )
    toast('Schnell-Log gespeichert')
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <span>
          Schnell-Log <span className="text-muted font-medium text-sm">· {routine?.name} · {weekLabel(weekStart)}</span>
        </span>
      }
      wide
      footer={
        <Button className="flex-1" onClick={submit} disabled={!rows.length}>
          Speichern
        </Button>
      }
    >
      {!rows.length && <div className="text-muted text-sm py-6 text-center">Dieser Plan hat noch keine Übungen.</div>}
      <div className="flex flex-col gap-3">
        {rows.map((r, i) => {
          const diff = r.prev ? r.weight - r.prev.weight : 0
          return (
            <div key={r.reId} className="rounded-2xl bg-surface-2/60 border border-line p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="font-semibold flex-1 min-w-0 truncate">{r.name}</div>
                {r.prev && (
                  <span className="text-xs text-muted tabular">
                    zuletzt {r.prev.sets}×{r.prev.reps} · {fmtKg(r.prev.weight)} kg
                    {diff !== 0 && <span className={diff > 0 ? 'text-good ml-1' : 'text-bad ml-1'}>{diff > 0 ? <Icon name="arrowUp" size={11} className="inline" /> : <Icon name="arrowDown" size={11} className="inline" />}</span>}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <NumberStepper label="Sätze" value={r.sets} min={1} onChange={(v) => set(i, { sets: v })} />
                <NumberStepper label="Wdh." value={r.reps} min={1} onChange={(v) => set(i, { reps: v })} />
                <NumberStepper label="kg" value={r.weight} step={2.5} decimals onChange={(v) => set(i, { weight: v })} />
              </div>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}
