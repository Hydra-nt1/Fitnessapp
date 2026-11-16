import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { remove, save, saveSettings, useRows, useSettings } from '../lib/api'
import { allExercises, GROUPS, groupColor, MUSCLE_LABEL, MUSCLES, searchExercises, type Muscle } from '../data/exercises'
import { Button, Chip, Field, PageHeader, Sheet, cx, inputCls, toast } from '../components/ui'
import { Icon } from '../components/icons'

export function ExercisesPage() {
  const custom = useRows('custom_exercises')
  const sets = useRows('workout_sets')
  const s = useSettings()
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<string | null>(null)
  const [onlyMine, setOnlyMine] = useState(false)
  const [create, setCreate] = useState(false)
  const [limit, setLimit] = useState(80)
  const list = useMemo(() => allExercises(custom, s.hidden_exercises), [custom, s.hidden_exercises])
  const usage = useMemo(() => {
    const m = new Map<string, number>()
    for (const x of sets) m.set(x.exercise_name, (m.get(x.exercise_name) ?? 0) + 1)
    return m
  }, [sets])
  const results = useMemo(() => {
    let r = searchExercises(list, q)
    if (group) r = r.filter((e) => e.group === group)
    if (onlyMine) r = r.filter((e) => e.custom || usage.has(e.name))
    return r
  }, [list, q, group, onlyMine, usage])

  return (
    <div>
      <PageHeader title="Übungen" subtitle={`${list.length} Übungen in der Bibliothek`} actions={<Button size="sm" icon="plus" onClick={() => setCreate(true)}>Eigene</Button>} />
      <div className="sticky top-0 z-10 bg-bg pt-1 pb-2 -mx-4 px-4 md:-mx-8 md:px-8">
        <div className="relative">
          <Icon name="search" size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input className={cx(inputCls, 'pl-10 bg-surface')} placeholder="Übung, Muskel oder Gerät suchen" value={q} onChange={(e) => (setQ(e.target.value), setLimit(80))} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-2.5 -mx-4 px-4">
          <Chip active={onlyMine} onClick={() => setOnlyMine(!onlyMine)}>
            ★ Meine
          </Chip>
          {GROUPS.map((g) => (
            <Chip key={g} active={group === g} color={groupColor(g)} onClick={() => setGroup(group === g ? null : g)}>
              {g}
            </Chip>
          ))}
        </div>
      </div>
      <div className="bg-surface border border-line rounded-2xl divide-y divide-line mt-1">
        {results.slice(0, limit).map((e) => (
          <Link key={e.name} to={`/exercises/${encodeURIComponent(e.name)}`} className="flex items-center gap-3 px-3.5 py-3 hover:bg-surface-2/50">
            <span className="w-1.5 h-9 rounded-full shrink-0" style={{ background: groupColor(e.group) }} />
            <span className="flex-1 min-w-0">
              <span className="block font-semibold truncate">{e.name}</span>
              <span className="block text-xs text-muted truncate">
                {e.primary.map((m) => MUSCLE_LABEL[m]).join(', ') || e.group}
                {e.custom && ' · eigene'}
              </span>
            </span>
            {usage.get(e.name) ? <span className="text-xs text-muted tabular">{usage.get(e.name)} Sätze</span> : null}
            <Icon name="chevronRight" size={16} className="text-muted" />
          </Link>
        ))}
        {!results.length && <div className="text-center text-muted py-10 text-sm">Keine Treffer</div>}
      </div>
      {limit < results.length && (
        <Button variant="secondary" className="w-full mt-3" onClick={() => setLimit(limit + 120)}>
          Weitere {Math.min(120, results.length - limit)} anzeigen
        </Button>
      )}
      {s.hidden_exercises.length > 0 && (
        <button className="text-sm text-muted mt-4 hover:text-fg" onClick={() => (saveSettings({ hidden_exercises: [] }), toast('Ausgeblendete Übungen wieder sichtbar'))}>
          {s.hidden_exercises.length} ausgeblendete Übung(en) wieder einblenden
        </button>
      )}
      <CustomExerciseSheet open={create} onClose={() => setCreate(false)} />
    </div>
  )
}

export function CustomExerciseSheet({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: { id: string; name: string; muscle_group: string; primary_muscles: string[]; secondary_muscles: string[] } }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [group, setGroup] = useState(initial?.muscle_group ?? GROUPS[0])
  const [prim, setPrim] = useState<string[]>(initial?.primary_muscles ?? [])
  const [sec, setSec] = useState<string[]>(initial?.secondary_muscles ?? [])
  const toggle = (arr: string[], set: (v: string[]) => void, m: Muscle) => set(arr.includes(m) ? arr.filter((x) => x !== m) : [...arr, m])
  const submit = async () => {
    if (!name.trim()) return
    await save('custom_exercises', { id: initial?.id, name: name.trim(), muscle_group: group, primary_muscles: prim, secondary_muscles: sec.filter((x) => !prim.includes(x)) })
    toast('Übung gespeichert')
    onClose()
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initial ? 'Übung bearbeiten' : 'Eigene Übung'}
      footer={
        <>
          {initial && <Button variant="danger" icon="trash" onClick={() => (remove('custom_exercises', initial.id), onClose())} />}
          <Button className="flex-1" disabled={!name.trim()} onClick={submit}>
            Speichern
          </Button>
        </>
      }
    >
      <Field label="Name">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Hackenschmidt Kniebeuge" />
      </Field>
      <Field label="Kategorie">
        <select className={inputCls} value={group} onChange={(e) => setGroup(e.target.value)}>
          {GROUPS.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </Field>
      <Field label="Hauptmuskeln">
        <div className="flex flex-wrap gap-1.5">
          {MUSCLES.map((m) => (
            <Chip key={m.id} active={prim.includes(m.id)} onClick={() => toggle(prim, setPrim, m.id)}>
              {m.label}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Unterstützende Muskeln">
        <div className="flex flex-wrap gap-1.5">
          {MUSCLES.map((m) => (
            <Chip key={m.id} active={sec.includes(m.id)} onClick={() => toggle(sec, setSec, m.id)}>
              {m.label}
            </Chip>
          ))}
        </div>
      </Field>
    </Sheet>
  )
}
