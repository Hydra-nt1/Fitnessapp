import { useEffect, useState, useSyncExternalStore, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from './icons'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:brightness-110',
  secondary: 'bg-surface-2 text-fg border border-line hover:bg-surface-3',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-bad/12 text-bad hover:bg-bad/20',
  soft: 'accent-soft text-accent hover:brightness-110',
}
export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: IconName }) {
  const sz = size === 'sm' ? 'h-8 px-3 text-[13px] gap-1.5 rounded-lg' : size === 'lg' ? 'h-13 px-5 text-base gap-2 rounded-2xl' : 'h-10 px-4 text-sm gap-2 rounded-xl'
  return (
    <button
      className={cx('inline-flex items-center justify-center font-semibold transition active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none select-none', sz, VARIANT[variant], className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 18} />}
      {children}
    </button>
  )
}

export function IconButton({ icon, label, className, size = 18, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; size?: number }) {
  return (
    <button aria-label={label} title={label} className={cx('inline-flex items-center justify-center w-9 h-9 rounded-xl text-muted hover:text-fg hover:bg-surface-2 transition active:scale-95', className)} {...rest}>
      <Icon name={icon} size={size} />
    </button>
  )
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cx('bg-surface border border-line rounded-2xl', onClick && 'cursor-pointer hover:border-surface-3 active:scale-[0.99] transition', className)}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mt-7 mb-2.5 px-0.5">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">{children}</h2>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, back, actions }: { title: ReactNode; subtitle?: ReactNode; back?: boolean | string; actions?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="flex items-start gap-2 pt-5 pb-3">
      {back && <IconButton icon="chevronLeft" label="Zurück" className="-ml-2 mt-0.5" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))} />}
      <div className="flex-1 min-w-0">
        <h1 className="text-[26px] leading-tight font-extrabold tracking-tight truncate">{title}</h1>
        {subtitle && <div className="text-sm text-muted mt-0.5">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-1 mt-0.5">{actions}</div>}
    </header>
  )
}

export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center anim-fade" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] -z-10" />
      <div className={cx('bg-surface w-full rounded-t-3xl sm:rounded-3xl border border-line max-h-[92dvh] flex flex-col anim-sheet safe-bottom', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="sm:hidden mx-auto mt-2.5 h-1 w-10 rounded-full bg-surface-3" />
        {title && (
          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
            <div className="flex-1 text-lg font-bold truncate">{title}</div>
            <IconButton icon="x" label="Schließen" onClick={onClose} className="-mr-2" />
          </div>
        )}
        <div className="overflow-y-auto px-5 pb-5 pt-1 flex-1">{children}</div>
        {footer && <div className="px-5 pb-5 pt-2 flex gap-2 border-t border-line">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block mb-3.5">
      <span className="block text-[12px] font-semibold text-muted mb-1.5 uppercase tracking-wide">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  )
}
export const inputCls = 'w-full h-11 px-3.5 rounded-xl bg-surface-2 border border-line outline-none focus:border-accent transition placeholder:text-muted/60'

export function NumberStepper({ value, onChange, step = 1, min = 0, label, decimals = false }: { value: number; onChange: (v: number) => void; step?: number; min?: number; label?: string; decimals?: boolean }) {
  return (
    <div>
      {label && <div className="text-[12px] font-semibold text-muted mb-1.5 uppercase tracking-wide">{label}</div>}
      <div className="flex items-center h-11 rounded-xl bg-surface-2 border border-line overflow-hidden">
        <button type="button" className="w-11 h-full grid place-items-center text-muted hover:text-fg active:bg-surface-3" onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}>
          <Icon name="minus" size={16} />
        </button>
        <input
          type="number"
          inputMode={decimals ? 'decimal' : 'numeric'}
          className="flex-1 min-w-0 h-full bg-transparent text-center font-semibold tabular outline-none"
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value.replace(',', '.')))}
          onFocus={(e) => e.target.select()}
        />
        <button type="button" className="w-11 h-full grid place-items-center text-muted hover:text-fg active:bg-surface-3" onClick={() => onChange(+(value + step).toFixed(2))}>
          <Icon name="plus" size={16} />
        </button>
      </div>
    </div>
  )
}

