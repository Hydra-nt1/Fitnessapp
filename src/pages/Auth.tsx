import { useState } from 'react'
import { supabase } from '../lib/db'
import { Button, inputCls, Segmented } from '../components/ui'
import { Logo } from '../App'

export function AuthScreen({ onDemo }: { onDemo: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const res = mode === 'login' ? await supabase.auth.signInWithPassword({ email, password: pw }) : await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: location.origin + location.pathname } })
    setBusy(false)
    if (res.error) {
      const m = res.error.message
      setMsg({ text: /invalid login/i.test(m) ? 'E-Mail oder Passwort falsch.' : /already registered/i.test(m) ? 'Diese E-Mail ist bereits registriert.' : /at least/i.test(m) ? 'Passwort muss mindestens 6 Zeichen haben.' : m })
    } else if (mode === 'signup' && !res.data.session) {
      setMsg({ text: 'Fast geschafft! Bitte bestätige deine E-Mail-Adresse über den Link im Postfach.', ok: true })
    }
  }
  const forgot = async () => {
    if (!email) return setMsg({ text: 'Bitte zuerst die E-Mail-Adresse eingeben.' })
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })
    setMsg({ text: 'Link zum Zurücksetzen wurde gesendet.', ok: true })
  }

  return (
    <div className="min-h-dvh grid place-items-center px-5 py-10" style={{ background: 'radial-gradient(1200px 600px at 50% -10%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 60%)' }}>
      <div className="w-full max-w-sm">
        <div className="anim-rise">
          <Logo />
          <h1 className="font-display text-[46px] leading-[0.95] font-bold mt-8">
            Stärker.
            <br />
            <span className="text-accent-fg">Jede Woche.</span>
          </h1>
          <p className="text-muted text-[15px] mt-3 mb-8">Plane, logge und analysiere dein Training – mit smarter Progression und KI-Coach.</p>
        </div>
        <div className="bg-surface border border-line rounded-[30px] p-5 shadow-2xl anim-rise" style={{ animationDelay: '80ms' }}>
          <Segmented
            options={[
              { value: 'login', label: 'Anmelden' },
              { value: 'signup', label: 'Registrieren' },
            ]}
            value={mode}
            onChange={(m) => (setMode(m), setMsg(null))}
            className="mb-4"
          />
          <form onSubmit={submit} className="flex flex-col gap-2.5">
            <input className={inputCls} type="email" required placeholder="E-Mail" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className={inputCls} type="password" required placeholder="Passwort" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} />
            {msg && <div className={msg.ok ? 'text-good text-sm' : 'text-bad text-sm'}>{msg.text}</div>}
            <Button size="lg" disabled={busy} className="mt-1">
              {busy ? '…' : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
            </Button>
          </form>
          {mode === 'login' && (
            <button onClick={forgot} className="w-full text-center text-sm text-muted hover:text-fg mt-3">
              Passwort vergessen?
            </button>
          )}
        </div>
        <button onClick={onDemo} className="w-full text-center text-sm text-muted hover:text-accent-fg mt-5">
          Ohne Konto ausprobieren (Demo) →
        </button>
      </div>
    </div>
  )
}
