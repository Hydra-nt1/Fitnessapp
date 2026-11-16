import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { remove, save, useRows } from '../lib/api'
import { WEEKDAYS, weekdayOf } from '../lib/date'
import { groupColor, PLAN_GROUPS, RECOMMENDED } from '../data/exercises'
import type { Routine } from '../lib/types'
import { uid } from '../lib/db'
import { Button, Card, Chip, Empty, Field, IconButton, PageHeader, SectionTitle, Sheet, cx, inputCls, toast, useConfirm } from '../components/ui'
import { Icon } from '../components/icons'

const TEMPLATES: { name: string; group: string; from: string[] }[] = [
  { name: 'Push', group: 'Push', from: ['Brust', 'Schultern', 'Trizeps'] },
  { name: 'Pull', group: 'Pull', from: ['Rücken', 'Bizeps'] },
  { name: 'Beine', group: 'Beine', from: ['Beine', 'Core'] },
  { name: 'Oberkörper', group: 'Oberkörper', from: ['Brust', 'Rücken', 'Schultern', 'Arme'] },
  { name: 'Unterkörper', group: 'Unterkörper', from: ['Beine', 'Core'] },
  { name: 'Ganzkörper', group: 'Ganzkörper', from: ['Ganzkörper', 'Brust', 'Rücken', 'Beine'] },
]

