import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSettings, useRows } from '../lib/api'
import { fmtClock } from '../lib/date'
import { detectPRs, e1rm, fmtKg, fmtSet, fmtVolume, platesFor, suggestNext, warmupSets, type PR } from '../lib/training'
import { exerciseInfo, groupColor } from '../data/exercises'
import { buildExercise, historyFor } from '../state/actions'
import { activeStore, buildRecords, newSet, persistWorkout, startRest, stopRest, updateActive, useActive, type ActiveExercise, type ActiveSet } from '../state/workout'
import type { SetType } from '../lib/types'
import { ExercisePicker } from '../components/ExercisePicker'
import { QuickLogSheet } from '../components/QuickLogSheet'
import { Badge, Button, Card, Empty, IconButton, Sheet, cx, inputCls, toast, useConfirm } from '../components/ui'
import { Icon } from '../components/icons'

const TYPE_LABEL: Record<SetType, { short: string; label: string; cls: string }> = {
  warmup: { short: 'W', label: 'Aufwärmen', cls: 'text-warn' },
  normal: { short: '', label: 'Arbeitssatz', cls: '' },
  drop: { short: 'D', label: 'Dropsatz', cls: 'text-accent' },
  failure: { short: 'F', label: 'Bis Versagen', cls: 'text-bad' },
}

