import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useRows, useSettings } from '../lib/api'
import { allExercises, groupColor, normalize, searchExercises } from '../data/exercises'
import { fmtDate } from '../lib/date'
import { PageHeader, SectionTitle, cx, inputCls } from '../components/ui'
import { Icon } from '../components/icons'

export function SearchPage() {
  const [q, setQ] = useState('')
  const s = useSettings()
  const custom = useRows('custom_exercises')
  const routines = useRows('routines')
  const workouts = useRows('workouts')
  const routineEx = useRows('routine_exercises')
  const n = normalize(q.trim())

  const res = useMemo(() => {
    if (!n) return null
    return {
      exercises: searchExercises(allExercises(custom, s.hidden_exercises), q).slice(0, 12),
      routines: routines.filter((r) => normalize(r.name).includes(n) || routineEx.some((e) => e.routine_id === r.id && normalize(e.exercise_name).includes(n))),
      workouts: [...workouts]
        .filter((w) => normalize(w.name).includes(n) || normalize(w.note ?? '').includes(n))
        .sort((a, b) => b.started_at.localeCompare(a.started_at))
        .slice(0, 15),
      notes: routineEx.filter((e) => e.note && normalize(e.note).includes(n)),
    }
  }, [n, q, custom, s.hidden_exercises, routines, workouts, routineEx])

  return (
    <div>
      <PageHeader back title="Suche" />
      <div className="relative">
        <Icon name="search" size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input autoFocus className={cx(inputCls, 'pl-10 bg-surface')} placeholder="Übungen, Pläne, Trainings, Notizen…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!res && <div className="text-center text-muted text-sm mt-12">Durchsucht Übungen, Pläne, vergangene Trainings und Notizen.</div>}
      {res && (
        <>
          {res.routines.length > 0 && <SectionTitle>Pläne</SectionTitle>}
          {res.routines.map((r) => (
            <Hit key={r.id} to={`/plan/${r.id}`} color={groupColor(r.muscle_group)} title={r.name} sub={r.muscle_group ?? 'Plan'} />
          ))}
          {res.exercises.length > 0 && <SectionTitle>Übungen</SectionTitle>}
          {res.exercises.map((e) => (
            <Hit key={e.name} to={`/exercises/${encodeURIComponent(e.name)}`} color={groupColor(e.group)} title={e.name} sub={e.group} />
          ))}
          {res.notes.length > 0 && <SectionTitle>Notizen</SectionTitle>}
          {res.notes.map((e) => (
            <Hit key={e.id} to={`/plan/${e.routine_id}`} title={e.exercise_name} sub={`📝 ${e.note}`} />
          ))}
          {res.workouts.length > 0 && <SectionTitle>Trainings</SectionTitle>}
          {res.workouts.map((w) => (
            <Hit key={w.id} to={`/stats/workout/${w.id}`} title={w.name} sub={fmtDate(w.started_at, { day: 'numeric', month: 'long', year: 'numeric' })} />
          ))}
          {!res.routines.length && !res.exercises.length && !res.workouts.length && !res.notes.length && <div className="text-center text-muted text-sm mt-10">Nichts gefunden</div>}
        </>
      )}
    </div>
  )
}

function Hit({ to, title, sub, color }: { to: string; title: string; sub: string; color?: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 p-3 mb-1.5 bg-surface border border-line rounded-xl hover:border-surface-3">
      {color && <span className="w-1.5 h-8 rounded-full" style={{ background: color }} />}
      <span className="flex-1 min-w-0">
        <span className="block font-semibold truncate">{title}</span>
        <span className="block text-xs text-muted truncate">{sub}</span>
      </span>
      <Icon name="chevronRight" size={16} className="text-muted" />
    </Link>
  )
}
