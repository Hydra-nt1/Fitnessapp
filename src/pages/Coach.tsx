import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { queryClient, save } from '../lib/api'
import { isDemo, supabase, uid } from '../lib/db'
import { addDays, isoDate, startOfWeek, WEEKDAYS } from '../lib/date'
import { exerciseHistory, fmtKg, muscleRecovery, muscleVolume, personalRecords } from '../lib/training'
import { DEFAULT_SETTINGS, type AppSettings, type BodyMetric, type QuickLog, type Routine, type RoutineExercise, type WeekPlanDay, type Workout, type WorkoutSet } from '../lib/types'
import { MUSCLES } from '../data/exercises'
import { Button, IconButton, cx, toast } from '../components/ui'
import { Icon } from '../components/icons'

interface Proposal {
  name: string
  muscle_group?: string
  exercises: { name: string; sets: number; reps_min: number; reps_max: number; weight?: number; note?: string }[]
}
interface Msg {
  role: 'user' | 'assistant'
  content: string
  proposals?: Proposal[]
  created?: string[]
}

const CHIPS = ['Analysiere meine letzte Trainingswoche', 'Welche Muskeln vernachlässige ich?', 'Wie komme ich beim Bankdrücken weiter?', 'Erstelle mir einen 3er-Split für Muskelaufbau', 'Was sollte ich heute trainieren?', 'Tipps für Regeneration & Schlaf']

const load = (): Msg[] => {
  try {
    return JSON.parse(localStorage.getItem('ft_coach') || '[]')
  } catch {
    return []
  }
}

function buildContext(): string {
  const g = <T,>(k: string) => (queryClient.getQueryData<T[]>([k]) ?? []) as T[]
  const s: AppSettings = { ...DEFAULT_SETTINGS, ...(g<AppSettings>('app_settings')[0] ?? {}) }
  const workouts = g<Workout>('workouts')
  const sets = g<WorkoutSet>('workout_sets')
  const quick = g<QuickLog>('quick_logs')
  const routines = g<Routine>('routines').filter((r) => !r.archived)
  const re = g<RoutineExercise>('routine_exercises')
  const plan = g<WeekPlanDay>('week_plan')
  const metrics = g<BodyMetric>('body_metrics').sort((a, b) => b.measured_at.localeCompare(a.measured_at))
  const lines: string[] = []
  const age = s.birthday ? Math.floor((Date.now() - +new Date(s.birthday)) / (365.25 * 864e5)) : null
  lines.push(`Heute: ${WEEKDAYS[(new Date().getDay() + 6) % 7].label}, ${isoDate(new Date())}`)
  lines.push(
    `Profil: ${[s.display_name, age && `${age} Jahre`, s.sex && `Geschlecht ${s.sex}`, s.height_cm && `${s.height_cm} cm`, metrics.find((m) => m.weight)?.weight && `${metrics.find((m) => m.weight)!.weight} kg`, s.goal_weight && `Zielgewicht ${s.goal_weight} kg`, s.goal && `Ziel: ${s.goal}`, s.level && `Level: ${s.level}`, s.days_per_week && `${s.days_per_week} Trainingstage/Woche`, s.equipment && `Equipment: ${s.equipment}`].filter(Boolean).join(', ') || 'keine Angaben'}`,
  )
  const wts = metrics.filter((m) => m.weight).slice(0, 6)
  if (wts.length > 1) lines.push(`Gewichtsverlauf: ${wts.map((m) => `${isoDate(new Date(m.measured_at))}: ${m.weight} kg`).join('; ')}`)

  lines.push('\nTrainingspläne:')
  for (const r of routines) {
    const ex = re.filter((e) => e.routine_id === r.id).sort((a, b) => a.position - b.position)
    lines.push(`- ${r.name} (${r.muscle_group ?? '–'}): ${ex.map((e) => `${e.exercise_name} ${e.sets}×${e.reps_min}-${e.reps_max} @${e.weight}kg`).join(', ') || 'leer'}`)
  }
  lines.push(`Wochenplan: ${plan.filter((p) => p.routine_ids.length).sort((a, b) => a.weekday - b.weekday).map((p) => `${WEEKDAYS[p.weekday].short}: ${p.routine_ids.map((id) => routines.find((r) => r.id === id)?.name).filter(Boolean).join('+')}`).join(', ') || 'keiner'}`)

  const recent = [...workouts].sort((a, b) => b.started_at.localeCompare(a.started_at))
  lines.push(`\nTrainings gesamt: ${workouts.length}, letzte 4 Wochen: ${workouts.filter((w) => new Date(w.started_at) > addDays(new Date(), -28)).length}`)
  lines.push('Letzte Trainings:')
  for (const w of recent.slice(0, 8)) {
    const ws = sets.filter((x) => x.workout_id === w.id && x.set_type !== 'warmup')
    const by = new Map<string, string[]>()
    for (const x of ws) by.set(x.exercise_name, [...(by.get(x.exercise_name) ?? []), `${fmtKg(+x.weight)}×${x.reps}${x.rpe ? `@${x.rpe}` : ''}`])
    lines.push(`- ${isoDate(new Date(w.started_at))} ${w.name} (${Math.round((w.duration_s ?? 0) / 60)} min${w.kind === 'attendance' ? ', nur Check-in' : ''}): ${[...by.entries()].map(([n, v]) => `${n} ${v.join(' ')}`).join(' | ') || '–'}`)
  }
  const ws0 = startOfWeek()
  const weekIds = new Set(workouts.filter((w) => new Date(w.started_at) >= addDays(ws0, -7)).map((w) => w.id))
  const vol = muscleVolume(sets.filter((x) => weekIds.has(x.workout_id)))
  lines.push(`\nHarte Sätze pro Muskel (letzte ~2 Wochen inkl. aktueller): ${MUSCLES.map((m) => `${m.label} ${vol[m.id]}`).join(', ')}`)
  const rec = muscleRecovery(workouts, sets)
  lines.push(`Erholung jetzt: ${MUSCLES.filter((m) => rec[m.id].lastAt).map((m) => `${m.label} ${Math.round(rec[m.id].recovery * 100)}%`).join(', ') || 'alles erholt'}`)

  const names = [...new Set(sets.map((x) => x.exercise_name))]
  const prs = names
    .map((n) => ({ n, r: personalRecords(exerciseHistory(n, workouts, sets, quick)) }))
    .filter((x) => x.r.maxWeight > 0)
    .sort((a, b) => b.r.maxE1rm - a.r.maxE1rm)
    .slice(0, 10)
  if (prs.length) lines.push(`Bestleistungen: ${prs.map((x) => `${x.n} max ${x.r.maxWeight} kg (1RM≈${Math.round(x.r.maxE1rm)})`).join('; ')}`)
  return lines.join('\n')
}