export function WorkoutPage() {
  const w = useActive()
  const nav = useNavigate()
  const s = useSettings()
  const [, tick] = useState(0)
  const [picker, setPicker] = useState<null | 'add' | { replace: number }>(null)
  const [finishOpen, setFinishOpen] = useState(false)
  const [summary, setSummary] = useState<null | { prs: PR[]; volume: number; sets: number; duration: number; name: string }>(null)
  const [plateFor, setPlateFor] = useState<number | null>(null)
  const [quickOpen, setQuickOpen] = useState(false)
  const [confirm, confirmNode] = useConfirm()

  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [])

  if (summary) return <Summary {...summary} onClose={() => (setSummary(null), nav('/'))} />
  if (!w)
    return (
      <Empty
        icon="dumbbell"
        title="Kein aktives Training"
        text="Starte ein Workout über „Heute“ oder einen Plan."
        action={
          <Button onClick={() => nav('/')} icon="home">
            Zu Heute
          </Button>
        }
      />
    )

  const done = w.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0)
  const total = w.exercises.reduce((a, e) => a + e.sets.length, 0)
  const volume = w.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done && x.type !== 'warmup').reduce((b, x) => b + x.weight * x.reps, 0), 0)

  const finish = async (note: string, rating: number | null) => {
    const { workout, sets } = buildRecords(w, { note, rating })
    const prs = w.kind === 'full' ? detectPRs(sets, (n) => historyFor(n)) : []
    setFinishOpen(false)
    setSummary({ prs, volume, sets: sets.length, duration: workout.duration_s ?? 0, name: workout.name })
    stopRest()
    activeStore.set(null)
    try {
      await persistWorkout(workout, sets)
    } catch {
      toast('Offline gespeichert – wird später synchronisiert')
    }
  }
  const discard = async () => {
    if (!(await confirm('Training verwerfen? Alle eingetragenen Sätze gehen verloren.', { danger: true, ok: 'Verwerfen' }))) return
    stopRest()
    activeStore.set(null)
    nav('/')
  }

  // ── Check-in (Anwesenheit) ──
  if (w.kind === 'attendance') {
    return (
      <div className="pt-8 text-center">
        <div className="text-sm text-muted font-semibold uppercase tracking-wider">Eingecheckt</div>
        <h1 className="text-2xl font-extrabold mt-1">{w.name}</h1>
        <div className="text-6xl font-extrabold tabular my-8">{fmtClock(Date.now() - w.startedAt)}</div>
        <div className="flex flex-col gap-2 max-w-xs mx-auto">
          <Button size="lg" icon="check" onClick={() => setFinishOpen(true)}>
            Training beenden
          </Button>
          {w.routineId && (
            <Button variant="secondary" icon="edit" onClick={() => setQuickOpen(true)}>
              Schnell-Log ausfüllen
            </Button>
          )}
          <Button
            variant="secondary"
            icon="dumbbell"
            onClick={() =>
              updateActive((x) => {
                x.kind = 'full'
              })
            }
          >
            Doch Sätze tracken
          </Button>
          <Button variant="ghost" onClick={discard}>
            Verwerfen
          </Button>
        </div>
        <QuickLogSheet open={quickOpen} routineId={w.routineId} onClose={() => setQuickOpen(false)} />
        <FinishSheet open={finishOpen} onClose={() => setFinishOpen(false)} onFinish={finish} openSets={0} />
        {confirmNode}
      </div>
    )
  }

  const toggleDone = (ei: number, si: number) => {
    const ex = w.exercises[ei]
    const st = ex.sets[si]
    const nowDone = !st.done
    updateActive((x) => {
      x.exercises[ei].sets[si].done = nowDone
    })
    if (nowDone) {
      // Supersatz: Pause erst nach der letzten Übung der Gruppe
      const g = ex.supersetGroup
      const nextInGroup = g && w.exercises[ei + 1]?.supersetGroup === g
      if (!nextInGroup) startRest(st.type === 'warmup' ? 45 : (ex.restSeconds ?? s.rest_seconds))
      navigator.vibrate?.(30)
    }
  }

  return (
    <div>
      <header className="sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-bg/90 backdrop-blur-xl border-b border-line flex items-center gap-2 safe-top">
        <div className="flex-1 min-w-0">
          <input
            className="bg-transparent font-extrabold text-lg w-full outline-none truncate"
            value={w.name}
            onChange={(e) =>
              updateActive((x) => {
                x.name = e.target.value
              })
            }
          />
          <div className="text-xs text-muted tabular flex gap-3">
            <span className="inline-flex items-center gap-1">
              <Icon name="timer" size={12} /> {fmtClock(Date.now() - w.startedAt)}
            </span>
            <span>
              {done}/{total} Sätze
            </span>
            <span>{fmtVolume(volume)}</span>
          </div>
        </div>
        <IconButton icon="trash" label="Verwerfen" onClick={discard} className="hover:text-bad" />
        <Button onClick={() => setFinishOpen(true)} icon="check">
          Fertig
        </Button>
      </header>
      <div className="h-1 -mx-4 md:-mx-8 bg-surface-2">
        <div className="h-full bg-accent transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>

      <div className="flex flex-col gap-3 mt-4">
        {w.exercises.map((ex, ei) => (
          <ExerciseCard
            key={ex.key}
            ex={ex}
            ei={ei}
            total={w.exercises.length}
            linkedNext={!!ex.supersetGroup && w.exercises[ei + 1]?.supersetGroup === ex.supersetGroup}
            linkedPrev={!!ex.supersetGroup && w.exercises[ei - 1]?.supersetGroup === ex.supersetGroup}
            onToggle={(si) => toggleDone(ei, si)}
            onPlates={(kg) => setPlateFor(kg)}
            onReplace={() => setPicker({ replace: ei })}
            increment={s.weight_increment}
            bar={s.bar_weight}
          />
        ))}
      </div>
      {!w.exercises.length && <Empty icon="dumbbell" title="Leeres Workout" text="Füge deine erste Übung hinzu." />}
      <Button variant="soft" icon="plus" size="lg" className="w-full mt-4" onClick={() => setPicker('add')}>
        Übung hinzufügen
      </Button>

      <ExercisePicker
        open={!!picker}
        multi={picker === 'add'}
        title={picker === 'add' ? 'Übung hinzufügen' : 'Übung ersetzen'}
        onClose={() => setPicker(null)}
        exclude={w.exercises.map((e) => e.name)}
        onPick={(names) => {
          updateActive((x) => {
            if (picker && typeof picker === 'object') {
              const old = x.exercises[picker.replace]
              const nx = buildExercise(names[0])
              x.exercises[picker.replace] = { ...nx, supersetGroup: old.supersetGroup }
            } else x.exercises.push(...names.map((n) => buildExercise(n)))
          })
        }}
      />
      <PlateSheet kg={plateFor} bar={s.bar_weight} onClose={() => setPlateFor(null)} />
      <FinishSheet open={finishOpen} onClose={() => setFinishOpen(false)} onFinish={finish} openSets={total - done} />
      {confirmNode}
    </div>
  )
}

