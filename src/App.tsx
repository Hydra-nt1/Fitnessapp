import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { isDemo, supabase } from './lib/db'
import { queryClient, useSettings } from './lib/api'
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
        <img src={`${import.meta.env.BASE_URL}icon.svg`} className="w-14 h-14 animate-pulse" alt="" />
        <span className="text-sm">{text}</span>
      </div>
    </div>
  )
}

function useThemeSync() {
  const s = useSettings()
  useEffect(() => {
    document.documentElement.dataset.theme = s.theme
    document.documentElement.style.setProperty('--accent', s.accent)
    localStorage.setItem('ft_theme', s.theme)
    localStorage.setItem('ft_accent', s.accent)
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', s.theme === 'light' ? '#f3f5f9' : '#0b0d12')
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
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-line p-4 sticky top-0 h-dvh">
        <Logo />
        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx('flex items-center gap-3 h-11 px-3 rounded-xl font-semibold text-[15px] transition', isActive ? 'accent-soft text-accent' : 'text-muted hover:text-fg hover:bg-surface-2')}>
              <Icon name={n.icon} size={19} />
              {n.label}
            </NavLink>
          ))}
          <NavLink to="/search" className={({ isActive }) => cx('flex items-center gap-3 h-11 px-3 rounded-xl font-semibold text-[15px] transition', isActive ? 'accent-soft text-accent' : 'text-muted hover:text-fg hover:bg-surface-2')}>
            <Icon name="search" size={19} />
            Suche
          </NavLink>
        </nav>
        <div className="mt-auto">
          <ActiveWorkoutPill />
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {(!online || pending > 0 || demo) && (
          <div className={cx('text-center text-xs font-semibold py-1.5 safe-top', demo ? 'accent-soft text-accent' : 'bg-warn/15 text-warn')}>
            {demo ? 'Demo-Modus – Daten nur auf diesem Gerät' : !online ? 'Offline – Workouts werden gespeichert und später synchronisiert' : `${pending} Workout(s) warten auf Synchronisation…`}
          </div>
        )}
        <div className={cx('mx-auto w-full max-w-3xl px-4 md:px-8', inWorkout ? 'pb-40' : 'pb-32 md:pb-12')}>
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

      <div className="fixed z-40 left-3 right-3 bottom-[76px] md:bottom-6 md:left-auto md:right-6 md:w-80 flex flex-col gap-2 pointer-events-none [&>*]:pointer-events-auto">
        {!inWorkout && (
          <div className="md:hidden">
            <ActiveWorkoutPill />
          </div>
        )}
        <RestTimerBar />
      </div>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/92 backdrop-blur-xl border-t border-line safe-bottom">
        <div className="flex">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx('flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10.5px] font-semibold transition', isActive ? 'text-accent' : 'text-muted')}>
              <Icon name={n.icon} size={21} />
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <Toaster />
    </div>
  )
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <img src={`${import.meta.env.BASE_URL}icon.svg`} className="w-9 h-9" alt="" />
      <div className="text-xl font-extrabold tracking-tight">
        Fit<span className="text-accent">Tracker</span>
      </div>
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
    <button onClick={() => nav('/workout')} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-accent text-white shadow-lg shadow-accent/25 anim-pop text-left">
      <span className="w-9 h-9 rounded-xl bg-white/20 grid place-items-center">
        <Icon name={w.kind === 'attendance' ? 'checkin' : 'dumbbell'} size={19} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-sm truncate">{w.name}</span>
        <span className="block text-xs opacity-85 tabular">
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
    <div className="anim-pop">
      <div className="bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden">
        <div className="h-1 bg-surface-3">
          <div className="h-full bg-accent transition-all duration-300" style={{ width: `${pct * 100}%` }} />
        </div>
        <div className="flex items-center gap-2 p-2.5 pl-4">
          <Icon name="timer" size={18} className="text-accent" />
          <div className="flex-1">
            <div className="text-[11px] text-muted font-semibold uppercase tracking-wide leading-none">Pause</div>
            <div className="text-2xl font-extrabold tabular leading-tight">{fmtClock(left + 999)}</div>
          </div>
          <RestBtn onClick={() => adjustRest(-15)}>−15</RestBtn>
          <RestBtn onClick={() => adjustRest(15)}>+15</RestBtn>
          <RestBtn onClick={stopRest}>
            <Icon name="x" size={16} />
          </RestBtn>
        </div>
      </div>
    </div>
  )
}
const RestBtn = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
  <button onClick={onClick} className="h-10 min-w-10 px-2.5 rounded-xl bg-surface-2 border border-line font-bold text-sm grid place-items-center active:scale-95">
    {children}
  </button>
)