export function CoachPage() {
  const nav = useNavigate()
  const [msgs, setMsgs] = useState<Msg[]>(load)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    localStorage.setItem('ft_coach', JSON.stringify(msgs.slice(-40)))
    end.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, busy])

  const send = async (text: string) => {
    if (!text.trim() || busy) return
    const next: Msg[] = [...msgs, { role: 'user', content: text.trim() }]
    setMsgs(next)
    setInput('')
    if (isDemo()) {
      setMsgs([...next, { role: 'assistant', content: 'Der KI-Coach ist im Demo-Modus nicht verfügbar – bitte mit deinem Konto anmelden.' }])
      return
    }
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('coach', {
        body: { messages: next.map((m) => ({ role: m.role, content: m.content })), context: buildContext() },
      })
      if (error) {
        let detail = ''
        try {
          detail = (await (error as any).context?.json())?.error ?? ''
        } catch {
          /* ignore */
        }
        throw new Error(detail || error.message)
      }
      setMsgs([...next, { role: 'assistant', content: data.reply || '…', proposals: data.proposals }])
    } catch (e: any) {
      const m = String(e?.message ?? e)
      setMsgs([...next, { role: 'assistant', content: `⚠️ ${/not found|404|Failed to send/i.test(m) ? 'Der Coach ist noch nicht eingerichtet (Edge Function „coach“ fehlt).' : m}` }])
    } finally {
      setBusy(false)
    }
  }

  const createRoutine = async (mi: number, p: Proposal) => {
    const id = uid()
    const count = (queryClient.getQueryData<Routine[]>(['routines']) ?? []).length
    await save('routines', { id, name: p.name, muscle_group: p.muscle_group ?? null, position: count, archived: false })
    await save(
      'routine_exercises',
      p.exercises.map((e, i) => ({ routine_id: id, exercise_name: e.name, position: i, sets: e.sets || 3, reps_min: e.reps_min || 8, reps_max: Math.max(e.reps_min || 8, e.reps_max || 12), weight: e.weight ?? 0, rest_seconds: null, superset_group: null, note: e.note ?? null })),
    )
    setMsgs((m) => m.map((x, i) => (i === mi ? { ...x, created: [...(x.created ?? []), p.name] } : x)))
    toast(`Plan „${p.name}“ angelegt`)
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-140px)] md:min-h-[calc(100dvh-40px)]">
      <header className="flex items-center gap-2 pt-5 pb-3">
        <div className="w-10 h-10 rounded-2xl bg-accent text-accent-ink grid place-items-center">
          <Icon name="sparkles" size={20} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-display font-bold leading-tight">KI-Coach</h1>
          <div className="text-xs text-muted">Kennt deine Pläne, Workouts & Erholung</div>
        </div>
        {msgs.length > 0 && <IconButton icon="trash" label="Verlauf löschen" onClick={() => setMsgs([])} />}
      </header>

      <div className="flex-1 flex flex-col gap-3 pb-4">
        {!msgs.length && (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">💬</div>
            <div className="font-bold text-lg">Frag mich alles rund ums Training</div>
            <div className="text-sm text-muted mt-1 mb-5">Ich analysiere deine Daten und kann dir Pläne direkt anlegen.</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {CHIPS.map((c) => (
                <button key={c} onClick={() => send(c)} className="px-3 py-2 rounded-xl bg-surface border border-line text-sm font-medium hover:border-accent text-left">
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cx('max-w-[88%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed', m.role === 'user' ? 'bg-accent text-accent-ink rounded-br-md' : 'bg-surface border border-line rounded-bl-md')}>
              {m.role === 'user' ? m.content : <Markdown text={m.content} />}
              {m.proposals?.map((p, j) => {
                const done = m.created?.includes(p.name)
                return (
                  <div key={j} className="mt-3 rounded-xl border border-line bg-surface-2/60 p-3">
                    <div className="font-bold flex items-center gap-2">
                      <Icon name="calendar" size={16} className="text-accent-fg" /> {p.name}
                      {p.muscle_group && <span className="text-xs text-muted font-medium">· {p.muscle_group}</span>}
                    </div>
                    <ul className="text-sm mt-1.5 space-y-0.5">
                      {p.exercises.map((e, k) => (
                        <li key={k} className="flex gap-2">
                          <span className="flex-1">{e.name}</span>
                          <span className="text-muted tabular">
                            {e.sets}×{e.reps_min === e.reps_max ? e.reps_min : `${e.reps_min}–${e.reps_max}`}
                            {e.weight ? ` · ${e.weight} kg` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Button size="sm" className="mt-2.5 w-full" variant={done ? 'secondary' : 'primary'} icon={done ? 'check' : 'plus'} disabled={done} onClick={() => createRoutine(i, p)}>
                      {done ? 'Angelegt' : 'Als Plan anlegen'}
                    </Button>
                    {done && (
                      <button className="text-xs text-accent-fg font-semibold mt-1.5 w-full" onClick={() => nav('/plan')}>
                        Zu meinen Plänen →
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex">
            <div className="bg-surface border border-line rounded-2xl rounded-bl-md px-4 py-3.5 flex gap-1">
              {[0, 1, 2].map((d) => (
                <span key={d} className="w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: `${d * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => (e.preventDefault(), send(input))}
        className="sticky bottom-[72px] md:bottom-4 flex items-end gap-2 p-2 bg-surface border border-line rounded-2xl shadow-xl"
      >
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(input)
            }
          }}
          placeholder="Nachricht an deinen Coach…"
          className="flex-1 resize-none bg-transparent outline-none px-2 py-2 max-h-32"
        />
        <button disabled={!input.trim() || busy} className="w-10 h-10 rounded-xl bg-accent text-accent-ink grid place-items-center disabled:opacity-40">
          <Icon name="send" size={18} />
        </button>
      </form>
    </div>
  )
}

/** Minimaler, sicherer Markdown-Renderer (keine HTML-Injection) */
function Markdown({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/)
  const inline = (s: string) => {
    const parts = s.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
    return parts.map((p, i) =>
      p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith('`') ? <code key={i} className="px-1 rounded bg-surface-2 text-[13px]">{p.slice(1, -1)}</code> : p.startsWith('*') && p.length > 2 ? <em key={i}>{p.slice(1, -1)}</em> : p,
    )
  }
  return (
    <div className="space-y-2.5">
      {blocks.map((b, i) => {
        const lines = b.split('\n')
        if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l)))
          return (
            <ul key={i} className="space-y-1">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-2">
                  <span className="text-accent-fg">•</span>
                  <span>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ''))}</span>
                </li>
              ))}
            </ul>
          )
        if (/^#{1,4}\s/.test(b)) return <div key={i} className="font-bold">{inline(b.replace(/^#+\s/, ''))}</div>
        if (/^\|/.test(b))
          return (
            <pre key={i} className="text-xs overflow-x-auto whitespace-pre">
              {b}
            </pre>
          )
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l.replace(/^#+\s/, ''))}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}
