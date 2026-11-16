import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useRows, useSettings } from '../lib/api'
import { addDays, fmtDuration, isoDate, relDay, sameDay, startOfWeek, weekdayOf, WEEKDAYS, weekLabel } from '../lib/date'
import { fmtVolume, muscleRecovery, plannedDayStreak, weekStreak, workoutVolume } from '../lib/training'
import { exerciseInfo, groupColor, MUSCLE_LABEL, MUSCLES, type Muscle } from '../data/exercises'
import { startRoutineWorkout } from '../state/actions'
import { useActive } from '../state/workout'
import { BodyMap } from '../components/BodyMap'
import { QuickLogSheet } from '../components/QuickLogSheet'
import { Badge, Button, Card, SectionTitle, cx, toast } from '../components/ui'
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
  const isToday = sameDay(selDate, today)
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
    else toast('Eingecheckt – viel Spaß! 💪')
  }

  const hour = today.getHours()
  const greet = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hey' : 'Guten Abend'
  const name = s.display_name?.split(' ')[0]
  const recent = [...workouts].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 4)
  const [hero, ...more] = selRoutines

  return (
    <div>
      {/* Kopfbereich */}
      <header className="pt-6 pb-5 anim-rise">
        <div className="flex items-center justify-between">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{today.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <div className="flex items-center gap-2">
            <button onClick={() => nav('/search')} className="w-10 h-10 rounded-full bg-surface-2 border border-line grid place-items-center text-muted hover:text-fg" aria-label="Suche">
              <Icon name="search" size={18} />
            </button>
            <button onClick={() => nav('/profile')} className="w-10 h-10 rounded-full bg-fg text-bg grid place-items-center font-display font-bold" aria-label="Profil">
              {(name ?? 'F')[0].toUpperCase()}
            </button>
          </div>
        </div>
        <h1 className="font-display text-[40px] leading-[1] font-bold mt-3">
          {greet}
          {name ? ',' : ''}
          <br />
          <span className="text-muted">{name ?? 'bereit?'}</span>
        </h1>
      </header>

      {/* Wochenleiste */}
      <div className="flex items-center justify-between mb-2.5 px-1">
        <button className="text-[15px] font-semibold" onClick={() => (setWeekOff(0), setSelDay(weekdayOf(new Date())))}>
          {weekLabel(weekStart)}
        </button>
        <div className="flex gap-1">
          <button onClick={() => setWeekOff(weekOff - 1)} className="w-8 h-8 rounded-full bg-surface-2 grid place-items-center text-muted hover:text-fg" aria-label="Vorherige Woche">
            <Icon name="chevronLeft" size={16} />
          </button>
          <button onClick={() => setWeekOff(weekOff + 1)} className="w-8 h-8 rounded-full bg-surface-2 grid place-items-center text-muted hover:text-fg" aria-label="Nächste Woche">
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d, i) => {
          const date = addDays(weekStart, i)
          const done = (byDay.get(isoDate(date)) ?? []).length > 0
          const planned = planFor(i)
          const tday = sameDay(date, today)
          const sel = i === selDay
          return (
            <button
              key={i}
              onClick={() => setSelDay(i)}
              className={cx(
                'flex flex-col items-center pt-2 pb-2.5 rounded-[20px] border transition',
                sel ? 'bg-fg text-bg border-fg' : done ? 'bg-accent/12 border-accent/30' : 'bg-surface border-line',
              )}
            >
              <span className={cx('text-[11px] font-semibold', sel ? 'opacity-60' : 'text-muted')}>{d.short}</span>
              <span className={cx('font-display text-[19px] font-bold tabular leading-tight', tday && !sel && 'text-accent-fg')}>{date.getDate()}</span>
              <span className="h-3 flex items-center gap-0.5 mt-0.5">
                {done ? (
                  <span className={cx('w-4 h-4 rounded-full grid place-items-center', sel ? 'bg-accent text-accent-ink' : 'bg-accent text-accent-ink')}>
                    <Icon name="check" size={10} strokeWidth={4} />
                  </span>
                ) : (
                  planned.slice(0, 3).map((r) => <span key={r.id} className="w-1.5 h-1.5 rounded-full" style={{ background: groupColor(r.muscle_group) }} />)
                )}
              </span>
            </button>
          )
        })}
      </div>

      {/* Hero: Training des gewählten Tages */}
      <div className="mt-5 flex flex-col gap-3">
        {selDone.map((w) => (
          <Card key={w.id} className="p-4 flex items-center gap-3" onClick={() => nav(`/stats/workout/${w.id}`)}>
            <span className="w-11 h-11 rounded-full bg-accent text-accent-ink grid place-items-center">
              <Icon name="check" size={20} strokeWidth={3} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{w.name}</div>
              <div className="text-[13px] text-muted">
                Erledigt · {fmtDuration(w.duration_s)}
                {w.kind === 'attendance' && ' · Check-in'}
              </div>
            </div>
            <Icon name="chevronRight" size={18} className="text-muted" />
          </Card>
        ))}

        {hero ? (
          <HeroCard routine={hero} exNames={routineEx.filter((e) => e.routine_id === hero.id).sort((a, b) => a.position - b.position).map((e) => e.exercise_name)} label={isToday ? 'Heute dran' : `${WEEKDAYS[selDay].label}`} onStart={() => start(hero.id)} onCheckIn={() => start(hero.id, 'attendance')} onQuick={() => setQuickFor(hero.id)} onOpen={() => nav(`/plan/${hero.id}`)} />
        ) : (
          !selDone.length && (
            <div className="rounded-[28px] border border-dashed border-line p-6 text-center">
              <div className="text-4xl mb-2">🧘</div>
              <div className="font-display text-2xl font-bold">Ruhetag</div>
              <div className="text-[15px] text-muted mt-1 mb-5">Regeneration ist Teil des Trainings.</div>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button icon="play" onClick={() => start(null)}>
                  Freies Workout
                </Button>
                <Button icon="calendar" variant="secondary" onClick={() => nav('/plan')}>
                  Woche planen
                </Button>
              </div>
            </div>
          )
        )}
        {more.map((r) => (
          <Card key={r.id} className="p-4 flex items-center gap-3">
            <span className="w-2.5 h-10 rounded-full" style={{ background: groupColor(r.muscle_group) }} />
            <Link to={`/plan/${r.id}`} className="flex-1 min-w-0">
              <div className="font-semibold truncate">{r.name}</div>
              <div className="text-[13px] text-muted">{routineEx.filter((e) => e.routine_id === r.id).length} Übungen</div>
            </Link>
            <Button size="sm" icon="play" onClick={() => start(r.id)}>
              Start
            </Button>
          </Card>
        ))}
      </div>

      {/* Bento */}
      <SectionTitle>Deine Woche</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 row-span-2 flex flex-col justify-between">
          <div className="text-[13px] text-muted font-medium">Trainings</div>
          <div className="grid place-items-center my-3">
            <Ring value={thisWeek.length / Math.max(1, plannedCount)} size={118} stroke={12}>
              <div className="text-center">
                <div className="font-display text-[34px] font-bold tabular leading-none">{thisWeek.length}</div>
                <div className="text-[12px] text-muted mt-1">von {plannedCount}</div>
              </div>
            </Ring>
          </div>
          <div className="text-[13px] text-muted">{thisWeek.length >= plannedCount ? 'Wochenziel erreicht 🎉' : `Noch ${plannedCount - thisWeek.length} bis zum Ziel`}</div>
        </Card>
        <Card className="p-4 hero-accent grain border-transparent overflow-hidden">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold opacity-70">
            <Icon name="flame" size={15} /> Serie
          </div>
          <div className="font-display text-[44px] font-bold tabular leading-none mt-2">{dStreak}</div>
          <div className="text-[12px] font-medium opacity-70 mt-1">Trainingstage · {wStreak} Wo.</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-[13px] text-muted font-medium">
            <Icon name="dumbbell" size={15} /> Volumen
          </div>
          <div className="font-display text-[30px] font-bold tabular leading-none mt-2">{fmtVolume(weekVol)}</div>
          <div className="text-[12px] text-muted mt-1">diese Woche</div>
        </Card>
      </div>

      <SectionTitle action={<Link to="/stats" className="text-[13px] font-semibold text-muted hover:text-fg">Details →</Link>}>Erholung</SectionTitle>
      <Card className="p-5">
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <span className="font-display text-[30px] font-bold tabular">{fresh}</span>
            <span className="text-muted"> / {MUSCLES.length} Muskeln bereit</span>
          </div>
        </div>
        <BodyMap
          mode="recovery"
          values={Object.fromEntries(MUSCLES.map((m) => [m.id, recovery[m.id].lastAt ? Math.max(0.01, recovery[m.id].recovery) : 0]))}
          renderInfo={(m) => {
            const r = recovery[m]
            return r.lastAt ? `${Math.round(r.recovery * 100)} % erholt · ${relDay(new Date(r.lastAt))}` : 'bereit'
          }}
          legend={
            <span className="inline-flex gap-3 text-xs text-muted">
              <Legend c="var(--bad)" t="erschöpft" />
              <Legend c="var(--warn)" t="erholt sich" />
              <Legend c="color-mix(in srgb, var(--accent) 45%, var(--surface-3))" t="bereit" />
            </span>
          }
        />
      </Card>

      {recent.length > 0 && (
        <>
          <SectionTitle action={<Link to="/stats" className="text-[13px] font-semibold text-muted hover:text-fg">Alle →</Link>}>Zuletzt</SectionTitle>
          <div className="flex flex-col gap-2">
            {recent.map((w) => {
              const ws = sets.filter((x) => x.workout_id === w.id)
              const d = new Date(w.started_at)
              return (
                <Link key={w.id} to={`/stats/workout/${w.id}`} className="flex items-center gap-3.5 p-3 pr-4 bg-surface border border-line rounded-[22px] hover:border-surface-3 transition">
                  <div className="w-12 h-12 rounded-2xl bg-surface-2 grid place-items-center text-center leading-none">
                    <div>
                      <div className="font-display text-[17px] font-bold">{d.getDate()}</div>
                      <div className="text-[10px] text-muted uppercase mt-0.5">{d.toLocaleDateString('de-DE', { month: 'short' }).replace('.', '')}</div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{w.name}</div>
                    <div className="text-[13px] text-muted truncate">
                      {relDay(w.started_at)} · {fmtDuration(w.duration_s)}
                      {ws.length > 0 && ` · ${fmtVolume(workoutVolume(ws))}`}
                    </div>
                  </div>
                  {w.kind === 'attendance' && <Badge tone="muted">Check-in</Badge>}
                  <Icon name="chevronRight" size={16} className="text-muted" />
                </Link>
              )
            })}
          </div>
        </>
      )}

      <QuickLogSheet open={!!quickFor} routineId={quickFor} onClose={() => setQuickFor(null)} weekStart={weekStart} />
    </div>
  )
}