function ExerciseCard({
  ex,
  ei,
  total,
  linkedNext,
  linkedPrev,
  onToggle,
  onPlates,
  onReplace,
  increment,
  bar,
}: {
  ex: ActiveExercise
  ei: number
  total: number
  linkedNext: boolean
  linkedPrev: boolean
  onToggle: (si: number) => void
  onPlates: (kg: number) => void
  onReplace: () => void
  increment: number
  bar: number
}) {
  const [menu, setMenu] = useState(false)
  const [typeFor, setTypeFor] = useState<number | null>(null)
  const [showNote, setShowNote] = useState(!!ex.note)
  const info = exerciseInfo(ex.name)
  const hist = useMemo(() => historyFor(ex.name), [ex.name])
  const last = hist[0]
  const sugg = useMemo(() => suggestNext(ex.target ? { reps_min: ex.target.repsMin, reps_max: ex.target.repsMax, weight: ex.target.weight, sets: ex.sets.length } : null, hist, increment), [hist, ex.target, ex.sets.length, increment])
  const best = hist.length ? Math.max(...hist.map((h) => h.bestE1rm)) : 0
  const upd = (fn: (e: ActiveExercise) => void) =>
    updateActive((x) => {
      fn(x.exercises[ei])
    })
  const setVal = (si: number, patch: Partial<ActiveSet>) => upd((e) => Object.assign(e.sets[si], patch))
  const workTop = Math.max(0, ...ex.sets.filter((x) => x.type !== 'warmup').map((x) => x.weight))
  let workIdx = 0

  return (
    <Card className={cx('overflow-hidden', linkedPrev && 'rounded-t-md -mt-2.5 border-t-dashed', linkedNext && 'rounded-b-md')}>
      {linkedPrev ? null : ex.supersetGroup && linkedNext ? (
        <div className="px-4 pt-2.5 -mb-1 text-[11px] font-bold text-accent uppercase tracking-wider flex items-center gap-1">
          <Icon name="link" size={11} /> Supersatz
        </div>
      ) : null}
      <div className="flex items-start gap-2 p-4 pb-2">
        <div className="flex-1 min-w-0">
          <Link to={`/exercises/${encodeURIComponent(ex.name)}`} className="font-bold text-[16px] leading-snug hover:text-accent">
            <span className="inline-block w-2 h-2 rounded-full mr-1.5 -translate-y-0.5" style={{ background: groupColor(info.group) }} />
            {ex.name}
          </Link>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {last && (
              <span className="text-xs text-muted tabular">
                Zuletzt: {last.sets.map((x) => fmtSet(x.weight, x.reps)).join(', ')}
              </span>
            )}
          </div>
          {hist.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge tone={sugg.trend === 'up' ? 'good' : sugg.trend === 'down' ? 'warn' : 'muted'}>{sugg.reason}</Badge>
              {best > 0 && <Badge tone="muted">1RM ≈ {fmtKg(Math.round(best))} kg</Badge>}
            </div>
          )}
        </div>
        <IconButton icon="more" label="Optionen" onClick={() => setMenu(true)} className="-mr-2 -mt-1" />
      </div>
      {showNote && (
        <div className="px-4 pb-2">
          <input
            className={cx(inputCls, 'h-9 text-sm')}
            placeholder="Notiz (Sitzhöhe, Griff …)"
            value={ex.note}
            onChange={(e) =>
              upd((x) => {
                x.note = e.target.value
              })
            }
          />
        </div>
      )}

      <div className="px-2 pb-2">
        <div className="grid grid-cols-[36px_1fr_1fr_1fr_44px] gap-1.5 px-2 text-[10.5px] font-bold text-muted uppercase tracking-wider">
          <span className="text-center">Satz</span>
          <span className="text-center">kg</span>
          <span className="text-center">Wdh.</span>
          <span className="text-center">RPE</span>
          <span />
        </div>
        {ex.sets.map((st, si) => {
          const label = st.type === 'normal' ? String(++workIdx) : TYPE_LABEL[st.type].short
          const est = st.weight && st.reps ? e1rm(st.weight, st.reps) : 0
          const isPR = st.done && st.type !== 'warmup' && best > 0 && est > best + 0.01
          return (
            <div key={st.id} className={cx('grid grid-cols-[36px_1fr_1fr_1fr_44px] gap-1.5 items-center px-2 py-1 rounded-xl transition', st.done && 'bg-good/10')}>
              <button onClick={() => setTypeFor(si)} className={cx('h-9 rounded-lg font-extrabold text-sm', TYPE_LABEL[st.type].cls || 'text-muted', 'hover:bg-surface-2')}>
                {label}
              </button>
              <SetInput value={st.weight} decimals onChange={(v) => setVal(si, { weight: v })} done={st.done} />
              <SetInput value={st.reps} onChange={(v) => setVal(si, { reps: v })} done={st.done} />
              <select
                value={st.rpe ?? ''}
                onChange={(e) => setVal(si, { rpe: e.target.value ? Number(e.target.value) : null })}
                className={cx('h-9 rounded-lg text-center font-semibold text-sm bg-surface-2 border border-transparent appearance-none outline-none focus:border-accent', !st.rpe && 'text-muted/60', st.done && 'bg-transparent')}
              >
                <option value="">–</option>
                {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((r) => (
                  <option key={r} value={r}>
                    {String(r).replace('.', ',')}
                  </option>
                ))}
              </select>
              <button onClick={() => onToggle(si)} className={cx('h-9 rounded-lg grid place-items-center transition active:scale-90 relative', st.done ? 'bg-good text-white' : 'bg-surface-2 text-muted hover:text-fg')}>
                <Icon name="check" size={18} strokeWidth={3} />
                {isPR && <span className="absolute -top-1.5 -right-1.5 text-[10px]">🏆</span>}
              </button>
            </div>
          )
        })}
        <div className="flex gap-1.5 px-2 pt-1.5">
          <Button
            size="sm"
            variant="ghost"
            icon="plus"
            className="flex-1"
            onClick={() =>
              upd((e) => {
                const lastSet = e.sets[e.sets.length - 1]
                e.sets.push(newSet({ weight: lastSet?.weight ?? 0, reps: lastSet?.reps ?? 10 }))
              })
            }
          >
            Satz
          </Button>
          {workTop > bar && (
            <Button size="sm" variant="ghost" icon="calc" onClick={() => onPlates(workTop)}>
              Scheiben
            </Button>
          )}
        </div>
      </div>

      <Sheet open={typeFor != null} onClose={() => setTypeFor(null)} title="Satztyp">
        <div className="flex flex-col gap-1.5">
          {(Object.keys(TYPE_LABEL) as SetType[]).map((t) => (
            <button
              key={t}
              onClick={() => (typeFor != null && setVal(typeFor, { type: t }), setTypeFor(null))}
              className={cx('flex items-center gap-3 p-3 rounded-xl border text-left', typeFor != null && ex.sets[typeFor]?.type === t ? 'border-accent accent-soft' : 'border-line')}
            >
              <span className={cx('w-8 text-center font-extrabold', TYPE_LABEL[t].cls)}>{TYPE_LABEL[t].short || '1'}</span>
              <span className="font-semibold">{TYPE_LABEL[t].label}</span>
            </button>
          ))}
          <Button
            variant="danger"
            icon="trash"
            className="mt-2"
            onClick={() => {
              if (typeFor != null) upd((e) => void e.sets.splice(typeFor, 1))
              setTypeFor(null)
            }}
          >
            Satz löschen
          </Button>
        </div>
      </Sheet>

      <Sheet open={menu} onClose={() => setMenu(false)} title={ex.name}>
        <div className="flex flex-col gap-1">
          <MenuItem
            icon="flame"
            label="Aufwärmsätze einfügen"
            sub={workTop > bar ? warmupSets(workTop, bar).map((x) => `${fmtKg(x.weight)}×${x.reps}`).join(' · ') : 'Erst Arbeitsgewicht eintragen'}
            disabled={workTop <= bar}
            onClick={() => {
              upd((e) => void e.sets.unshift(...warmupSets(workTop, bar).map((x) => newSet({ ...x, type: 'warmup' }))))
              setMenu(false)
            }}
          />
          <MenuItem
            icon="sparkles"
            label="Vorschlag übernehmen"
            sub={`${fmtKg(sugg.weight)} kg × ${sugg.reps} für alle Arbeitssätze`}
            disabled={!hist.length}
            onClick={() => {
              upd((e) => e.sets.forEach((x) => x.type === 'normal' && !x.done && Object.assign(x, { weight: sugg.weight, reps: sugg.reps })))
              setMenu(false)
            }}
          />
          <MenuItem icon="edit" label={showNote ? 'Notiz ausblenden' : 'Notiz hinzufügen'} onClick={() => (setShowNote(!showNote), setMenu(false))} />
          <MenuItem
            icon="link"
            label={linkedNext ? 'Supersatz mit nächster Übung lösen' : 'Supersatz mit nächster Übung'}
            disabled={ei >= total - 1}
            onClick={() => {
              updateActive((x) => {
                const a = x.exercises[ei]
                const b = x.exercises[ei + 1]
                if (linkedNext) b.supersetGroup = null
                else {
                  const g = a.supersetGroup ?? crypto.randomUUID().slice(0, 8)
                  a.supersetGroup = g
                  b.supersetGroup = g
                }
              })
              setMenu(false)
            }}
          />
          <MenuItem icon="refresh" label="Übung ersetzen" onClick={() => (onReplace(), setMenu(false))} />
          <div className="flex gap-1">
            <MenuItem
              icon="chevronUp"
              label="Nach oben"
              disabled={ei === 0}
              onClick={() => {
                updateActive((x) => void x.exercises.splice(ei - 1, 0, x.exercises.splice(ei, 1)[0]))
                setMenu(false)
              }}
            />
            <MenuItem
              icon="chevronDown"
              label="Nach unten"
              disabled={ei >= total - 1}
              onClick={() => {
                updateActive((x) => void x.exercises.splice(ei + 1, 0, x.exercises.splice(ei, 1)[0]))
                setMenu(false)
              }}
            />
          </div>
          <MenuItem
            icon="trash"
            label="Übung entfernen"
            danger
            onClick={() => {
              updateActive((x) => void x.exercises.splice(ei, 1))
              setMenu(false)
            }}
          />
        </div>
      </Sheet>
    </Card>
  )
}

