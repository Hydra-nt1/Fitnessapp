import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { saveSettings, useRows, useSettings } from '../lib/api'
import { addDays, fmtDate, fmtDuration, isoDate, relDay, startOfWeek, weekLabel } from '../lib/date'
import { dayStreak, exerciseHistory, fmtKg, fmtVolume, isWorkingSet, muscleVolume, personalRecords, plannedDayStreak, quickLogSets, weekStreak, workoutVolume } from '../lib/training'
import { MUSCLES, type Muscle } from '../data/exercises'
import { BodyMap } from '../components/BodyMap'
import { BarChart, Heatmap } from '../components/charts'
import { Badge, Button, Card, Empty, IconButton, PageHeader, SectionTitle, Segmented, Stat, cx } from '../components/ui'
import { Icon } from '../components/icons'

export function StatsPage() {
  const s = useSettings()
  const workouts = useRows('workouts')
  const sets = useRows('workout_sets')
  const quick = useRows('quick_logs')
  const plan = useRows('week_plan')
  const [off, setOff] = useState(0)
  const [tab, setTab] = useState<'overview' | 'muscles' | 'records' | 'history'>('overview')

  const ws = startOfWeek(new Date(), off)
  const we = addDays(ws, 7)
  const inRange = (from: Date, to: Date) => workouts.filter((w) => new Date(w.started_at) >= from && new Date(w.started_at) < to)
  const wk = inRange(ws, we)
  const prev = inRange(addDays(ws, -7), ws)
  const setsOf = (list: typeof workouts) => {
    const ids = new Set(list.map((w) => w.id))
    return sets.filter((x) => ids.has(x.workout_id))
  }
  const wkSets = setsOf(wk)
  const prevSets = setsOf(prev)
  const vol = workoutVolume(wkSets)
  const pvol = workoutVolume(prevSets)
  const dur = wk.reduce((a, w) => a + (w.duration_s ?? 0), 0)
  const pdur = prev.reduce((a, w) => a + (w.duration_s ?? 0), 0)

  const weekQuick = quick.filter((q) => q.week_start === isoDate(ws))
  const mVol = useMemo(() => muscleVolume([...wkSets, ...quickLogSets(weekQuick)]), [wkSets, weekQuick])

  const weekly = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const a = startOfWeek(new Date(), off - 11 + i)
      const list = inRange(a, addDays(a, 7))
      return { label: fmtDate(a, { day: 'numeric', month: 'numeric' }), value: workoutVolume(setsOf(list)), count: list.length }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts, sets, off])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const w of workouts) m.set(isoDate(new Date(w.started_at)), (m.get(isoDate(new Date(w.started_at))) ?? 0) + 1)
    return m
  }, [workouts])
  const planned = new Set(plan.filter((p) => p.routine_ids.length).map((p) => p.weekday))

  return (
    <div>
      <PageHeader title="Statistik" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'overview', label: 'Überblick' },
          { value: 'muscles', label: 'Muskeln' },
          { value: 'records', label: 'Rekorde' },
          { value: 'history', label: 'Verlauf' },
        ]}
      />

      {(tab === 'overview' || tab === 'muscles') && (
        <div className="flex items-center justify-between mt-4">
          <IconButton icon="chevronLeft" label="Vorherige Woche" onClick={() => setOff(off - 1)} />
          <button className="font-bold" onClick={() => setOff(0)}>
            {weekLabel(ws)}
          </button>
          <IconButton icon="chevronRight" label="Nächste Woche" onClick={() => setOff(Math.min(0, off + 1))} disabled={off >= 0} className="disabled:opacity-20" />
        </div>
      )}

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 gap-2.5 mt-2">
            <Stat label="Trainings" icon="dumbbell" value={wk.length} sub={<Diff a={wk.length} b={prev.length} />} />
            <Stat label="Volumen" icon="chart" value={fmtVolume(vol)} sub={<Diff a={vol} b={pvol} fmt={fmtVolume} />} />
            <Stat label="Arbeitssätze" icon="check" value={wkSets.filter(isWorkingSet).length} sub={<Diff a={wkSets.filter(isWorkingSet).length} b={prevSets.filter(isWorkingSet).length} />} />
            <Stat label="Trainingszeit" icon="timer" value={fmtDuration(dur)} sub={<Diff a={dur} b={pdur} fmt={(x) => fmtDuration(x)} />} />
          </div>

          <SectionTitle>Volumen pro Woche</SectionTitle>
          <Card className="p-4">
            <BarChart bars={weekly} highlight={11} fmt={fmtVolume} />
          </Card>

          <SectionTitle>Serien</SectionTitle>
          <div className="grid grid-cols-3 gap-2.5">
            <Stat label="Plan-Serie" icon="flame" tone="#f97316" value={plannedDayStreak(workouts, plan)} sub="Trainingstage" />
            <Stat label="Tage am Stück" icon="zap" value={dayStreak(workouts)} sub="ohne Pause" />
            <Stat label="Wochen" icon="trophy" tone="#eab308" value={weekStreak(workouts, s.streak_threshold)} sub={`mit ≥ ${s.streak_threshold} Trainings`} />
          </div>
          <div className="flex items-center gap-2 mt-2.5 text-sm text-muted">
            <span>Wochenziel:</span>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button key={n} onClick={() => saveSettings({ streak_threshold: n })} className={cx('w-8 h-8 rounded-lg font-bold', n === s.streak_threshold ? 'bg-accent text-accent-ink' : 'bg-surface-2 hover:text-fg')}>
                {n}
              </button>
            ))}
          </div>

          <SectionTitle>Aktivität (6 Monate)</SectionTitle>
          <Card className="p-4">
            <Heatmap counts={counts} planned={planned} />
            <div className="text-xs text-muted mt-2">{workouts.filter((w) => new Date(w.started_at) > addDays(new Date(), -182)).length} Trainings in den letzten 6 Monaten</div>
          </Card>
        </>
      )}

      {tab === 'muscles' && <MuscleTab vol={mVol} />}
      {tab === 'records' && <RecordsTab />}
      {tab === 'history' && <HistoryTab />}
    </div>
  )
}

