import { useMemo, useState } from 'react'
import { allExercises, GROUPS, groupColor, MUSCLE_LABEL, searchExercises } from '../data/exercises'
import { save, useRows, useSettings } from '../lib/api'
import { Button, Chip, Sheet, inputCls, cx } from './ui'
import { Icon } from './icons'

export function ExercisePicker({ open, onClose, onPick, multi, title = 'Übung hinzufügen', exclude = [] }: { open: boolean; onClose: () => void; onPick: (names: string[]) => void; multi?: boolean; title?: string; exclude?: string[] }) {
  const custom = useRows('custom_exercises')
  const settings = useSettings()
  const sets = useRows('workout_sets')
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<string | null>(null)
  const [sel, setSel] = useState<string[]>([])
  const list = useMemo(() => allExercises(custom, settings.hidden_exercises), [custom, settings.hidden_exercises])
  const usage = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of sets) m.set(s.exercise_name, (m.get(s.exercise_name) ?? 0) + 1)
    return m
  }, [sets])
  const ex = new Set(exclude)
  const results = useMemo(() => {
    let r = searchExercises(list, q)
    if (group) r = r.filter((e) => e.group === group)
    if (!q && !group) r = [...r].sort((a, b) => (usage.get(b.name) ?? 0) - (usage.get(a.name) ?? 0))
    return r.slice(0, 120)
  }, [list, q, group, usage])

  const close = () => {
    setSel([])
    setQ('')
    onClose()
  }
  const pick = (name: string) => {
    if (!multi) {
      onPick([name])
      close()
      return
    }
    setSel((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]))
  }
  const createCustom = async () => {
    const name = q.trim()
    if (!name) return
    await save('custom_exercises', { name, muscle_group: group ?? 'Sonstige', primary_muscles: [], secondary_muscles: [] })
    pick(name)
  }
  const exact = list.some((e) => e.name.toLowerCase() === q.trim().toLowerCase())

  return (
    <Sheet
      open={open}
      onClose={close}
      title={title}
      wide
      footer={
        multi ? (
          <Button className="flex-1" disabled={!sel.length} onClick={() => (onPick(sel), close())}>
            {sel.length ? `${sel.length} hinzufügen` : 'Übungen auswählen'}
          </Button>
        ) : undefined
      }
    >
      <div className="sticky top-0 bg-surface pb-2 z-10">
        <div className="relative">
          <Icon name="search" size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input autoFocus className={cx(inputCls, 'pl-10')} placeholder="Suchen, z. B. „schräg kurzhantel“" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-2.5 -mx-5 px-5">
          <Chip active={!group} onClick={() => setGroup(null)}>
            Alle
          </Chip>
          {GROUPS.map((g) => (
            <Chip key={g} active={group === g} color={groupColor(g)} onClick={() => setGroup(group === g ? null : g)}>
              {g}
            </Chip>
          ))}
        </div>
      </div>
      {q.trim() && !exact && (
        <button onClick={createCustom} className="w-full flex items-center gap-3 p-3 rounded-xl accent-soft text-accent-fg font-semibold text-sm mb-1">
          <Icon name="plus" size={18} /> „{q.trim()}“ als eigene Übung anlegen{group ? ` (${group})` : ''}
        </button>
      )}
      <div className="divide-y divide-line">
        {results.map((e) => {
          const on = sel.includes(e.name)
          const used = usage.get(e.name)
          const disabled = ex.has(e.name)
          return (
            <button key={e.name} disabled={disabled} onClick={() => pick(e.name)} className={cx('w-full flex items-center gap-3 py-2.5 text-left disabled:opacity-35', on && 'text-accent-fg')}>
              <span className="w-1.5 h-9 rounded-full shrink-0" style={{ background: groupColor(e.group) }} />
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold truncate">{e.name}</span>
                <span className="block text-xs text-muted truncate">
                  {e.primary.map((m) => MUSCLE_LABEL[m]).join(', ') || e.group}
                  {e.custom && ' · eigene'}
                  {used ? ` · ${used}× geloggt` : ''}
                </span>
              </span>
              {multi && (
                <span className={cx('w-6 h-6 rounded-lg border-2 grid place-items-center shrink-0', on ? 'bg-accent border-accent text-accent-ink' : 'border-line')}>{on && <Icon name="check" size={14} strokeWidth={3} />}</span>
              )}
            </button>
          )
        })}
        {!results.length && <div className="text-center text-muted text-sm py-8">Keine Treffer</div>}
      </div>
    </Sheet>
  )
}