export function Segmented<T extends string | number>({ options, value, onChange, className }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cx('flex p-1 rounded-xl bg-surface-2 border border-line gap-1', className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={cx('flex-1 h-8 px-2 rounded-lg text-[13px] font-semibold transition whitespace-nowrap', value === o.value ? 'bg-surface text-fg shadow-sm border border-line' : 'text-muted hover:text-fg')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chip({ active, children, onClick, color }: { active?: boolean; children: ReactNode; onClick?: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      style={active && color ? { background: color, borderColor: color } : undefined}
      className={cx('h-8 px-3 rounded-full text-[13px] font-semibold border whitespace-nowrap transition shrink-0', active ? 'bg-accent border-accent text-white' : 'bg-surface-2 border-line text-muted hover:text-fg')}
    >
      {children}
    </button>
  )
}

export function Empty({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-12 px-6">
      <div className="mx-auto w-14 h-14 rounded-2xl accent-soft text-accent grid place-items-center mb-3">
        <Icon name={icon} size={26} />
      </div>
      <div className="font-bold">{title}</div>
      {text && <div className="text-sm text-muted mt-1 max-w-xs mx-auto">{text}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Stat({ label, value, sub, icon, tone }: { label: string; value: ReactNode; sub?: ReactNode; icon?: IconName; tone?: string }) {
  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-1.5 text-[12px] text-muted font-medium">
        {icon && <Icon name={icon} size={14} style={{ color: tone }} />}
        {label}
      </div>
      <div className="text-[22px] font-extrabold tabular mt-1 leading-none">{value}</div>
      {sub && <div className="text-xs text-muted mt-1.5">{sub}</div>}
    </Card>
  )
}

export function Badge({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'good' | 'warn' | 'bad' | 'muted' }) {
  const t = {
    accent: 'accent-soft text-accent',
    good: 'bg-good/15 text-good',
    warn: 'bg-warn/15 text-warn',
    bad: 'bg-bad/15 text-bad',
    muted: 'bg-surface-2 text-muted',
  }[tone]
  return <span className={cx('inline-flex items-center gap-1 h-5.5 px-2 rounded-md text-[11px] font-bold', t)}>{children}</span>
}

// ── Toasts ───────────────────────────────────────────────────────────
let toasts: { id: number; text: string }[] = []
const subs = new Set<() => void>()
export function toast(text: string) {
  const id = Date.now() + Math.random()
  toasts = [...toasts, { id, text }]
  subs.forEach((f) => f())
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    subs.forEach((f) => f())
  }, 2800)
}
export function Toaster() {
  const list = useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => toasts,
  )
  return createPortal(
    <div className="fixed left-0 right-0 bottom-24 md:bottom-6 z-[60] flex flex-col items-center gap-2 pointer-events-none px-4">
      {list.map((t) => (
        <div key={t.id} className="anim-pop bg-fg text-bg px-4 py-2.5 rounded-xl text-sm font-semibold shadow-xl">
          {t.text}
        </div>
      ))}
    </div>,
    document.body,
  )
}

// ── Confirm ──────────────────────────────────────────────────────────
export function useConfirm() {
  const [state, setState] = useState<{ text: string; resolve: (v: boolean) => void; danger?: boolean; ok?: string } | null>(null)
  const confirm = (text: string, opts: { danger?: boolean; ok?: string } = {}) => new Promise<boolean>((resolve) => setState({ text, resolve, ...opts }))
  const close = (v: boolean) => {
    state?.resolve(v)
    setState(null)
  }
  const node = (
    <Sheet
      open={!!state}
      onClose={() => close(false)}
      title="Bist du sicher?"
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={() => close(false)}>
            Abbrechen
          </Button>
          <Button variant={state?.danger ? 'danger' : 'primary'} className="flex-1" onClick={() => close(true)}>
            {state?.ok ?? 'Ja'}
          </Button>
        </>
      }
    >
      <p className="text-muted">{state?.text}</p>
    </Sheet>
  )
  return [confirm, node] as const
}