export function PlanPage() {
  const nav = useNavigate()
  const routines = useRows('routines')
  const plan = useRows('week_plan')
  const allRe = useRows('routine_exercises')
  const [assignDay, setAssignDay] = useState<number | null>(null)
  const [editing, setEditing] = useState<Partial<Routine> | null>(null)
  const [showTpl, setShowTpl] = useState(false)
  const [confirm, confirmNode] = useConfirm()
  const today = weekdayOf(new Date())
  const active = routines.filter((r) => !r.archived).sort((a, b) => a.position - b.position)

  const idsFor = (wd: number) => plan.find((p) => p.weekday === wd)?.routine_ids ?? []
  const toggle = (wd: number, rid: string) => {
    const cur = idsFor(wd)
    save('week_plan', { weekday: wd, routine_ids: cur.includes(rid) ? cur.filter((x) => x !== rid) : [...cur, rid] })
  }

  const saveRoutine = async () => {
    if (!editing?.name?.trim()) return
    const [r] = await save('routines', { ...editing, name: editing.name.trim(), position: editing.position ?? active.length, archived: false })
    setEditing(null)
    if (!editing.id) nav(`/plan/${r.id}`)
  }

  const fromTemplate = async (t: (typeof TEMPLATES)[number]) => {
    const id = uid()
    await save('routines', { id, name: t.name, muscle_group: t.group, position: active.length, archived: false })
    const picks: { name: string; sets: number; reps: number; weight: number }[] = []
    const per = t.from.length > 2 ? 2 : 3
    for (const g of t.from) picks.push(...(RECOMMENDED[g] ?? []).slice(0, per))
    await save(
      'routine_exercises',
      picks.slice(0, 7).map((p, i) => ({ routine_id: id, exercise_name: p.name, position: i, sets: p.sets, reps_min: Math.max(1, p.reps - 2), reps_max: p.reps + 2, weight: p.weight, rest_seconds: null, superset_group: null, note: null })),
    )
    setShowTpl(false)
    toast(`Plan „${t.name}“ angelegt`)
    nav(`/plan/${id}`)
  }

  const del = async (r: Routine) => {
    if (!(await confirm(`„${r.name}“ und alle Übungen darin löschen? Bisherige Workouts bleiben erhalten.`, { danger: true, ok: 'Löschen' }))) return
    for (const p of plan.filter((p) => p.routine_ids.includes(r.id))) await save('week_plan', { weekday: p.weekday, routine_ids: p.routine_ids.filter((x) => x !== r.id) })
    await remove('routines', r.id, ['routine_exercises', 'quick_logs'])
  }

  const move = async (i: number, d: -1 | 1) => {
    const list = [...active]
    const j = i + d
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    await save('routines', list.map((r, k) => ({ id: r.id, position: k })))
  }

  return (
    <div>
      <PageHeader title="Trainingsplan" subtitle="Wochenplan & Trainingspläne" />

      <SectionTitle>Wochenplan</SectionTitle>
      <Card className="divide-y divide-line">
        {WEEKDAYS.map((d, i) => {
          const rs = idsFor(i).map((id) => routines.find((r) => r.id === id)).filter((r): r is Routine => !!r)
          return (
            <div key={i} className="flex items-center gap-3 px-3.5 py-2.5">
              <div className={cx('w-10 text-sm font-bold', i === today ? 'text-accent-fg' : 'text-muted')}>{d.short}</div>
              <div className="flex-1 flex flex-wrap gap-1.5 min-w-0">
                {rs.length ? (
                  rs.map((r) => (
                    <button key={r.id} onClick={() => nav(`/plan/${r.id}`)} className="h-8 px-3 rounded-full text-[13px] font-semibold truncate max-w-full inline-flex items-center gap-1.5" style={{ background: `color-mix(in srgb, ${groupColor(r.muscle_group)} 16%, transparent)`, color: `color-mix(in srgb, ${groupColor(r.muscle_group)} 80%, var(--text))` }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: groupColor(r.muscle_group) }} />
                      {r.name}
                    </button>
                  ))
                ) : (
                  <span className="text-sm text-muted">Ruhetag</span>
                )}
              </div>
              <IconButton icon={rs.length ? 'edit' : 'plus'} label="Pläne zuweisen" onClick={() => setAssignDay(i)} />
            </div>
          )
        })}
      </Card>

      <SectionTitle
        action={
          <div className="flex gap-1.5">
            <Button size="sm" variant="secondary" icon="copy" onClick={() => setShowTpl(true)}>
              Vorlage
            </Button>
            <Button size="sm" icon="plus" onClick={() => setEditing({ name: '', muscle_group: null })}>
              Neu
            </Button>
          </div>
        }
      >
        Meine Pläne
      </SectionTitle>
      {!active.length && <Empty icon="dumbbell" title="Noch keine Pläne" text="Lege einen Plan an oder starte mit einer Vorlage wie Push/Pull/Beine." action={<Button onClick={() => setShowTpl(true)}>Vorlage wählen</Button>} />}
      <div className="flex flex-col gap-2">
        {active.map((r, i) => {
          const n = allRe.filter((e) => e.routine_id === r.id).length
          const days = plan.filter((p) => p.routine_ids.includes(r.id)).map((p) => WEEKDAYS[p.weekday].short)
          return (
            <Card key={r.id} className="flex items-center gap-3 p-3 pl-0 overflow-hidden" onClick={() => nav(`/plan/${r.id}`)}>
              <span className="w-1 self-stretch rounded-r" style={{ background: groupColor(r.muscle_group) }} />
              <div className="flex-1 min-w-0 pl-1">
                <div className="font-bold truncate">{r.name}</div>
                <div className="text-xs text-muted truncate">
                  {r.muscle_group ?? 'Allgemein'} · {n} Übung{n === 1 ? '' : 'en'}
                  {days.length > 0 && ` · ${days.join(', ')}`}
                </div>
              </div>
              <div className="flex" onClick={(e) => e.stopPropagation()}>
                <IconButton icon="chevronUp" label="Nach oben" onClick={() => move(i, -1)} disabled={i === 0} className="w-8 disabled:opacity-20" />
                <IconButton icon="chevronDown" label="Nach unten" onClick={() => move(i, 1)} disabled={i === active.length - 1} className="w-8 disabled:opacity-20" />
                <IconButton icon="edit" label="Bearbeiten" onClick={() => setEditing(r)} className="w-8" />
                <IconButton icon="trash" label="Löschen" onClick={() => del(r)} className="w-8 hover:text-bad" />
              </div>
            </Card>
          )
        })}
      </div>

      {/* Tag zuweisen */}
      <Sheet open={assignDay != null} onClose={() => setAssignDay(null)} title={assignDay != null ? `${WEEKDAYS[assignDay].label}` : ''} footer={<Button className="flex-1" onClick={() => setAssignDay(null)}>Fertig</Button>}>
        <p className="text-sm text-muted mb-3">Wähle einen oder mehrere Pläne. Nichts ausgewählt = Ruhetag.</p>
        <div className="flex flex-col gap-1.5">
          {active.map((r) => {
            const on = assignDay != null && idsFor(assignDay).includes(r.id)
            return (
              <button key={r.id} onClick={() => assignDay != null && toggle(assignDay, r.id)} className={cx('flex items-center gap-3 p-3 rounded-xl border text-left transition', on ? 'border-accent accent-soft' : 'border-line bg-surface-2/50')}>
                <span className="w-3 h-3 rounded-full" style={{ background: groupColor(r.muscle_group) }} />
                <span className="flex-1 font-semibold">{r.name}</span>
                <span className={cx('w-6 h-6 rounded-lg border-2 grid place-items-center', on ? 'bg-accent border-accent text-accent-ink' : 'border-line')}>{on && <Icon name="check" size={14} strokeWidth={3} />}</span>
              </button>
            )
          })}
          {!active.length && <div className="text-sm text-muted">Lege zuerst einen Plan an.</div>}
        </div>
      </Sheet>

      {/* Plan anlegen/bearbeiten */}
      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Plan bearbeiten' : 'Neuer Plan'}
        footer={
          <Button className="flex-1" onClick={saveRoutine} disabled={!editing?.name?.trim()}>
            Speichern
          </Button>
        }
      >
        <Field label="Name">
          <input autoFocus className={inputCls} value={editing?.name ?? ''} placeholder="z. B. Push Day" onChange={(e) => setEditing({ ...editing, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && saveRoutine()} />
        </Field>
        <Field label="Schwerpunkt">
          <div className="flex flex-wrap gap-1.5">
            {PLAN_GROUPS.map((g) => (
              <Chip key={g} active={editing?.muscle_group === g} color={groupColor(g)} onClick={() => setEditing({ ...editing, muscle_group: editing?.muscle_group === g ? null : g })}>
                {g}
              </Chip>
            ))}
          </div>
        </Field>
      </Sheet>

      <Sheet open={showTpl} onClose={() => setShowTpl(false)} title="Vorlage wählen">
        <p className="text-sm text-muted mb-3">Wird mit bewährten Übungen befüllt – du kannst danach alles anpassen.</p>
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATES.map((t) => (
            <button key={t.name} onClick={() => fromTemplate(t)} className="p-3.5 rounded-2xl border border-line bg-surface-2/50 text-left hover:border-accent transition">
              <span className="block w-6 h-1.5 rounded-full mb-2" style={{ background: groupColor(t.group) }} />
              <span className="block font-bold">{t.name}</span>
              <span className="block text-xs text-muted">{t.from.join(' · ')}</span>
            </button>
          ))}
        </div>
      </Sheet>
      {confirmNode}
    </div>
  )
}