function SetInput({ value, onChange, decimals, done }: { value: number; onChange: (v: number) => void; decimals?: boolean; done: boolean }) {
  const [txt, setTxt] = useState(String(value ?? ''))
  useEffect(() => setTxt(value ? String(value).replace('.', ',') : value === 0 ? '0' : ''), [value])
  return (
    <input
      inputMode={decimals ? 'decimal' : 'numeric'}
      className={cx('h-9 w-full min-w-0 rounded-lg text-center font-bold tabular outline-none border border-transparent focus:border-accent', done ? 'bg-transparent' : 'bg-surface-2')}
      value={txt}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        setTxt(e.target.value)
        const n = Number(e.target.value.replace(',', '.'))
        if (!isNaN(n)) onChange(n)
      }}
    />
  )
}

function MenuItem({ icon, label, sub, onClick, disabled, danger }: { icon: Parameters<typeof Icon>[0]['name']; label: string; sub?: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className={cx('flex-1 flex items-center gap-3 p-3 rounded-xl hover:bg-surface-2 text-left disabled:opacity-35', danger && 'text-bad')}>
      <Icon name={icon} size={19} className={danger ? '' : 'text-muted'} />
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-[15px]">{label}</span>
        {sub && <span className="block text-xs text-muted truncate">{sub}</span>}
      </span>
    </button>
  )
}

