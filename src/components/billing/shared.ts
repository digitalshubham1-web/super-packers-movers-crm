import { useStore } from '@/lib/store'
import type { Invoice, InvoiceStatus, LineItem, Payment, Quotation, QuotationStatus } from '@/lib/types'
import { docTotals, fmtDate, inr, invoicePaid, uid } from '@/lib/utils'

export type Tone = 'neutral' | 'good' | 'bad' | 'warn' | 'info' | 'brand'
export type PayMode = Payment['mode']

export const PAY_MODES: { id: PayMode; label: string; tone: Tone; color: string }[] = [
  { id: 'cash', label: 'Cash', tone: 'good', color: '#10b981' },
  { id: 'upi', label: 'UPI', tone: 'brand', color: '#ea580c' },
  { id: 'bank', label: 'Bank transfer', tone: 'info', color: '#0ea5e9' },
  { id: 'card', label: 'Card', tone: 'warn', color: '#f59e0b' },
  { id: 'cheque', label: 'Cheque', tone: 'neutral', color: '#78716c' },
]
export const modeInfo = (m: PayMode) => PAY_MODES.find(x => x.id === m) ?? PAY_MODES[0]

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  issued: { label: 'Unpaid', tone: 'info' },
  partial: { label: 'Part paid', tone: 'warn' },
  paid: { label: 'Paid', tone: 'good' },
  cancelled: { label: 'Cancelled', tone: 'bad' },
}
export const QUOTE_STATUS: Record<QuotationStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'info' },
  accepted: { label: 'Accepted', tone: 'good' },
  rejected: { label: 'Rejected', tone: 'bad' },
}

/** Next document number: prefix + 4-digit sequence after the highest existing one. */
export function nextNumber(prefix: string, existing: string[]) {
  const max = existing.reduce((m, n) => {
    const hit = /(\d+)\s*$/.exec(n)
    return hit ? Math.max(m, parseInt(hit[1], 10)) : m
  }, 0)
  return prefix + String(max + 1).padStart(4, '0')
}

export const newLine = (taxPercent: number): LineItem => ({ id: uid(), description: '', qty: 1, rate: 0, taxPercent })
/** Keep only lines that have something on them. */
export const cleanLines = (lines: LineItem[]) =>
  lines.filter(l => l.description.trim() || l.rate > 0).map(l => ({ ...l, description: l.description.trim() || 'Item', qty: l.qty > 0 ? l.qty : 1 }))

/** yyyy-mm-dd from a date input → ISO (midday, so the day does not shift with the time zone). */
export const dateInputToIso = (v: string) => (v ? new Date(v + 'T12:00:00').toISOString() : undefined)
export const todayInput = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }

export function invoiceMoney(inv: Invoice, payments: Payment[]) {
  const { subtotal, tax, total } = docTotals(inv)
  const paid = invoicePaid(inv, payments)
  const balance = Math.max(0, Math.round(total) - Math.round(paid))
  return { subtotal, tax, total, paid, balance }
}
/** Status that follows from the money received. Draft and cancelled invoices are left alone. */
export function derivedStatus(inv: Invoice, payments: Payment[]): InvoiceStatus {
  if (inv.status === 'draft' || inv.status === 'cancelled') return inv.status
  const { paid, balance, total } = invoiceMoney(inv, payments)
  if (paid > 0 && balance <= 0) return 'paid'
  if (total <= 0) return 'issued'
  return paid > 0 ? 'partial' : 'issued'
}
/** Re-read the store and bring one invoice's status in line with its payments. */
export function syncInvoiceStatus(invoiceId: string) {
  const s = useStore.getState()
  const inv = s.invoices.find(i => i.id === invoiceId)
  if (!inv) return
  const next = derivedStatus(inv, s.payments)
  if (next !== inv.status) s.update('invoices', inv.id, { status: next })
}
export const isOpen = (inv: Invoice) => inv.status === 'issued' || inv.status === 'partial'
export const isBilled = (inv: Invoice) => inv.status !== 'draft' && inv.status !== 'cancelled'
export function daysOverdue(inv: Invoice) {
  if (!isOpen(inv) || !inv.dueDate) return 0
  const due = new Date(inv.dueDate); due.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((startOfToday().getTime() - due.getTime()) / 86400000))
}

/** wa.me link. Indian 10-digit numbers get the 91 country code. */
export function waLink(phone: string | undefined, text: string) {
  let d = (phone ?? '').replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  if (d.length === 10) d = '91' + d
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`
}
export function quotationShareText(q: Quotation, business: string) {
  const { total } = docTotals(q)
  const lines = q.lines.map(l => `• ${l.description} × ${l.qty}`).join('\n')
  return `Hello ${q.customerName},\nHere is your quotation ${q.number} from ${business}.\n${lines}\nTotal (incl. GST): ${inr(total)}${q.validUntil ? `\nValid until: ${fmtDate(q.validUntil)}` : ''}\nReply here to confirm your booking.`
}
export function invoiceShareText(inv: Invoice, payments: Payment[], business: string) {
  const { total, paid, balance } = invoiceMoney(inv, payments)
  return `Hello ${inv.customerName},\nInvoice ${inv.number} from ${business}.\nAmount (incl. GST): ${inr(total)}${paid > 0 ? `\nReceived: ${inr(paid)}` : ''}\nBalance due: ${inr(balance)}${inv.dueDate ? `\nDue date: ${fmtDate(inv.dueDate)}` : ''}\nThank you.`
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
const two = (n: number) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''))
const three = (n: number) => [n >= 100 ? ONES[Math.floor(n / 100)] + ' Hundred' : '', n % 100 ? two(n % 100) : ''].filter(Boolean).join(' ')
function indianWords(n: number): string {
  if (n === 0) return 'Zero'
  const crore = Math.floor(n / 10000000), lakh = Math.floor(n / 100000) % 100, thousand = Math.floor(n / 1000) % 100, rest = n % 1000
  return [crore ? indianWords(crore) + ' Crore' : '', lakh ? two(lakh) + ' Lakh' : '', thousand ? two(thousand) + ' Thousand' : '', rest ? three(rest) : ''].filter(Boolean).join(' ')
}
/** 125000.5 → "Rupees One Lakh Twenty Five Thousand and Fifty Paise Only" */
export function amountInWords(amount: number) {
  const paiseTotal = Math.round(Math.max(0, amount) * 100)
  const rupees = Math.floor(paiseTotal / 100), paise = paiseTotal % 100
  return `Rupees ${indianWords(rupees)}${paise ? ` and ${two(paise)} Paise` : ''} Only`
}
