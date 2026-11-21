import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday } from 'date-fns'

export const cn = (...a: ClassValue[]) => twMerge(clsx(a))
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
export const nowIso = () => new Date().toISOString()

/** ₹ formatting with Indian digit grouping. */
export const inr = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN')
export const fmtDate = (iso?: string) => (iso ? format(new Date(iso), 'dd MMM yyyy') : '—')
export const fmtDateTime = (iso?: string) => (iso ? format(new Date(iso), 'dd MMM yyyy, h:mm a') : '—')
export const fmtTime = (iso?: string) => (iso ? format(new Date(iso), 'h:mm a') : '—')
export const timeAgo = (iso?: string) => (iso ? formatDistanceToNowStrict(new Date(iso), { addSuffix: true }) : '—')
export const friendlyDay = (iso: string) => {
  const d = new Date(iso)
  if (isToday(d)) return 'Today, ' + format(d, 'h:mm a')
  if (isTomorrow(d)) return 'Tomorrow, ' + format(d, 'h:mm a')
  if (isYesterday(d)) return 'Yesterday, ' + format(d, 'h:mm a')
  return format(d, 'dd MMM, h:mm a')
}
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
export const fmtDuration = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`)
/** value for <input type="datetime-local"> */
export const toLocalInput = (iso?: string) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : '')
export const toDateInput = (iso?: string) => (iso ? format(new Date(iso), 'yyyy-MM-dd') : '')

/** Download rows as a CSV file. */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
/** Parse simple CSV text (quoted fields supported) into objects keyed by header. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let cur = '', row: string[] = [], q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += ch }
    else if (ch === '"') q = true
    else if (ch === ',') { row.push(cur); cur = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(c => c.trim())) rows.push(row); row = [] }
    else cur += ch
  }
  row.push(cur); if (row.some(c => c.trim())) rows.push(row)
  const [head, ...rest] = rows
  if (!head) return []
  return rest.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])))
}

import type { Invoice, LineItem, Payment, Quotation } from './types'
export const lineTotal = (l: LineItem) => l.qty * l.rate * (1 + l.taxPercent / 100)
export function docTotals(doc: Pick<Invoice | Quotation, 'lines' | 'discount'>) {
  const subtotal = doc.lines.reduce((s, l) => s + l.qty * l.rate, 0)
  const tax = doc.lines.reduce((s, l) => s + (l.qty * l.rate * l.taxPercent) / 100, 0)
  const total = Math.max(0, subtotal + tax - (doc.discount || 0))
  return { subtotal, tax, total }
}
export const invoicePaid = (inv: Invoice, payments: Payment[]) => payments.filter(p => p.invoiceId === inv.id).reduce((s, p) => s + p.amount, 0)