function Diff({ a, b, fmt = (x: number) => String(Math.round(x)) }: { a: number; b: number; fmt?: (x: number) => string }) {
  if (!b && !a) return <span>–</span>
  const d = a - b
  if (!d) return <span>wie Vorwoche</span>
  return (
    <span className={d > 0 ? 'text-good' : 'text-bad'}>
      {d > 0 ? '+' : '−'}
      {fmt(Math.abs(d))} ggü. Vorwoche
    </span>
  )
}

function MuscleTab({ vol }: { vol: Record<Muscle, number> }) {
  const values = Object.fromEntries(MUSCLES.map((m) => [m.id, vol[m.id] ? vol[m.id] / m.target[0] : 0])) as Record<Muscle, number>
  const under = MUSCLES.filter((m) => vol[m.id] < m.target[0])
  const over = MUSCLES.filter((m) => vol[m.id] > m.target[1])
  return (
    <>
      <Card className="p-4 mt-2">
        <BodyMap
          mode="volume"
          values={values}
          renderInfo={(m) => {
            const t = MUSCLES.find((x) => x.id === m)!.target
            return `${fmtSets(vol[m])} Sätze · Ziel ${t[0]}–${t[1]}`
          }}
          legend={<span className="text-xs text-muted">Grün = im Zielbereich, Blau = darunter, Rot = darüber</span>}
        />
      </Card>
      <SectionTitle>Harte Sätze pro Muskel</SectionTitle>
      <Card className="p-4 flex flex-col gap-3">
        {MUSCLES.map((m) => {
          const v = vol[m.id]
          const max = Math.max(m.target[1] * 1.25, v)
          const tone = v > m.target[1] ? 'var(--bad)' : v >= m.target[0] ? 'var(--good)' : 'var(--accent)'
          return (
            <div key={m.id}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold">{m.label}</span>
                <span className="tabular text-muted">
                  <b className="text-fg">{fmtSets(v)}</b> / {m.target[0]}–{m.target[1]}
                </span>
              </div>
              <div className="relative h-2.5 rounded-full bg-surface-2 overflow-hidden">
                <div className="absolute inset-y-0 bg-good/15" style={{ left: `${(m.target[0] / max) * 100}%`, width: `${((m.target[1] - m.target[0]) / max) * 100}%` }} />
                <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${(v / max) * 100}%`, background: tone }} />
              </div>
            </div>
          )
        })}
        <p className="text-xs text-muted">
          <Icon name="info" size={12} className="inline -mt-0.5" /> Hauptmuskel zählt 1 Satz, unterstützende Muskeln ½. Zielbereiche orientieren sich an gängigen Empfehlungen für Muskelaufbau (≈ 10–20 Sätze/Woche).
        </p>
      </Card>
      {(under.length > 0 || over.length > 0) && (
        <Card className="p-4 mt-3">
          {under.length > 0 && (
            <div className="text-sm">
              <b>Zu wenig:</b> <span className="text-muted">{under.map((m) => m.label).join(', ')}</span>
            </div>
          )}
          {over.length > 0 && (
            <div className="text-sm mt-1.5">
              <b>Evtl. zu viel:</b> <span className="text-muted">{over.map((m) => m.label).join(', ')}</span>
            </div>
          )}
        </Card>
      )}
    </>
  )
}
const fmtSets = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','))

function RecordsTab() {
  const workouts = useRows('workouts')
  const sets = useRows('workout_sets')
  const quick = useRows('quick_logs')
  const recs = useMemo(() => {
    const names = [...new Set([...sets.map((x) => x.exercise_name), ...quick.map((q) => q.exercise_name)])]
    return names
      .map((n) => {
        const h = exerciseHistory(n, workouts, sets, quick)
        return { name: n, r: personalRecords(h), count: h.length, last: h[0]?.date }
      })
      .filter((x) => x.r.maxWeight > 0)
      .sort((a, b) => b.r.maxE1rm - a.r.maxE1rm || b.r.maxWeight - a.r.maxWeight)
  }, [workouts, sets, quick])
  if (!recs.length) return <Empty icon="trophy" title="Noch keine Rekorde" text="Logge Sätze mit Gewicht, dann erscheinen hier deine Bestleistungen." />
  return (
    <Card className="divide-y divide-line mt-4">
      {recs.map((x) => (
        <Link key={x.name} to={`/exercises/${encodeURIComponent(x.name)}`} className="flex items-center gap-3 p-3.5 hover:bg-surface-2/50">
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{x.name}</div>
            <div className="text-xs text-muted">
              {x.count}× trainiert · zuletzt {x.last ? relDay(x.last) : '–'}
            </div>
          </div>
          <div className="text-right">
            <div className="font-display font-bold tabular">{fmtKg(x.r.maxWeight)} kg</div>
            {x.r.maxE1rm > 0 && <div className="text-xs text-muted tabular">1RM ≈ {fmtKg(Math.round(x.r.maxE1rm))}</div>}
          </div>
        </Link>
      ))}
    </Card>
  )
}

function HistoryTab() {
  const workouts = useRows('workouts')
  const sets = useRows('workout_sets')
  const [n, setN] = useState(30)
  const list = [...workouts].sort((a, b) => b.started_at.localeCompare(a.started_at))
  if (!list.length) return <Empty icon="calendar" title="Noch keine Trainings" />
  let lastMonth = ''
  return (
    <div className="mt-2">
      {list.slice(0, n).map((w) => {
        const month = new Date(w.started_at).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
        const header = month !== lastMonth ? (lastMonth = month) : null
        const ws = sets.filter((x) => x.workout_id === w.id)
        return (
          <div key={w.id}>
            {header && <SectionTitle>{header}</SectionTitle>}
            <Link to={`/stats/workout/${w.id}`} className="flex items-center gap-3 p-3.5 mb-2 bg-surface border border-line rounded-2xl hover:border-surface-3">
              <div className="w-11 text-center">
                <div className="text-lg font-display font-bold leading-none">{new Date(w.started_at).getDate()}</div>
                <div className="text-[11px] text-muted uppercase">{new Date(w.started_at).toLocaleDateString('de-DE', { weekday: 'short' })}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{w.name}</div>
                <div className="text-xs text-muted">
                  {fmtDuration(w.duration_s)}
                  {ws.length > 0 && ` · ${new Set(ws.map((x) => x.exercise_name)).size} Übungen · ${fmtVolume(workoutVolume(ws))}`}
                </div>
              </div>
              {w.kind === 'attendance' && <Badge tone="muted">Check-in</Badge>}
              {w.rating && <span>{['😫', '😕', '😐', '🙂', '🔥'][w.rating - 1]}</span>}
            </Link>
          </div>
        )
      })}
      {n < list.length && (
        <Button variant="secondary" className="w-full" onClick={() => setN(n + 30)}>
          Mehr laden
        </Button>
      )}
    </div>
  )
}

