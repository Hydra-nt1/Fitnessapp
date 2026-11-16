import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { remove, save, useRows, useSettings } from '../lib/api'
import { exerciseInfo, groupColor, MUSCLE_LABEL, RECOMMENDED, type Muscle } from '../data/exercises'
import { exerciseHistory, fmtKg, suggestNext } from '../lib/training'
import type { RoutineExercise } from '../lib/types'
import { startRoutineWorkout } from '../state/actions'
import { useActive } from '../state/workout'
import { ExercisePicker } from '../components/ExercisePicker'
import { QuickLogSheet } from '../components/QuickLogSheet'
import { BodyMap } from '../components/BodyMap'
import { Badge, Button, Card, Empty, Field, IconButton, NumberStepper, PageHeader, SectionTitle, Sheet, inputCls, toast } from '../components/ui'
import { Icon } from '../components/icons'

export function RoutinePage() {
  const { id } = useParams()
  const nav = useNavigate()
  const s = useSettings()
  const routines = useRows('routines')
  const allRe = useRows('routine_exercises')
  const workouts = useRows('workouts')
  const sets = useRows('workout_sets')
  const quick = useRows('quick_logs')
  const active = useActive()
  const [picker, setPicker] = useState(false)
  const [edit, setEdit] = useState<RoutineExercise | null>(null)
  const [quickOpen, setQuickOpen] = useState(false)
  const routine = routines.find((r) => r.id === id)
  const list = useMemo(() => allRe.filter((e) => e.routine_id === id).sort((a, b) => a.position - b.position), [allRe, id])

  const muscles = useMemo(() => {
    const v: Partial<Record<Muscle, number>> = {}
    for (const e of list) {
      const info = exerciseInfo(e.exercise_name)
      for (const m of info.secondary) v[m] = Math.max(v[m] ?? 0, 0.35)
      for (const m of info.primary) v[m] = 1
    }
    return v
  }, [list])

  if (!routine) return <Empty icon="calendar" title="Plan nicht gefunden" action={<Button onClick={() => nav('/plan')}>Zu den Plänen</Button>} />

  const add = async (names: string[]) => {
    await save(
      'routine_exercises',
      names.map((n, i) => ({ routine_id: routine.id, exercise_name: n, position: list.length + i, sets: 3, reps_min: 8, reps_max: 12, weight: 0, rest_seconds: null, superset_group: null, note: null })),
    )
  }
  const move = async (i: number, d: -1 | 1) => {
    const arr = [...list]
    const j = i + d
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    await save('routine_exercises', arr.map((e, k) => ({ id: e.id, position: k })))
  }
  const toggleSuperset = async (i: number) => {
    const a = list[i]
    const b = list[i + 1]
    if (!b) return
    if (a.superset_group && a.superset_group === b.superset_group) {
      await save('routine_exercises', [{ id: b.id, superset_group: null }])
      if (!list[i - 1] || list[i - 1].superset_group !== a.superset_group) await save('routine_exercises', [{ id: a.id, superset_group: null }])
    } else {
      const g = a.superset_group ?? b.superset_group ?? crypto.randomUUID().slice(0, 8)
      await save('routine_exercises', [
        { id: a.id, superset_group: g },
        { id: b.id, superset_group: g },
      ])
    }
  }
  const start = () => {
    if (active) return nav('/workout')
    startRoutineWorkout(routine.id)
    nav('/workout')
  }
  const recs = RECOMMENDED[routine.muscle_group ?? ''] ?? []

  return (
    <div>
      <PageHeader back="/plan" title={routine.name} subtitle={<span style={{ color: groupColor(routine.muscle_group) }}>{routine.muscle_group ?? 'Allgemein'}</span>} />
      <div className="flex gap-2">
        <Button icon="play" size="lg" className="flex-1" onClick={start} disabled={!list.length}>
          Workout starten
        </Button>
        <Button variant="secondary" size="lg" icon="edit" onClick={() => setQuickOpen(true)} disabled={!list.length}>
          Schnell-Log
        </Button>
      </div>

      <SectionTitle action={<Button size="sm" icon="plus" variant="soft" onClick={() => setPicker(true)}>Übungen</Button>}>Übungen ({list.length})</SectionTitle>
      {!list.length && (
        <Card className="p-2">
          <Empty icon="dumbbell" title="Noch keine Übungen" text="Füge Übungen aus der Bibliothek hinzu." action={<Button icon="plus" onClick={() => setPicker(true)}>Übungen hinzufügen</Button>} />
          {recs.length > 0 && (
            <div className="border-t border-line p-3">
              <div className="text-xs font-semibold uppercase text-muted mb-2">Empfohlen für {routine.muscle_group}</div>
              <div className="flex flex-wrap gap-1.5">
                {recs.map((r) => (
                  <button key={r.name} onClick={() => add([r.name])} className="h-8 px-3 rounded-lg bg-surface-2 border border-line text-[13px] font-semibold hover:border-accent">
                    + {r.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
      <div className="flex flex-col">
        {list.map((e, i) => {
          const hist = exerciseHistory(e.exercise_name, workouts, sets, quick)
          const sug = suggestNext(e, hist, s.weight_increment)
          const linkedNext = !!e.superset_group && list[i + 1]?.superset_group === e.superset_group
          const linkedPrev = !!e.superset_group && list[i - 1]?.superset_group === e.superset_group
          const info = exerciseInfo(e.exercise_name)
          return (
            <div key={e.id}>
              <Card className={`p-3.5 ${linkedPrev ? 'rounded-t-md border-t-0' : ''} ${linkedNext ? 'rounded-b-md' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg grid place-items-center text-xs font-bold text-white shrink-0 mt-0.5" style={{ background: groupColor(info.group) }}>
                    {i + 1}
                  </div>
                  <button className="flex-1 min-w-0 text-left" onClick={() => setEdit(e)}>
                    <div className="font-semibold leading-snug">{e.exercise_name}</div>
                    <div className="text-sm text-muted tabular mt-0.5">
                      {e.sets} × {e.reps_min === e.reps_max ? e.reps_min : `${e.reps_min}–${e.reps_max}`} Wdh. {+e.weight > 0 && `· ${fmtKg(+e.weight)} kg`}
                      {e.rest_seconds ? ` · ${e.rest_seconds}s Pause` : ''}
                    </div>
                    {e.note && <div className="text-xs text-muted mt-1 italic">📝 {e.note}</div>}
                    {hist.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <Badge tone={sug.trend === 'up' ? 'good' : sug.trend === 'down' ? 'warn' : 'muted'}>
                          {sug.trend === 'up' ? '↑' : sug.trend === 'down' ? '↓' : '→'} Nächstes Mal: {fmtKg(sug.weight)} kg × {sug.reps}
                        </Badge>
                      </div>
                    )}
                  </button>
                  <div className="flex flex-col -my-1 -mr-1.5">
                    <IconButton icon="chevronUp" label="Hoch" className="w-8 h-7 disabled:opacity-20" disabled={i === 0} onClick={() => move(i, -1)} />
                    <IconButton icon="chevronDown" label="Runter" className="w-8 h-7 disabled:opacity-20" disabled={i === list.length - 1} onClick={() => move(i, 1)} />
                  </div>
                </div>
              </Card>
              {i < list.length - 1 && (
                <div className="flex justify-center -my-1 relative z-10">
                  <button onClick={() => toggleSuperset(i)} className={`h-6 px-2.5 rounded-full text-[11px] font-bold border flex items-center gap-1 ${linkedNext ? 'bg-accent text-white border-accent' : 'bg-surface border-line text-muted opacity-60 hover:opacity-100'}`}>
                    <Icon name="link" size={11} /> {linkedNext ? 'Supersatz' : 'verbinden'}
                  </button>
                </div>
              )}
              {i < list.length - 1 && !linkedNext && <div className="h-1" />}
            </div>
          )
        })}
      </div>

      {list.length > 0 && (
        <>
          <SectionTitle>Trainierte Muskeln</SectionTitle>
          <Card className="p-4">
            <BodyMap values={muscles} renderInfo={(m) => (muscles[m] === 1 ? 'Hauptmuskel' : muscles[m] ? 'unterstützend' : 'nicht beansprucht')} />
            <div className="flex flex-wrap gap-1.5 justify-center mt-1">
              {(Object.keys(muscles) as Muscle[])
                .filter((m) => muscles[m] === 1)
                .map((m) => (
                  <Badge key={m}>{MUSCLE_LABEL[m]}</Badge>
                ))}
            </div>
          </Card>
        </>
      )}

      <ExercisePicker open={picker} onClose={() => setPicker(false)} multi onPick={add} exclude={list.map((e) => e.exercise_name)} />
      <QuickLogSheet open={quickOpen} routineId={routine.id} onClose={() => setQuickOpen(false)} />
      <EditExerciseSheet ex={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

function EditExerciseSheet({ ex, onClose }: { ex: RoutineExercise | null; onClose: () => void }) {
  const [d, setD] = useState<RoutineExercise | null>(null)
  if (ex && (!d || d.id !== ex.id)) setD(ex)
  if (!ex || !d) return null
  const set = (p: Partial<RoutineExercise>) => setD({ ...d, ...p })
  const submit = async () => {
    await save('routine_exercises', { ...d, reps_max: Math.max(d.reps_min, d.reps_max), note: d.note?.trim() || null })
    onClose()
  }
  const del = async () => {
    await remove('routine_exercises', d.id, ['quick_logs'])
    toast('Übung entfernt')
    onClose()
  }
  return (
    <Sheet
      open
      onClose={onClose}
      title={d.exercise_name}
      footer={
        <>
          <Button variant="danger" icon="trash" onClick={del} />
          <Button className="flex-1" onClick={submit}>
            Speichern
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 mb-3.5">
        <NumberStepper label="Sätze" value={d.sets} min={1} onChange={(v) => set({ sets: v })} />
        <NumberStepper label="Gewicht (kg)" value={+d.weight} step={2.5} decimals onChange={(v) => set({ weight: v })} />
        <NumberStepper label="Wdh. min" value={d.reps_min} min={1} onChange={(v) => set({ reps_min: v, reps_max: Math.max(v, d.reps_max) })} />
        <NumberStepper label="Wdh. max" value={d.reps_max} min={1} onChange={(v) => set({ reps_max: v })} />
      </div>
      <p className="text-xs text-muted -mt-1 mb-4">
        <Icon name="info" size={12} className="inline -mt-0.5" /> Doppelte Progression: Schaffst du in allen Sätzen die max. Wiederholungen, schlägt die App beim nächsten Mal mehr Gewicht vor.
      </p>
      <Field label="Pause (Sekunden, leer = Standard)">
        <input className={inputCls} type="number" inputMode="numeric" value={d.rest_seconds ?? ''} placeholder="Standard" onChange={(e) => set({ rest_seconds: e.target.value ? Number(e.target.value) : null })} />
      </Field>
      <Field label="Notiz (Sitzhöhe, Griff, Einstellung …)">
        <textarea className={inputCls + ' h-20 py-2.5 resize-none'} value={d.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder="z. B. Sitz Position 3, enger Griff" />
      </Field>
      <Link to={`/exercises/${encodeURIComponent(d.exercise_name)}`} className="text-sm text-accent font-semibold inline-flex items-center gap-1">
        Verlauf & Details ansehen <Icon name="arrowRight" size={14} />
      </Link>
    </Sheet>
  )
}
