import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { isDemo, supabase } from './lib/db'
import { queryClient, saveSettings, useSettings } from './lib/api'
import { migrateLegacyIfNeeded } from './lib/migrate'
import { seedDemoIfEmpty } from './lib/demoSeed'
import { flushPending, useActive, usePendingCount, useRest, adjustRest, stopRest } from './state/workout'
import { fmtClock } from './lib/date'
import { Icon, type IconName } from './components/icons'
import { Toaster, cx, toast } from './components/ui'
import { AuthScreen } from './pages/Auth'
import { TodayPage } from './pages/Today'
import { PlanPage } from './pages/Plan'
import { RoutinePage } from './pages/Routine'
import { WorkoutPage } from './pages/Workout'
import { StatsPage } from './pages/Stats'
import { WorkoutDetailPage } from './pages/WorkoutDetail'
import { ExercisesPage } from './pages/Exercises'
import { ExerciseDetailPage } from './pages/ExerciseDetail'
import { CoachPage } from './pages/Coach'
import { ProfilePage } from './pages/Profile'
import { SearchPage } from './pages/Search'

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Heute', icon: 'home' },
  { to: '/plan', label: 'Plan', icon: 'calendar' },
  { to: '/stats', label: 'Statistik', icon: 'chart' },
  { to: '/exercises', label: 'Übungen', icon: 'list' },
  { to: '/coach', label: 'Coach', icon: 'sparkles' },
  { to: '/profile', label: 'Profil', icon: 'user' },
]

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [demo, setDemo] = useState(isDemo())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (new URLSearchParams(location.search).has('demo')) {
      localStorage.setItem('ft_demo', '1')
      setDemo(true)
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = demo ? 'demo' : session?.user.id
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      if (localStorage.getItem('ft_uid') !== userId) {
        queryClient.clear()
        localStorage.setItem('ft_uid', userId)
      }
      if (demo) {
        await seedDemoIfEmpty()
        queryClient.invalidateQueries()
      }
      if (!demo && navigator.onLine) {
        try {
          const r = await migrateLegacyIfNeeded(userId)
          if (r.imported) {
            queryClient.invalidateQueries()
            toast(`Alte Daten übernommen: ${Object.entries(r.counts ?? {}).map(([k, v]) => `${v} ${k}`).join(', ')}`)
          }
        } catch (e) {
          console.error('Migration fehlgeschlagen', e)
          toast('Datenübernahme fehlgeschlagen – ist das neue Datenbankschema eingerichtet?')
        }
        flushPending()
      }
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [userId, demo])

  if (session === undefined && !demo) return <Splash />
  if (!session && !demo) return <AuthScreen onDemo={() => (localStorage.setItem('ft_demo', '1'), setDemo(true))} />
  if (!ready) return <Splash text="Synchronisiere…" />
  return <Shell demo={demo} />
}

function Splash({ text = 'Lade…' }: { text?: string }) {
  return (
    <div className="min-h-dvh grid place-items-center text-muted">
      <div className="flex flex-col items-center gap-3">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} className="w-16 h-16 animate-pulse" alt="" />
        <span className="text-sm">{text}</span>
      </div>
    </div>
  )
}

/** Textfarbe auf Akzentflächen aus der Helligkeit ableiten */
export function inkFor(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return l > 0.6 ? '#0b0c08' : '#ffffff'
}

function useThemeSync() {
  const s = useSettings()
  // Altes Standard-Blau aus v2.0 einmalig auf das neue Volt umstellen
  useEffect(() => {
    if (s.accent === '#4f7ef8') saveSettings({ accent: '#c8ff2e' })
  }, [s.accent])
  useEffect(() => {
    const accent = s.accent === '#4f7ef8' ? '#c8ff2e' : s.accent
    const root = document.documentElement
    root.dataset.theme = s.theme
    root.style.setProperty('--accent', accent)
    root.style.setProperty('--accent-ink', inkFor(accent))
    localStorage.setItem('ft_theme', s.theme)
    localStorage.setItem('ft_accent', accent)
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', s.theme === 'light' ? '#f2f1ec' : '#08080a')
  }, [s.theme, s.accent])
}

