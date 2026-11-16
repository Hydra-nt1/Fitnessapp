import { useEffect, useMemo, useState } from 'react'
import { queryClient, remove, save, saveSettings, useRows, useSettings } from '../lib/api'
import { isDemo, supabase } from '../lib/db'
import { fmtDate, isoDate } from '../lib/date'
import { fmtKg } from '../lib/training'
import type { AppSettings, BodyMetric } from '../lib/types'
import { LineChart } from '../components/charts'
import { Button, Card, Field, IconButton, NumberStepper, PageHeader, SectionTitle, Segmented, Sheet, Stat, cx, inputCls, toast, useConfirm } from '../components/ui'
import { Icon } from '../components/icons'

const ACCENTS = ['#c8ff2e', '#ff6a3d', '#5ad1ff', '#6e8bff', '#a78bfa', '#3ee6b0', '#ff5c8a', '#ffd23f']
const GOALS = ['Muskelaufbau', 'Kraft', 'Abnehmen', 'Ausdauer', 'Fitness & Gesundheit']
const LEVELS = ['Anfänger', 'Fortgeschritten', 'Profi']
const EQUIP = ['Fitnessstudio', 'Home Gym', 'Nur Kurzhanteln', 'Körpergewicht']
const MEASURES: { key: keyof BodyMetric; label: string; unit: string }[] = [
  { key: 'weight', label: 'Gewicht', unit: 'kg' },
  { key: 'body_fat', label: 'Körperfett', unit: '%' },
  { key: 'waist', label: 'Taille', unit: 'cm' },
  { key: 'chest', label: 'Brust', unit: 'cm' },
  { key: 'arms', label: 'Arme', unit: 'cm' },
  { key: 'hips', label: 'Hüfte', unit: 'cm' },
  { key: 'thighs', label: 'Oberschenkel', unit: 'cm' },
]

