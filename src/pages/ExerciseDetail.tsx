import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { saveSettings, useRows, useSettings } from '../lib/api'
import { exerciseInfo, groupColor, MUSCLE_LABEL } from '../data/exercises'
import { exerciseHistory, fmtKg, fmtSet, fmtVolume, personalRecords, platesFor, suggestNext, warmupSets } from '../lib/training'
import { relDay } from '../lib/date'
import { BodyMap, musclesToValues } from '../components/BodyMap'
import { LineChart } from '../components/charts'
import { Badge, Button, Card, PageHeader, SectionTitle, Segmented, Stat, toast } from '../components/ui'
import { CustomExerciseSheet } from './Exercises'

export function ExerciseDetailPage() {
  const name = decodeURIComponent(useParams().name ?? '')
  const nav = useNavigate()
  const s = useSettings()
  const workouts = useRows('workouts')
  const sets = useRows('workout_sets')
  const quick = useRows('quick_logs')
  const custom = useRows('custom_exercises')
  const routineEx = useRows('routine_exercises')
  const routines = useRows('routines')
  const [metric, setMetric] = useState<'e1rm' | 'top' | 'volume'>('e1rm')
  const [editCustom, setEditCustom] = useState(false)
  const info = exerciseInfo(name)
  const mine = custom.find((c) => c.name === name)
  const hist = useMemo(() => exerciseHistory(name, workouts, sets, quick), [name, workouts, sets, quick])
  const pr = personalRecords(hist)
  const re = routineEx.find((r) => r.exercise_name === name)
  const sugg = suggestNext(re ?? null, hist, s.weight_increment)
  const inPlans = routines.filter((r) => routineEx.some((e) => e.routine_id === r.id && e.exercise_name === name))
  const points = hist
    .map((h) => ({ x: +new Date(h.date), y: metric === 'e1rm' ? h.bestE1rm : metric === 'top' ? h.topWeight : h.volume }))
    .filter((p) => p.y > 0)
  const workW = sugg.weight || pr.maxWeight

  return (
    <div>
      <PageHeader back title={name} subtitle={<span style={{ color: groupColor(info.group) }}>{info.area || info.group}</span>} />

      <Card className="p-4">
        <BodyMap values={musclesToValues(info.primary, info.secondary)} renderInfo={(m) => (info.primary.includes(m) ? 'Hauptmuskel' : info.secondary.includes(m) ? 'unterstützend' : 'nicht beteiligt')} />
        <div className="flex flex-wrap gap-1.5 justify-center">
          {info.primary.map((m) => (
            <Badge key={m}>{MUSCLE_LABEL[m]}</Badge>
          ))}
          {info.secondary.map((m) => (
            <Badge key={m} tone="muted">
              {MUSCLE_LABEL[m]}
            </Badge>
          ))}
        </div>
      </Card>

      {hist.length > 0 ? (
        <>
          <SectionTitle>Bestleistungen</SectionTitle>
          <div className="grid grid-cols-3 gap-2.5">
            <Stat label="Max. Gewicht" icon="trophy" tone="#eab308" value={`${fmtKg(pr.maxWeight)} kg`} />
            <Stat label="Geschätztes 1RM" value={pr.maxE1rm ? `${fmtKg(Math.round(pr.maxE1rm))} kg` : '–'} />
            <Stat label="Bestes Volumen" value={fmtVolume(pr.maxVolumeSession)} />
          </div>

          <SectionTitle>Nächstes Training</SectionTitle>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl grid place-items-center text-lg ${sugg.trend === 'up' ? 'bg-good/15 text-good' : sugg.trend === 'down' ? 'bg-warn/15 text-warn' : 'accent-soft text-accent'}`}>{sugg.trend === 'up' ? '↑' : sugg.trend === 'down' ? '↓' : '→'}</div>
              <div className="flex-1">
                <div className="font-extrabold text-lg tabular">
                  {fmtKg(sugg.weight)} kg × {sugg.reps}
                </div>
                <div className="text-sm text-muted">{sugg.reason}</div>
              </div>
            </div>
            {workW > s.bar_weight && (
              <div className="mt-3 pt-3 border-t border-line text-sm grid gap-1">
                <div>
                  <span className="text-muted">Aufwärmen: </span>
                  {warmupSets(workW, s.bar_weight)
                    .map((w) => `${fmtKg(w.weight)}×${w.reps}`)
                    .join(' → ')}
                </div>
                <div>
                  <span className="text-muted">Scheiben pro Seite: </span>
                  {platesFor(workW, s.bar_weight).plates.map(fmtKg).join(' + ') || '–'}
                </div>
              </div>
            )}
          </Card>

          <SectionTitle>Fortschritt</SectionTitle>
          <Card className="p-4">
            <Segmented
              className="mb-3"
              value={metric}
              onChange={setMetric}
              options={[
                { value: 'e1rm', label: '1RM' },
                { value: 'top', label: 'Top-Gewicht' },
                { value: 'volume', label: 'Volumen' },
              ]}
            />
            <LineChart points={points} unit="kg" fmt={(v) => (metric === 'volume' ? fmtVolume(v) : fmtKg(Math.round(v * 10) / 10))} />
          </Card>

          <SectionTitle>Verlauf</SectionTitle>
          <Card className="divide-y divide-line">
            {hist.slice(0, 25).map((h, i) => {
              const row = (
                <>
                  <div className="w-24 shrink-0">
                    <div className="text-sm font-semibold">{relDay(h.date)}</div>
                    {h.quick && <div className="text-[11px] text-muted">Schnell-Log</div>}
                  </div>
                  <div className="flex-1 text-sm tabular text-muted">{h.quick ? `${h.sets.length} × ${h.sets[0]?.reps} · ${fmtKg(h.topWeight)} kg` : h.sets.map((x) => fmtSet(x.weight, x.reps)).join('  ')}</div>
                  {h.bestE1rm > 0 && <div className="text-xs font-bold tabular">{fmtKg(Math.round(h.bestE1rm))}</div>}
                </>
              )
              return h.workoutId ? (
                <Link key={i} to={`/stats/workout/${h.workoutId}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/50">
                  {row}
                </Link>
              ) : (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  {row}
                </div>
              )
            })}
          </Card>
        </>
      ) : (
        <Card className="p-5 mt-4 text-center text-sm text-muted">Noch nicht trainiert. Füge die Übung einem Plan hinzu oder logge sie im freien Workout.</Card>
      )}

      {inPlans.length > 0 && (
        <>
          <SectionTitle>In deinen Plänen</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {inPlans.map((r) => (
              <Button key={r.id} size="sm" variant="secondary" onClick={() => nav(`/plan/${r.id}`)}>
                {r.name}
              </Button>
            ))}
          </div>
        </>
      )}

      <div className="mt-8 flex gap-2">
        {mine ? (
          <Button variant="secondary" icon="edit" onClick={() => setEditCustom(true)}>
            Bearbeiten
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={() => {
              saveSettings({ hidden_exercises: [...s.hidden_exercises, name] })
              toast('Übung ausgeblendet')
              nav('/exercises')
            }}
          >
            Aus Bibliothek ausblenden
          </Button>
        )}
      </div>
      {mine && <CustomExerciseSheet open={editCustom} onClose={() => setEditCustom(false)} initial={mine} />}
    </div>
  )
}
