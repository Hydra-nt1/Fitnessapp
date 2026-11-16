import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { remove, save, useRows } from '../lib/api'
import { fmtDateLong, fmtDuration, fmtTime, isoDate } from '../lib/date'
import { e1rm, fmtKg, fmtVolume, muscleVolume, workoutVolume } from '../lib/training'
import { MUSCLES } from '../data/exercises'
import { repeatWorkout } from '../state/actions'
import { useActive } from '../state/workout'
import { BodyMap } from '../components/BodyMap'
import { Badge, Button, Card, Empty, Field, IconButton, PageHeader, SectionTitle, Sheet, Stat, inputCls, toast, useConfirm } from '../components/ui'

export function WorkoutDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const workouts = useRows('workouts')
  const allSets = useRows('workout_sets')
  const active = useActive()
  const [confirm, confirmNode] = useConfirm()
  const [edit, setEdit] = useState(false)
  const w = workouts.find((x) => x.id === id)
  const sets = useMemo(() => allSets.filter((x) => x.workout_id === id).sort((a, b) => a.exercise_position - b.exercise_position || a.set_number - b.set_number), [allSets, id])
  const groups = useMemo(() => {
    const m = new Map<string, typeof sets>()
    for (const s of sets) m.set(s.exercise_name, [...(m.get(s.exercise_name) ?? []), s])
    return [...m.entries()]
  }, [sets])
  const mv = useMemo(() => muscleVolume(sets), [sets])
  const [form, setForm] = useState({ name: '', note: '', date: '', time: '', duration: 0 })

  if (!w) return <Empty icon="calendar" title="Training nicht gefunden" action={<Button onClick={() => nav('/stats')}>Zur Statistik</Button>} />

  const del = async () => {
    if (!(await confirm('Dieses Training endgültig löschen?', { danger: true, ok: 'Löschen' }))) return
    await remove('workouts', w.id, ['workout_sets'])
    toast('Training gelöscht')
    nav(-1)
  }
  const openEdit = () => {
    const d = new Date(w.started_at)
    setForm({ name: w.name, note: w.note ?? '', date: isoDate(d), time: fmtTime(d), duration: Math.round((w.duration_s ?? 0) / 60) })
    setEdit(true)
  }
  const saveEdit = async () => {
    const [h, m] = form.time.split(':').map(Number)
    const [y, mo, da] = form.date.split('-').map(Number)
    const start = new Date(y, mo - 1, da, h || 0, m || 0)
    await save('workouts', { id: w.id, name: form.name || w.name, note: form.note || null, started_at: start.toISOString(), duration_s: form.duration * 60, ended_at: new Date(start.getTime() + form.duration * 60000).toISOString() })
    setEdit(false)
  }
  const again = () => {
    if (active) return nav('/workout')
    repeatWorkout(w.id)
    nav('/workout')
  }

  return (
    <div>
      <PageHeader back title={w.name} subtitle={`${fmtDateLong(w.started_at)} · ${fmtTime(w.started_at)} Uhr`} actions={<IconButton icon="edit" label="Bearbeiten" onClick={openEdit} />} />
      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Dauer" value={fmtDuration(w.duration_s)} />
        <Stat label="Sätze" value={sets.length} />
        <Stat label="Volumen" value={fmtVolume(workoutVolume(sets))} />
      </div>
      {w.note && <Card className="p-3.5 mt-3 text-sm">📝 {w.note}</Card>}
      {w.kind === 'attendance' && !sets.length && <Card className="p-4 mt-3 text-sm text-muted">Check-in ohne Satz-Tracking.</Card>}

      {groups.map(([name, ss]) => (
        <div key={name}>
          <SectionTitle>
            <Link to={`/exercises/${encodeURIComponent(name)}`} className="normal-case tracking-normal text-[15px] text-fg hover:text-accent-fg">
              {name}
            </Link>
          </SectionTitle>
          <Card className="divide-y divide-line">
            {ss.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-6 text-muted font-bold">{s.set_type === 'warmup' ? 'W' : s.set_type === 'drop' ? 'D' : s.set_type === 'failure' ? 'F' : i + 1}</span>
                <span className="flex-1 font-semibold tabular">
                  {fmtKg(+s.weight)} kg × {s.reps}
                </span>
                {s.rpe && <Badge tone="muted">RPE {String(s.rpe).replace('.', ',')}</Badge>}
                {+s.weight > 0 && s.set_type !== 'warmup' && <span className="text-xs text-muted tabular w-20 text-right">1RM ≈ {fmtKg(Math.round(e1rm(+s.weight, s.reps)))}</span>}
              </div>
            ))}
          </Card>
        </div>
      ))}

      {sets.length > 0 && (
        <>
          <SectionTitle>Beanspruchte Muskeln</SectionTitle>
          <Card className="p-4">
            <BodyMap values={Object.fromEntries(MUSCLES.map((m) => [m.id, Math.min(1, mv[m.id] / 6)]))} renderInfo={(m) => `${mv[m]} Sätze`} />
          </Card>
        </>
      )}

      <div className="flex gap-2 mt-6">
        {sets.length > 0 && (
          <Button icon="refresh" className="flex-1" onClick={again}>
            Wiederholen
          </Button>
        )}
        <Button variant="danger" icon="trash" onClick={del}>
          Löschen
        </Button>
      </div>

      <Sheet open={edit} onClose={() => setEdit(false)} title="Training bearbeiten" footer={<Button className="flex-1" onClick={saveEdit}>Speichern</Button>}>
        <Field label="Name">
          <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Datum">
            <input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Start">
            <input type="time" className={inputCls} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </Field>
          <Field label="Minuten">
            <input type="number" className={inputCls} value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Notiz">
          <textarea className={inputCls + ' h-20 py-2.5 resize-none'} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
      </Sheet>
      {confirmNode}
    </div>
  )
}