function Shell({ demo }: { demo: boolean }) {
  useThemeSync()
  const loc = useLocation()
  const inWorkout = loc.pathname === '/workout'
  const [online, setOnline] = useState(navigator.onLine)
  const pending = usePendingCount()
  useEffect(() => {
    const f = () => setOnline(navigator.onLine)
    window.addEventListener('online', f)
    window.addEventListener('offline', f)
    return () => (window.removeEventListener('online', f), window.removeEventListener('offline', f))
  }, [])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])

  return (
    <div className="md:flex min-h-dvh">
      <aside className="hidden md:flex flex-col w-64 shrink-0 p-5 sticky top-0 h-dvh">
        <Logo />
        <nav className="mt-8 flex flex-col gap-1">
          {[...NAV, { to: '/search', label: 'Suche', icon: 'search' as IconName }].map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) => cx('flex items-center gap-3 h-12 px-4 rounded-full font-semibold text-[15px] transition', isActive ? 'bg-fg text-bg' : 'text-muted hover:text-fg hover:bg-surface-2')}
            >
              <Icon name={n.icon} size={19} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <ActiveWorkoutPill />
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {(!online || pending > 0 || demo) && (
          <div className="safe-top px-4 pt-2 flex justify-center">
            <div className={cx('text-[12px] font-semibold px-3 py-1 rounded-full', demo ? 'accent-soft' : 'bg-warn/15 text-warn')}>
              {demo ? 'Demo-Modus · Daten nur auf diesem Gerät' : !online ? 'Offline · Workouts werden später synchronisiert' : `${pending} Workout(s) warten auf Synchronisation…`}
            </div>
          </div>
        )}
        <div className={cx('mx-auto w-full max-w-3xl px-4 md:px-8', inWorkout ? 'pb-44' : 'pb-36 md:pb-12')}>
          <Routes>
            <Route path="/" element={<TodayPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/plan/:id" element={<RoutinePage />} />
            <Route path="/workout" element={<WorkoutPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/stats/workout/:id" element={<WorkoutDetailPage />} />
            <Route path="/exercises" element={<ExercisesPage />} />
            <Route path="/exercises/:name" element={<ExerciseDetailPage />} />
            <Route path="/coach" element={<CoachPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="*" element={<TodayPage />} />
          </Routes>
        </div>
      </main>

      <div className="fixed z-40 left-3 right-3 bottom-[calc(84px+env(safe-area-inset-bottom))] md:bottom-6 md:left-auto md:right-6 md:w-80 flex flex-col gap-2 pointer-events-none [&>*]:pointer-events-auto">
        {!inWorkout && (
          <div className="md:hidden">
            <ActiveWorkoutPill />
          </div>
        )}
        <RestTimerBar />
      </div>

      {/* Schwebende Glas-Navigation */}
      <nav className="md:hidden fixed z-40 left-3 right-3 bottom-[max(12px,env(safe-area-inset-bottom))]">
        <div className="glass border border-line rounded-full p-1.5 flex shadow-[0_18px_40px_-12px_rgb(0_0_0/0.55)]">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              aria-label={n.label}
              className={({ isActive }) =>
                cx('h-12 rounded-full flex items-center justify-center gap-1.5 font-semibold text-[13px] transition-colors duration-200 min-w-0', isActive ? 'bg-accent text-accent-ink px-4 flex-[1.9]' : 'text-muted flex-1')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={n.icon} size={20} strokeWidth={isActive ? 2.4 : 2} className="shrink-0" />
                  {isActive && <span className="truncate">{n.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
      <Toaster />
    </div>
  )
}

export function Logo({ big }: { big?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <img src={`${import.meta.env.BASE_URL}icon.svg`} className={big ? 'w-12 h-12' : 'w-9 h-9'} alt="" />
      <div className={cx('font-display font-bold tracking-tight', big ? 'text-3xl' : 'text-[22px]')}>FitTracker</div>
    </div>
  )
}

function ActiveWorkoutPill() {
  const w = useActive()
  const nav = useNavigate()
  const [, tick] = useState(0)
  useEffect(() => {
    if (!w) return
    const t = setInterval(() => tick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [w])
  if (!w) return null
  const done = w.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0)
  const total = w.exercises.reduce((a, e) => a + e.sets.length, 0)
  return (
    <button onClick={() => nav('/workout')} className="w-full flex items-center gap-3 p-2 pr-4 rounded-full bg-fg text-bg shadow-2xl anim-pop text-left">
      <span className="relative w-10 h-10 rounded-full bg-accent text-accent-ink grid place-items-center">
        <span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-30" />
        <Icon name={w.kind === 'attendance' ? 'checkin' : 'dumbbell'} size={18} strokeWidth={2.4} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-sm truncate">{w.name}</span>
        <span className="block text-xs opacity-60 tabular">
          {fmtClock(Date.now() - w.startedAt)}
          {w.kind === 'full' && ` · ${done}/${total} Sätze`}
        </span>
      </span>
      <Icon name="chevronRight" size={18} />
    </button>
  )
}

function RestTimerBar() {
  const r = useRest()
  const [, tick] = useState(0)
  useEffect(() => {
    if (!r) return
    const t = setInterval(() => tick((x) => x + 1), 250)
    return () => clearInterval(t)
  }, [r])
  if (!r) return null
  const left = r.endsAt - Date.now()
  const pct = Math.max(0, Math.min(1, left / (r.total * 1000)))
  return (
    <div className="anim-pop glass border border-line rounded-full shadow-2xl flex items-center gap-2 p-1.5">
      <TimerRing pct={pct} />
      <div className="flex-1 pl-1">
        <div className="text-[11px] text-muted font-semibold uppercase tracking-[0.12em] leading-none">Pause</div>
        <div className="font-display text-[26px] font-bold tabular leading-tight">{fmtClock(left + 999)}</div>
      </div>
      <RestBtn onClick={() => adjustRest(-15)}>−15</RestBtn>
      <RestBtn onClick={() => adjustRest(15)}>+15</RestBtn>
      <RestBtn onClick={stopRest} dark>
        <Icon name="x" size={16} strokeWidth={2.6} />
      </RestBtn>
    </div>
  )
}
function TimerRing({ pct }: { pct: number }) {
  const r = 20
  const c = 2 * Math.PI * r
  return (
    <svg width="48" height="48" className="-rotate-90 shrink-0">
      <circle cx="24" cy="24" r={r} stroke="var(--surface-3)" strokeWidth="5" fill="none" />
      <circle cx="24" cy="24" r={r} stroke="var(--accent)" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .3s linear' }} />
    </svg>
  )
}
const RestBtn = ({ children, onClick, dark }: { children: ReactNode; onClick: () => void; dark?: boolean }) => (
  <button onClick={onClick} className={cx('h-11 min-w-11 px-3 rounded-full font-bold text-sm grid place-items-center active:scale-90 transition', dark ? 'bg-fg text-bg' : 'bg-surface-2 border border-line')}>
    {children}
  </button>
)
