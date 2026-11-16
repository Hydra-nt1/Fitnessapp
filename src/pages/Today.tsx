import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useRows, useSettings } from '../lib/api'
import { addDays, fmtDateLong, fmtDuration, isoDate, relDay, sameDay, startOfWeek, weekdayOf, WEEKDAYS, weekLabel } from '../lib/date'
import { fmtVolume, muscleRecovery, plannedDayStreak, weekStreak, workoutVolume } from '../lib/training'
import { groupColor, MUSCLES } from '../data/exercises'
import { startRoutineWorkout } from '../state/actions'
import { useActive } from '../state/workout'
import { BodyMap } from '../components/BodyMap'
import { QuickLogSheet } from '../components/QuickLogSheet'
import { Badge, Button, Card, IconButton, PageHeader, SectionTitle, Stat, cx, toast } from '../components/ui'
import { Icon } from '../components/icons'
import { Ring } from '../components/charts'

export function TodayPage() {
  const nav = useNavigate()
  const s = useSettings()
  const routines = useRows('routines')
  const plan = useRows('week_plan')
  const workouts = useRows('workouts')
  const sets = useRows('workout_sets')
  const routineEx = useRows('routine_exercises')
  const active = useActive()
  const [weekOff, setWeekOff] = useState(0)
  const [selDay, setSelDay] = useState(weekdayOf(new Date()))
  const [quickFor, setQuickFor] = useState<string | null>(null)

  const weekStart = startOfWeek(new Date(), weekOff)
  const selDate = addDays(weekStart, selDay)
  const today = new Date()
  const byDay = useMemo(() => {
    const m = new Map<string, typeof workouts>()
    for (const w of workouts) {
      const k = isoDate(new Date(w.started_at))
      m.set(k, [...(m.get(k) ?? []), w])
    }
    return m
  }, [workouts])
  const planFor = (wd: number) => (plan.find((p) => p.weekday === wd)?.routine_ids ?? []).map((id) => routines.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r)
  const selRoutines = planFor(selDay)
  const selDone = byDay.get(isoDate(selDate)) ?? []

  const thisWeek = workouts.filter((w) => new Date(w.started_at) >= startOfWeek())
  const weekSetIds = new Set(thisWeek.map((w) => w.id))
  const weekVol = workoutVolume(sets.filter((x) => weekSetIds.has(x.workout_id)))
  const plannedCount = plan.filter((p) => p.routine_ids.length).length || s.days_per_week || s.streak_threshold
  const dStreak = plannedDayStreak(workouts, plan)
  const wStreak = weekStreak(workouts, s.streak_threshold)
  const recovery = useMemo(() => muscleRecovery(workouts, sets), [workouts, sets])
  const fresh = MUSCLES.filter((m) => recovery[m.id].recovery >= 0.85).length

  const start = (routineId: string | null, kind: 'full' | 'attendance' = 'full') => {
    if (active) {
      toast('Es läuft bereits ein Training')
      nav('/workout')
      return
    }
    startRoutineWorkout(routineId, kind)
    if (kind === 'full') nav('/workout')
    else toast('Eingecheckt – viel Spaß beim Training! 💪')
  }

  const hour = today.getHours()
  const greet = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend'
  const recent = [...workouts].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 4)

  return (
    <div>
      <PageHeader
        title={`${greet}${s.display_name ? `, ${s.display_name.split(' ')[0]}` : ''}`}
        subtitle={fmtDateLong(today)}
        actions={<IconButton icon="search" label="Suche" onClick={() => nav('/search')} />}
      />

      {/* Wochenleiste */}
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <IconButton icon="chevronLeft" label="Vorherige Woche" onClick={() => setWeekOff(weekOff - 1)} className="w-8 h-8" />
          <button className="text-sm font-bold" onClick={() => (setWeekOff(0), setSelDay(weekdayOf(new Date())))}>
            {weekLabel(weekStart)}
          </button>
          <IconButton icon="chevronRight" label="Nächste Woche" onClick={() => setWeekOff(weekOff + 1)} className="w-8 h-8" />
        </div>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d, i) => {
            const date = addDays(weekStart, i)
            const done = (byDay.get(isoDate(date)) ?? []).length > 0
            const planned = planFor(i)
            const isToday = sameDay(date, today)
            const sel = i === selDay
            const missed = !done && planned.length > 0 && date < today && !isToday
            return (
              <button key={i} onClick={() => setSelDay(i)} className={cx('flex flex-col items-center py-2 rounded-xl transition', sel ? 'bg-accent text-white' : 'hover:bg-surface-2')}>
                <span className={cx('text-[11px] font-semibold', sel ? 'text-white/80' : 'text-muted')}>{d.short}</span>
                <span className={cx('text-base font-bold tabular', isToday && !sel && 'text-accent')}>{date.getDate()}</span>
                <span className="h-2 flex items-center gap-0.5 mt-0.5">
                  {done ? (
                    <Icon name="check" size={12} strokeWidth={3.5} className={sel ? 'text-white' : 'text-good'} />
                  ) : planned.length ? (
                    planned.slice(0, 3).map((r) => <span key={r.id} className="w-1.5 h-1.5 rounded-full" style={{ background: sel ? '#fff' : missed ? 'var(--muted)' : groupColor(r.muscle_group) }} />)
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      {/* Ausgewählter Tag */}
      <SectionTitle>{sameDay(selDate, today) ? 'Heute geplant' : `${WEEKDAYS[selDay].label}, ${selDate.getDate()}.${selDate.getMonth() + 1}.`}</SectionTitle>
      {selDone.length > 0 && (
        <div className="flex flex-col gap-2 mb-2">
          {selDone.map((w) => (
            <Card key={w.id} className="p-3.5 flex items-center gap-3 border-good/30" onClick={() => nav(`/stats/workout/${w.id}`)}>
              <span className="w-10 h-10 rounded-xl bg-good/15 text-good grid place-items-center">
                <Icon name="check" size={20} strokeWidth={3} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{w.name}</div>
                <div className="text-xs text-muted">
                  Erledigt · {fmtDuration(w.duration_s)}
                  {w.kind === 'attendance' && ' · Check-in'}
                </div>
              </div>
              <Icon name="chevronRight" size={18} className="text-muted" />
            </Card>
          ))}
        </div>
      )}
      {selRoutines.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {selRoutines.map((r) => {
            const n = routineEx.filter((e) => e.routine_id === r.id).length
            return (
              <Card key={r.id} className="p-4 overflow-hidden relative">
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: groupColor(r.muscle_group) }} />
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <Link to={`/plan/${r.id}`} className="text-lg font-bold hover:text-accent">
                      {r.name}
                    </Link>
                    <div className="text-sm text-muted">
                      {r.muscle_group ?? 'Training'} · {n} Übung{n === 1 ? '' : 'en'}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3.5">
                  <Button icon="play" onClick={() => start(r.id)} className="flex-1 min-w-[140px]">
                    Workout starten
                  </Button>
                  <Button variant="secondary" icon="checkin" onClick={() => start(r.id, 'attendance')}>
                    Check-in
                  </Button>
                  <Button variant="secondary" icon="edit" onClick={() => setQuickFor(r.id)}>
                    Schnell-Log
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="p-5 text-center">
          <div className="text-3xl mb-1">🧘</div>
          <div className="font-bold">Ruhetag</div>
          <div className="text-sm text-muted mb-4">Für diesen Tag ist nichts geplant.</div>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button icon="play" variant="soft" onClick={() => start(null)}>
              Freies Workout
            </Button>
            <Button icon="calendar" variant="secondary" onClick={() => nav('/plan')}>
              Woche planen
            </Button>
          </div>
        </Card>
      )}

      {/* Kennzahlen */}
      <SectionTitle>Deine Woche</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Card className="p-3.5 flex items-center gap-3">
          <Ring value={thisWeek.length / Math.max(1, plannedCount)} size={50} stroke={5}>
            <span className="text-sm font-extrabold tabular">{thisWeek.length}</span>
          </Ring>
          <div>
            <div className="text-xs text-muted font-medium">Trainings</div>
            <div className="font-bold tabular">von {plannedCount}</div>
          </div>
        </Card>
        <Stat label="Serie" icon="flame" tone="#f97316" value={`${dStreak}`} sub={`Trainingstage · ${wStreak} Wo. ≥${s.streak_threshold}×`} />
        <Stat label="Volumen" icon="dumbbell" value={fmtVolume(weekVol)} sub="diese Woche" />
        <Stat label="Erholt" icon="zap" tone="var(--good)" value={`${fresh}/${MUSCLES.length}`} sub="Muskelgruppen bereit" />
      </div>

      <SectionTitle action={<Link to="/stats" className="text-sm text-accent font-semibold">Details</Link>}>Erholungsstatus</SectionTitle>
      <Card className="p-4">
        <BodyMap
          mode="recovery"
          values={Object.fromEntries(MUSCLES.map((m) => [m.id, recovery[m.id].lastAt ? Math.max(0.01, recovery[m.id].recovery) : 0]))}
          renderInfo={(m) => {
            const r = recovery[m]
            return r.lastAt ? `${Math.round(r.recovery * 100)} % erholt · trainiert ${relDay(new Date(r.lastAt))}` : 'zuletzt nicht trainiert – bereit'
          }}
          legend={
            <span className="inline-flex gap-3 text-xs text-muted">
              <Legend c="var(--bad)" t="erschöpft" />
              <Legend c="var(--warn)" t="erholt sich" />
              <Legend c="var(--good)" t="bereit" />
            </span>
          }
        />
      </Card>

      {recent.length > 0 && (
        <>
          <SectionTitle action={<Link to="/stats" className="text-sm text-accent font-semibold">Alle</Link>}>Letzte Trainings</SectionTitle>
          <Card className="divide-y divide-line">
            {recent.map((w) => {
              const ws = sets.filter((x) => x.workout_id === w.id)
              return (
                <Link key={w.id} to={`/stats/workout/${w.id}`} className="flex items-center gap-3 p-3.5 hover:bg-surface-2/50">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{w.name}</div>
                    <div className="text-xs text-muted">
                      {relDay(w.started_at)} · {fmtDuration(w.duration_s)}
                      {ws.length > 0 && ` · ${ws.length} Sätze · ${fmtVolume(workoutVolume(ws))}`}
                    </div>
                  </div>
                  {w.kind === 'attendance' && <Badge tone="muted">Check-in</Badge>}
                  <Icon name="chevronRight" size={16} className="text-muted" />
                </Link>
              )
            })}
          </Card>
        </>
      )}

      <QuickLogSheet open={!!quickFor} routineId={quickFor} onClose={() => setQuickFor(null)} weekStart={weekStart} />
    </div>
  )
}

const Legend = ({ c, t }: { c: string; t: string }) => (
  <span className="inline-flex items-center gap-1">
    <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
    {t}
  </span>
)
