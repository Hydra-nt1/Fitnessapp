import { useEffect, useState, useSyncExternalStore, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from './icons'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft' | 'ink'
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-105 shadow-[0_8px_24px_-10px_var(--accent)]',
  secondary: 'bg-surface-2 text-fg border border-line hover:bg-surface-3',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-bad/12 text-bad hover:bg-bad/20',
  soft: 'accent-soft hover:brightness-110',
  ink: 'bg-fg text-bg hover:opacity-90',
}
export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: IconName }) {
  const sz = size === 'sm' ? 'h-9 px-3.5 text-[13px] gap-1.5' : size === 'lg' ? 'h-14 px-6 text-[16px] gap-2' : 'h-11 px-5 text-[14px] gap-2'
  return (
    <button
      className={cx('inline-flex items-center justify-center rounded-full font-semibold transition duration-150 active:scale-[0.96] disabled:opacity-35 disabled:pointer-events-none select-none whitespace-nowrap', sz, VARIANT[variant], className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : size === 'lg' ? 20 : 18} strokeWidth={2.2} />}
      {children}
    </button>
  )
}

export function IconButton({ icon, label, className, size = 19, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; size?: number }) {
  return (
    <button aria-label={label} title={label} className={cx('inline-flex items-center justify-center w-10 h-10 rounded-full text-muted hover:text-fg hover:bg-surface-2 transition active:scale-90', className)} {...rest}>
      <Icon name={icon} size={size} />
    </button>
  )
}

export function Card({ children, className, onClick, style }: { children: ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties }) {
  return (
    <div onClick={onClick} style={style} className={cx('bg-surface border border-line rounded-[26px] elev', onClick && 'cursor-pointer transition hover:border-surface-3 active:scale-[0.985]', className)}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mt-9 mb-3 px-1">
      <h2 className="font-display text-[20px] font-bold leading-none">{children}</h2>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, back, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; back?: boolean | string; actions?: ReactNode; eyebrow?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="pt-6 pb-4 anim-rise">
      <div className="flex items-center gap-2 min-h-10">
        {back && (
          <button onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))} className="-ml-1 w-10 h-10 rounded-full grid place-items-center bg-surface-2 border border-line text-fg active:scale-90 transition" aria-label="Zurück">
            <Icon name="chevronLeft" size={20} />
          </button>
        )}
        {eyebrow && !back && <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{eyebrow}</div>}
        <div className="flex-1" />
        {actions && <div className="flex items-center gap-1.5">{actions}</div>}
      </div>
      <h1 className="font-display text-[36px] leading-[1.02] font-bold mt-2 break-words">{title}</h1>
      {subtitle && <div className="text-[15px] text-muted mt-1.5">{subtitle}</div>}
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm -z-10" />
      <div className={cx('bg-surface w-full rounded-t-[32px] sm:rounded-[32px] border border-line max-h-[92dvh] flex flex-col anim-sheet safe-bottom shadow-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="sm:hidden mx-auto mt-3 h-1.5 w-11 rounded-full bg-surface-3" />
        {title && (
          <div className="flex items-center gap-2 px-6 pt-4 pb-2">
            <div className="flex-1 font-display text-[22px] font-bold truncate">{title}</div>
            <IconButton icon="x" label="Schließen" onClick={onClose} className="-mr-2 bg-surface-2" />
          </div>
        )}
        <div className="overflow-y-auto px-6 pb-6 pt-1 flex-1">{children}</div>
        {footer && <div className="px-6 pb-6 pt-3 flex gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-[13px] font-medium text-muted mb-1.5 ml-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1 ml-1">{hint}</span>}
    </label>
  )
}
export const inputCls = 'w-full h-12 px-4 rounded-2xl bg-surface-2 border border-line outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 transition placeholder:text-muted/60'

export function NumberStepper({ value, onChange, step = 1, min = 0, label, decimals = false }: { value: number; onChange: (v: number) => void; step?: number; min?: number; label?: string; decimals?: boolean }) {
  return (
    <div>
      {label && <div className="text-[13px] font-medium text-muted mb-1.5 ml-1">{label}</div>}
      <div className="flex items-center h-12 rounded-2xl bg-surface-2 border border-line overflow-hidden focus-within:border-accent">
        <button type="button" className="w-11 h-full grid place-items-center text-muted hover:text-fg active:bg-surface-3" onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}>
          <Icon name="minus" size={16} />
        </button>
        <input
          type="number"
          inputMode={decimals ? 'decimal' : 'numeric'}
          className="flex-1 min-w-0 h-full bg-transparent text-center font-display text-[18px] font-bold tabular outline-none"
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
    <div className={cx('flex p-1 rounded-full bg-surface-2 border border-line gap-1', className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={cx('flex-1 h-9 px-3 rounded-full text-[13px] font-semibold transition whitespace-nowrap', value === o.value ? 'bg-fg text-bg shadow-sm' : 'text-muted hover:text-fg')}
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
      className={cx('h-9 px-3.5 rounded-full text-[13px] font-semibold border whitespace-nowrap transition shrink-0 inline-flex items-center gap-1.5', active ? 'bg-fg border-fg text-bg' : 'bg-surface border-line text-muted hover:text-fg')}
    >
      {color && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  )
}

export function Empty({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-12 px-6">
      <div className="mx-auto w-16 h-16 rounded-[22px] accent-soft grid place-items-center mb-4 rotate-[-6deg]">
        <Icon name={icon} size={28} />
      </div>
      <div className="font-display text-xl font-bold">{title}</div>
      {text && <div className="text-[15px] text-muted mt-1.5 max-w-xs mx-auto">{text}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Stat({ label, value, sub, icon, tone, className }: { label: string; value: ReactNode; sub?: ReactNode; icon?: IconName; tone?: string; className?: string }) {
  return (
    <Card className={cx('p-4', className)}>
      <div className="flex items-center gap-1.5 text-[13px] text-muted font-medium">
        {icon && <Icon name={icon} size={15} style={{ color: tone }} />}
        {label}
      </div>
      <div className="font-display text-[28px] font-bold tabular mt-2 leading-none">{value}</div>
      {sub && <div className="text-xs text-muted mt-2">{sub}</div>}
    </Card>
  )
}

export function Badge({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'good' | 'warn' | 'bad' | 'muted' }) {
  const t = {
    accent: 'accent-soft',
    good: 'bg-good/15 text-good',
    warn: 'bg-warn/15 text-warn',
    bad: 'bg-bad/15 text-bad',
    muted: 'bg-surface-2 text-muted border border-line',
  }[tone]
  return <span className={cx('inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11.5px] font-semibold', t)}>{children}</span>
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
    <div className="fixed left-0 right-0 top-4 z-[60] flex flex-col items-center gap-2 pointer-events-none px-4 safe-top">
      {list.map((t) => (
        <div key={t.id} className="anim-pop bg-fg text-bg pl-3 pr-4 py-2.5 rounded-full text-sm font-semibold shadow-2xl flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-accent text-accent-ink grid place-items-center">
            <Icon name="check" size={12} strokeWidth={3.5} />
          </span>
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
      <p className="text-muted text-[15px]">{state?.text}</p>
    </Sheet>
  )
  return [confirm, node] as const
}