function PlateSheet({ kg, bar, onClose }: { kg: number | null; bar: number; onClose: () => void }) {
  const [target, setTarget] = useState(kg ?? 60)
  useEffect(() => {
    if (kg) setTarget(kg)
  }, [kg])
  const { plates, rest } = platesFor(target, bar)
  const colors: Record<number, string> = { 25: '#ef4444', 20: '#3b82f6', 15: '#eab308', 10: '#22c55e', 5: '#e5e7eb', 2.5: '#64748b', 1.25: '#94a3b8' }
  return (
    <Sheet open={kg != null} onClose={onClose} title="Scheibenrechner">
      <div className="flex items-center gap-2 mb-4">
        <input className={inputCls + ' text-center text-xl font-extrabold'} inputMode="decimal" value={target} onChange={(e) => setTarget(Number(e.target.value.replace(',', '.')) || 0)} />
        <span className="text-muted font-semibold">kg</span>
      </div>
      <div className="text-sm text-muted text-center mb-3">Pro Seite bei {bar} kg Stange:</div>
      <div className="flex items-center justify-center h-28 gap-[3px]">
        <div className="h-3 w-12 bg-surface-3 rounded-l" />
        {plates.map((p, i) => (
          <div key={i} className="rounded-sm grid place-items-center text-[10px] font-extrabold text-black/70" style={{ background: colors[p], width: p >= 10 ? 18 : 12, height: 40 + p * 2.6 }}>
            <span className="-rotate-90">{fmtKg(p)}</span>
          </div>
        ))}
        <div className="h-3 w-6 bg-surface-3 rounded-r" />
      </div>
      <div className="text-center mt-3 font-semibold">{plates.length ? plates.map(fmtKg).join(' + ') : 'Nur die Stange'}</div>
      {rest > 0 && <div className="text-center text-warn text-sm mt-1">{fmtKg(rest)} kg nicht exakt darstellbar</div>}
    </Sheet>
  )
}