function HeroCard({ routine, exNames, label, onStart, onCheckIn, onQuick, onOpen }: { routine: { name: string; muscle_group: string | null }; exNames: string[]; label: string; onStart: () => void; onCheckIn: () => void; onQuick: () => void; onOpen: () => void }) {
  const muscles = useMemo(() => {
    const set = new Set<Muscle>()
    for (const n of exNames) exerciseInfo(n).primary.forEach((m) => set.add(m))
    return [...set].slice(0, 4)
  }, [exNames])
  return (
    <div className="hero-accent grain rounded-[30px] p-5 pt-4 overflow-hidden anim-rise shadow-[0_24px_60px_-28px_var(--accent)]">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-[0.14em] opacity-60">{label}</span>
        <button onClick={onOpen} className="w-9 h-9 rounded-full bg-black/10 grid place-items-center" aria-label="Plan öffnen">
          <Icon name="arrowRight" size={17} strokeWidth={2.4} />
        </button>
      </div>
      <button onClick={onOpen} className="block text-left font-display text-[38px] leading-[1] font-bold mt-2 break-words">
        {routine.name}
      </button>
      <div className="text-[14px] font-medium opacity-70 mt-1.5">
        {exNames.length} Übungen{routine.muscle_group ? ` · ${routine.muscle_group}` : ''}
      </div>
      {muscles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {muscles.map((m) => (
            <span key={m} className="h-7 px-3 rounded-full bg-black/10 text-[12px] font-semibold inline-flex items-center">
              {MUSCLE_LABEL[m]}
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2 mt-5">
        <button onClick={onStart} className="flex-1 h-14 rounded-full bg-[#0b0c08] text-white font-semibold text-[16px] inline-flex items-center justify-center gap-2 active:scale-[0.97] transition">
          <Icon name="play" size={18} strokeWidth={2.4} /> Workout starten
        </button>
        <button onClick={onCheckIn} className="w-14 h-14 rounded-full bg-black/10 grid place-items-center active:scale-90 transition" aria-label="Check-in" title="Check-in">
          <Icon name="checkin" size={20} strokeWidth={2.3} />
        </button>
        <button onClick={onQuick} className="w-14 h-14 rounded-full bg-black/10 grid place-items-center active:scale-90 transition" aria-label="Schnell-Log" title="Schnell-Log">
          <Icon name="edit" size={19} strokeWidth={2.3} />
        </button>
      </div>
    </div>
  )
}

const Legend = ({ c, t }: { c: string; t: string }) => (
  <span className="inline-flex items-center gap-1">
    <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
    {t}
  </span>
)