export function ProfilePage() {
  const s = useSettings()
  const metrics = useRows('body_metrics')
  const [email, setEmail] = useState<string | null>(null)
  const [editProfile, setEditProfile] = useState(false)
  const [addMetric, setAddMetric] = useState(false)
  const [measure, setMeasure] = useState<keyof BodyMetric>('weight')
  const [confirm, confirmNode] = useConfirm()
  useEffect(() => {
    if (!isDemo()) supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  const sorted = useMemo(() => [...metrics].sort((a, b) => b.measured_at.localeCompare(a.measured_at)), [metrics])
  const latestW = sorted.find((m) => m.weight)?.weight ?? null
  const bmi = latestW && s.height_cm ? latestW / (s.height_cm / 100) ** 2 : null
  const unit = MEASURES.find((m) => m.key === measure)!.unit
  const points = sorted.filter((m) => m[measure] != null).map((m) => ({ x: +new Date(m.measured_at), y: Number(m[measure]) }))
  const first = points[points.length - 1]?.y
  const last = points[0]?.y
  const age = s.birthday ? Math.floor((Date.now() - +new Date(s.birthday)) / (365.25 * 864e5)) : null

  const logout = async () => {
    if (isDemo()) {
      if (!(await confirm('Demo beenden? Die Demo-Daten auf diesem Gerät werden gelöscht.', { danger: true, ok: 'Beenden' }))) return
      Object.keys(localStorage)
        .filter((k) => k.startsWith('ft_'))
        .forEach((k) => localStorage.removeItem(k))
      location.href = location.pathname
      return
    }
    await supabase.auth.signOut()
    queryClient.clear()
    localStorage.removeItem('ft_cache')
    location.reload()
  }

  const exportData = async (fmt: 'json' | 'csv') => {
    const tables = ['app_settings', 'routines', 'routine_exercises', 'week_plan', 'workouts', 'workout_sets', 'quick_logs', 'body_metrics', 'custom_exercises'] as const
    let blob: Blob
    if (fmt === 'json') {
      const data = Object.fromEntries(tables.map((t) => [t, queryClient.getQueryData([t]) ?? []]))
      blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    } else {
      const ws = (queryClient.getQueryData<any[]>(['workouts']) ?? []) as any[]
      const byId = new Map(ws.map((w) => [w.id, w]))
      const rows = ((queryClient.getQueryData<any[]>(['workout_sets']) ?? []) as any[])
        .map((x) => ({ x, w: byId.get(x.workout_id) }))
        .filter((r) => r.w)
        .sort((a, b) => a.w.started_at.localeCompare(b.w.started_at))
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
      const csv = ['Datum;Workout;Übung;Satz;Typ;Gewicht;Wdh;RPE', ...rows.map(({ x, w }) => [isoDate(new Date(w.started_at)), w.name, x.exercise_name, x.set_number, x.set_type, String(x.weight).replace('.', ','), x.reps, x.rpe ?? ''].map(esc).join(';'))].join('\n')
      blob = new Blob(['﻿' + csv], { type: 'text/csv' })
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `fittracker-${isoDate(new Date())}.${fmt}`
    a.click()
  }

  return (
    <div>
      <PageHeader title="Profil" subtitle={isDemo() ? 'Demo-Modus' : email ?? ''} />

      <Card className="p-4 flex items-center gap-4" onClick={() => setEditProfile(true)}>
        <div className="w-14 h-14 rounded-2xl bg-accent text-accent-ink grid place-items-center text-2xl font-display font-bold">{(s.display_name ?? email ?? '?')[0]?.toUpperCase()}</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-lg truncate">{s.display_name || 'Name eintragen'}</div>
          <div className="text-sm text-muted truncate">{[s.goal, s.level, s.days_per_week && `${s.days_per_week}× / Woche`, age && `${age} J.`].filter(Boolean).join(' · ') || 'Ziel, Level & mehr festlegen'}</div>
        </div>
        <Icon name="chevronRight" size={18} className="text-muted" />
      </Card>

      <SectionTitle action={<Button size="sm" icon="plus" onClick={() => setAddMetric(true)}>Eintragen</Button>}>Körperdaten</SectionTitle>
      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Gewicht" icon="scale" value={latestW ? `${fmtKg(+latestW)}` : '–'} sub={s.goal_weight && latestW ? `Ziel ${fmtKg(+s.goal_weight)} kg (${latestW > s.goal_weight ? '−' : '+'}${fmtKg(Math.abs(Math.round((latestW - s.goal_weight) * 10) / 10))})` : 'kg'} />
        <Stat label="BMI" value={bmi ? bmi.toFixed(1).replace('.', ',') : '–'} sub={bmi ? (bmi < 18.5 ? 'Untergewicht' : bmi < 25 ? 'Normalgewicht' : bmi < 30 ? 'Übergewicht' : 'Adipositas') : 'Größe angeben'} />
        <Stat label="Veränderung" value={first != null && last != null && points.length > 1 ? `${last - first > 0 ? '+' : ''}${fmtKg(Math.round((last - first) * 10) / 10)}` : '–'} sub={`${unit} seit Beginn`} />
      </div>
      <Card className="p-4 mt-2.5">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-3 -mx-1 px-1">
          {MEASURES.map((m) => (
            <button key={m.key} onClick={() => setMeasure(m.key)} className={cx('h-7 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap', measure === m.key ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted')}>
              {m.label}
            </button>
          ))}
        </div>
        <LineChart points={points} unit={unit} fmt={(v) => fmtKg(Math.round(v * 10) / 10)} />
        {sorted.filter((m) => m[measure] != null).length > 0 && (
          <div className="mt-3 border-t border-line divide-y divide-line max-h-56 overflow-y-auto">
            {sorted
              .filter((m) => m[measure] != null)
              .slice(0, 30)
              .map((m) => (
                <div key={m.id} className="flex items-center py-2 text-sm">
                  <span className="flex-1 text-muted">{fmtDate(m.measured_at, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <span className="font-semibold tabular mr-2">
                    {fmtKg(Number(m[measure]))} {unit}
                  </span>
                  <IconButton icon="trash" label="Löschen" className="w-7 h-7 hover:text-bad" size={14} onClick={() => remove('body_metrics', m.id)} />
                </div>
              ))}
          </div>
        )}
      </Card>

      <SectionTitle>Darstellung</SectionTitle>
      <Card className="p-4">
        <Segmented
          value={s.theme}
          onChange={(t) => saveSettings({ theme: t })}
          options={[
            { value: 'dark', label: '🌙 Dunkel' },
            { value: 'light', label: '☀️ Hell' },
          ]}
        />
        <div className="flex justify-between mt-4">
          {ACCENTS.map((c) => (
            <button key={c} onClick={() => saveSettings({ accent: c })} className={cx('w-8 h-8 rounded-full transition', s.accent === c && 'ring-2 ring-offset-2 ring-offset-surface scale-110')} style={{ background: c, ['--tw-ring-color' as any]: c }} aria-label={`Akzentfarbe ${c}`} />
          ))}
        </div>
      </Card>

      <SectionTitle>Training</SectionTitle>
      <Card className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <NumberStepper label="Standard-Pause (s)" value={s.rest_seconds} step={15} min={0} onChange={(v) => saveSettings({ rest_seconds: v })} />
        <NumberStepper label="Gewichtssprung (kg)" value={+s.weight_increment} step={0.25} min={0.25} decimals onChange={(v) => saveSettings({ weight_increment: v })} />
        <NumberStepper label="Stange (kg)" value={+s.bar_weight} step={2.5} min={0} decimals onChange={(v) => saveSettings({ bar_weight: v })} />
      </Card>

      <SectionTitle>Daten</SectionTitle>
      <Card className="divide-y divide-line">
        <Row icon="arrowDown" label="Export als CSV (für Excel)" onClick={() => exportData('csv')} />
        <Row icon="copy" label="Komplett-Backup (JSON)" onClick={() => exportData('json')} />
        {!isDemo() && (
          <Row
            icon="refresh"
            label="Daten der alten App erneut übernehmen"
            onClick={async () => {
              if (!(await confirm('Alte Daten (v1) noch einmal übernehmen? Bereits übernommene Einträge werden dabei auf den alten Stand zurückgesetzt, neue Einträge bleiben erhalten.'))) return
              await saveSettings({ legacy_imported_at: null })
              location.reload()
            }}
          />
        )}
        <Row icon="logout" label={isDemo() ? 'Demo beenden' : 'Abmelden'} onClick={logout} danger />
      </Card>
      <div className="text-center text-xs text-muted mt-6">FitTracker 2.0</div>

      <ProfileSheet open={editProfile} onClose={() => setEditProfile(false)} s={s} />
      <MetricSheet open={addMetric} onClose={() => setAddMetric(false)} last={sorted[0]} />
      {confirmNode}
    </div>
  )
}

function Row({ icon, label, onClick, danger }: { icon: Parameters<typeof Icon>[0]['name']; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cx('w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2/50 font-semibold text-[15px]', danger && 'text-bad')}>
      <Icon name={icon} size={18} className={danger ? '' : 'text-muted'} />
      <span className="flex-1">{label}</span>
      <Icon name="chevronRight" size={16} className="text-muted" />
    </button>
  )
}

function ProfileSheet({ open, onClose, s }: { open: boolean; onClose: () => void; s: AppSettings }) {
  const [d, setD] = useState(s)
  useEffect(() => {
    if (open) setD(s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const pick = (k: keyof AppSettings, opts: string[]) => (
    <div className="flex flex-wrap gap-1.5">
      {opts.map((o) => (
        <button key={o} onClick={() => setD({ ...d, [k]: d[k] === o ? null : o })} className={cx('h-8 px-3 rounded-lg text-[13px] font-semibold border', d[k] === o ? 'bg-accent border-accent text-accent-ink' : 'border-line bg-surface-2 text-muted')}>
          {o}
        </button>
      ))}
    </div>
  )
  const n = (v: string) => (v === '' ? null : Number(v.replace(',', '.')))
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Profil bearbeiten"
      footer={
        <Button
          className="flex-1"
          onClick={async () => {
            await saveSettings({ display_name: d.display_name, birthday: d.birthday, sex: d.sex, height_cm: d.height_cm, goal_weight: d.goal_weight, goal: d.goal, level: d.level, days_per_week: d.days_per_week, equipment: d.equipment })
            toast('Profil gespeichert')
            onClose()
          }}
        >
          Speichern
        </Button>
      }
    >
      <Field label="Name">
        <input className={inputCls} value={d.display_name ?? ''} onChange={(e) => setD({ ...d, display_name: e.target.value || null })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Geburtstag">
          <input type="date" className={inputCls} value={d.birthday ?? ''} onChange={(e) => setD({ ...d, birthday: e.target.value || null })} />
        </Field>
        <Field label="Geschlecht">
          <select className={inputCls} value={d.sex ?? ''} onChange={(e) => setD({ ...d, sex: e.target.value || null })}>
            <option value="">–</option>
            <option value="m">männlich</option>
            <option value="w">weiblich</option>
            <option value="d">divers</option>
          </select>
        </Field>
        <Field label="Größe (cm)">
          <input inputMode="decimal" className={inputCls} value={d.height_cm ?? ''} onChange={(e) => setD({ ...d, height_cm: n(e.target.value) })} />
        </Field>
        <Field label="Zielgewicht (kg)">
          <input inputMode="decimal" className={inputCls} value={d.goal_weight ?? ''} onChange={(e) => setD({ ...d, goal_weight: n(e.target.value) })} />
        </Field>
      </div>
      <Field label="Ziel">{pick('goal', GOALS)}</Field>
      <Field label="Erfahrung">{pick('level', LEVELS)}</Field>
      <Field label="Equipment">{pick('equipment', EQUIP)}</Field>
      <Field label="Trainingstage pro Woche">
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((x) => (
            <button key={x} onClick={() => setD({ ...d, days_per_week: x })} className={cx('flex-1 h-9 rounded-lg font-bold', d.days_per_week === x ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted')}>
              {x}
            </button>
          ))}
        </div>
      </Field>
    </Sheet>
  )
}

function MetricSheet({ open, onClose, last }: { open: boolean; onClose: () => void; last?: BodyMetric }) {
  const [date, setDate] = useState(isoDate(new Date()))
  const [vals, setVals] = useState<Record<string, string>>({})
  useEffect(() => {
    if (open) {
      setDate(isoDate(new Date()))
      setVals({})
    }
  }, [open])
  const submit = async () => {
    const row: Partial<BodyMetric> = { measured_at: new Date(date + 'T08:00:00').toISOString() }
    let any = false
    for (const m of MEASURES) {
      const v = vals[m.key]
      if (v) {
        ;(row as any)[m.key] = Number(v.replace(',', '.'))
        any = true
      }
    }
    if (!any) return
    await save('body_metrics', row)
    toast('Gespeichert')
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Körperdaten eintragen" footer={<Button className="flex-1" onClick={submit}>Speichern</Button>}>
      <Field label="Datum">
        <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-x-2">
        {MEASURES.map((m) => (
          <Field key={m.key} label={`${m.label} (${m.unit})`}>
            <input inputMode="decimal" className={inputCls} placeholder={last?.[m.key] != null ? String(last[m.key]).replace('.', ',') : ''} value={vals[m.key] ?? ''} onChange={(e) => setVals({ ...vals, [m.key]: e.target.value })} autoFocus={m.key === 'weight'} />
          </Field>
        ))}
      </div>
    </Sheet>
  )
}
