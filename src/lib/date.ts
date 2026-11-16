export const WEEKDAYS = [
  { short: 'Mo', label: 'Montag' },
  { short: 'Di', label: 'Dienstag' },
  { short: 'Mi', label: 'Mittwoch' },
  { short: 'Do', label: 'Donnerstag' },
  { short: 'Fr', label: 'Freitag' },
  { short: 'Sa', label: 'Samstag' },
  { short: 'So', label: 'Sonntag' },
]

/** 0 = Montag … 6 = Sonntag */
export const weekdayOf = (d: Date) => (d.getDay() + 6) % 7

export function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
export function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
export function startOfWeek(d: Date = new Date(), offsetWeeks = 0) {
  const x = startOfDay(d)
  return addDays(x, -weekdayOf(x) + offsetWeeks * 7)
}
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const parseIsoDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const sameDay = (a: Date, b: Date) => isoDate(a) === isoDate(b)

export const fmtDate = (d: Date | string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  new Date(d).toLocaleDateString('de-DE', opts)
export const fmtDateLong = (d: Date | string) =>
  new Date(d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
export const fmtTime = (d: Date | string) => new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

export function fmtDuration(sec: number | null | undefined) {
  if (!sec) return '–'
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h ? `${h} h ${m} min` : `${m} min`
}
export function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(ss).padStart(2, '0')}`
}
export function relDay(d: Date | string) {
  const days = Math.round((startOfDay(new Date()).getTime() - startOfDay(new Date(d)).getTime()) / 864e5)
  if (days === 0) return 'Heute'
  if (days === 1) return 'Gestern'
  if (days < 7) return `vor ${days} Tagen`
  return fmtDate(d)
}
export function weekLabel(start: Date) {
  const end = addDays(start, 6)
  const cur = startOfWeek()
  if (sameDay(start, cur)) return 'Diese Woche'
  if (sameDay(start, addDays(cur, -7))) return 'Letzte Woche'
  if (sameDay(start, addDays(cur, 7))) return 'Nächste Woche'
  return `${fmtDate(start)} – ${fmtDate(end)}`
}