function FinishSheet({ open, onClose, onFinish, openSets }: { open: boolean; onClose: () => void; onFinish: (note: string, rating: number | null) => void; openSets: number }) {
  const [note, setNote] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Training abschließen"
      footer={
        <Button className="flex-1" size="lg" icon="check" onClick={() => onFinish(note, rating)}>
          Speichern
        </Button>
      }
    >
      {openSets > 0 && <div className="text-sm text-warn mb-3">{openSets} Satz/Sätze nicht abgehakt – diese werden nicht gespeichert.</div>}
      <div className="text-[12px] font-semibold text-muted mb-1.5 uppercase tracking-wide">Wie lief's?</div>
      <div className="flex gap-2 mb-4">
        {['😫', '😕', '😐', '🙂', '🔥'].map((e, i) => (
          <button key={i} onClick={() => setRating(i + 1)} className={cx('flex-1 h-12 rounded-xl text-2xl border transition', rating === i + 1 ? 'border-accent accent-soft scale-105' : 'border-line bg-surface-2/50 grayscale-[60%]')}>
            {e}
          </button>
        ))}
      </div>
      <textarea className={inputCls + ' h-20 py-2.5 resize-none'} placeholder="Notiz zum Training (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
    </Sheet>
  )
}

function Summary({ prs, volume, sets, duration, name, onClose }: { prs: PR[]; volume: number; sets: number; duration: number; name: string; onClose: () => void }) {
  const workouts = useRows('workouts')
  return (
    <div className="pt-10 text-center anim-pop">
      <div className="text-6xl mb-3">{prs.length ? '🏆' : '💪'}</div>
      <h1 className="text-3xl font-extrabold">Stark gemacht!</h1>
      <div className="text-muted mt-1">
        {name} · Training Nr. {workouts.length}
      </div>
      <div className={cx('grid gap-2 mt-7 mx-auto', sets ? 'grid-cols-3 max-w-md' : 'grid-cols-1 max-w-[160px]')}>
        <Card className="p-3">
          <div className="text-xl font-extrabold tabular">{fmtClock(duration * 1000)}</div>
          <div className="text-xs text-muted">Dauer</div>
        </Card>
        {sets > 0 && (
          <>
        <Card className="p-3">
          <div className="text-xl font-extrabold tabular">{sets}</div>
          <div className="text-xs text-muted">Sätze</div>
        </Card>
        <Card className="p-3">
          <div className="text-xl font-extrabold tabular">{fmtVolume(volume)}</div>
          <div className="text-xs text-muted">Volumen</div>
        </Card>
          </>
        )}
      </div>
      {prs.length > 0 && (
        <Card className="p-4 mt-4 max-w-md mx-auto text-left border-warn/40">
          <div className="font-bold mb-2">Neue Bestleistungen</div>
          {prs.map((p, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 text-sm">
              <span>🏆</span>
              <span className="flex-1 font-semibold truncate">{p.exercise}</span>
              <Badge tone="warn">
                {p.kind}: {p.kind === 'Volumen' ? fmtVolume(p.value) : `${fmtKg(Math.round(p.value * 10) / 10)} kg`}
              </Badge>
            </div>
          ))}
        </Card>
      )}
      <Button size="lg" className="mt-8 min-w-48" onClick={onClose}>
        Weiter
      </Button>
    </div>
  )
}
