import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Plus, Search, Trash2, Wallet } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Payment } from '@/lib/types'
import { downloadCsv, fmtDate, inr, toDateInput } from '@/lib/utils'
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select, tableCls, tableWrap, tdCls, thCls, trCls } from '@/components/ui'
import PaymentModal from '@/components/billing/PaymentModal'
import { PAY_MODES, modeInfo, syncInvoiceStatus, type PayMode } from '@/components/billing/shared'

export default function Payments() {
  const payments = useStore(s => s.payments)
  const invoices = useStore(s => s.invoices)
  const [mode, setMode] = useState<'all' | PayMode>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [q, setQ] = useState('')
  const [recordOpen, setRecordOpen] = useState(false)
  const [toDelete, setToDelete] = useState<Payment | null>(null)

  const invById = useMemo(() => new Map(invoices.map(i => [i.id, i])), [invoices])
  // Everything except the mode filter, so the "by mode" cards stay comparable while one mode is picked.
  const inRange = useMemo(() => {
    const t = q.trim().toLowerCase()
    return payments.filter(p => {
      const day = toDateInput(p.at)
      if ((from && day < from) || (to && day > to)) return false
      if (!t) return true
      const inv = invById.get(p.invoiceId)
      return [inv?.number, inv?.customerName, inv?.customerPhone, p.reference].some(v => v?.toLowerCase().includes(t))
    }).sort((a, b) => b.at.localeCompare(a.at))
  }, [payments, invById, from, to, q])
  const shown = useMemo(() => (mode === 'all' ? inRange : inRange.filter(p => p.mode === mode)), [inRange, mode])
  const byMode = useMemo(() => PAY_MODES.map(m => { const list = inRange.filter(p => p.mode === m.id); return { ...m, total: list.reduce((s, p) => s + p.amount, 0), count: list.length } }), [inRange])
  const grand = byMode.reduce((s, m) => s + m.total, 0)
  const shownTotal = shown.reduce((s, p) => s + p.amount, 0)
  const filtered = mode !== 'all' || !!from || !!to || !!q.trim()

  const exportCsv = () => downloadCsv('payments.csv', shown.map(p => { const inv = invById.get(p.invoiceId); return { date: fmtDate(p.at), invoice: inv?.number ?? '', customer: inv?.customerName ?? '', mode: modeInfo(p.mode).label, reference: p.reference ?? '', amount: p.amount } }))
  const del = (p: Payment) => {
    const s = useStore.getState()
    const inv = s.invoices.find(i => i.id === p.invoiceId)
    s.remove('payments', p.id)
    syncInvoiceStatus(p.invoiceId)
    if (inv) s.log('invoice', `Payment of ${inr(p.amount)} on ${inv.number} was deleted`, inv.leadId)
  }
  const delInv = toDelete ? invById.get(toDelete.invoiceId) : undefined

  return (
    <div>
      <PageHeader title="Payments" icon={Wallet} subtitle="Money received against invoices" actions={<>
        <Button icon={Download} onClick={exportCsv} disabled={!shown.length}>Export CSV</Button>
        <Button variant="primary" icon={Plus} onClick={() => setRecordOpen(true)}>Record payment</Button>
      </>} />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <button onClick={() => setMode('all')} className={`cursor-pointer rounded-xl border bg-surface p-3 text-left ${mode === 'all' ? 'border-brand' : 'border-border'}`}>
          <div className="text-xs font-medium uppercase tracking-wide text-muted">All modes</div>
          <div className="mt-1 text-lg font-semibold">{inr(grand)}</div>
          <div className="text-xs text-muted">{inRange.length} payment{inRange.length === 1 ? '' : 's'}</div>
        </button>
        {byMode.map(m => (
          <button key={m.id} onClick={() => setMode(mode === m.id ? 'all' : m.id)} className={`cursor-pointer rounded-xl border bg-surface p-3 text-left ${mode === m.id ? 'border-brand' : 'border-border'}`}>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">{m.label}</div>
            <div className="mt-1 text-lg font-semibold">{inr(m.total)}</div>
            <div className="text-xs text-muted">{m.count} payment{m.count === 1 ? '' : 's'}{grand ? ` · ${Math.round((m.total / grand) * 100)}%` : ''}</div>
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="relative min-w-40 flex-1 sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input className="pl-8" placeholder="Search invoice, customer or reference" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Select className="w-auto" value={mode} onChange={e => setMode(e.target.value as typeof mode)} aria-label="Filter by payment mode">
          <option value="all">All modes</option>{PAY_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </Select>
        <label className="text-xs text-muted">From<Input type="date" className="mt-0.5 w-auto" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} /></label>
        <label className="text-xs text-muted">To<Input type="date" className="mt-0.5 w-auto" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} /></label>
        {filtered && <Button variant="ghost" onClick={() => { setMode('all'); setFrom(''); setTo(''); setQ('') }}>Clear filters</Button>}
      </div>

      {!shown.length ? (
        <Card><EmptyState icon={Wallet} title={payments.length ? 'No payments match' : 'No payments yet'} text={payments.length ? 'Change the filters or the dates.' : 'Record a payment against an issued invoice and it shows here.'} action={<Button variant="primary" icon={Plus} onClick={() => setRecordOpen(true)}>Record payment</Button>} /></Card>
      ) : (
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead><tr><th className={thCls}>Date</th><th className={thCls}>Invoice</th><th className={thCls}>Customer</th><th className={thCls}>Mode</th><th className={thCls}>Reference</th><th className={thCls + ' text-right'}>Amount</th><th className={thCls} /></tr></thead>
            <tbody>
              {shown.map(p => {
                const inv = invById.get(p.invoiceId)
                return (
                  <tr key={p.id} className={trCls}>
                    <td className={tdCls + ' whitespace-nowrap'}>{fmtDate(p.at)}</td>
                    <td className={tdCls}>{inv ? <Link to={`/billing/invoices/${inv.id}`} className="whitespace-nowrap font-medium text-brand hover:underline">{inv.number}</Link> : <span className="text-muted">Invoice removed</span>}{inv?.status === 'cancelled' && <div className="text-xs text-rose-600">Cancelled</div>}</td>
                    <td className={tdCls}>{inv ? (inv.leadId ? <Link to={`/leads/${inv.leadId}`} className="hover:text-brand">{inv.customerName}</Link> : inv.customerName) : '—'}</td>
                    <td className={tdCls}><Badge tone={modeInfo(p.mode).tone}>{modeInfo(p.mode).label}</Badge></td>
                    <td className={tdCls + ' text-muted'}>{p.reference || '—'}</td>
                    <td className={tdCls + ' whitespace-nowrap text-right font-medium'}>{inr(p.amount)}</td>
                    <td className={tdCls + ' text-right'}><Button size="sm" variant="ghost" icon={Trash2} onClick={() => setToDelete(p)}>Delete</Button></td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot><tr><td className="px-3 py-2.5 text-xs font-medium text-muted" colSpan={5}>{shown.length} payment{shown.length === 1 ? '' : 's'} shown</td><td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">{inr(shownTotal)}</td><td /></tr></tfoot>
          </table>
        </div>
      )}

      <PaymentModal open={recordOpen} onClose={() => setRecordOpen(false)} />
      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Delete payment?" footer={<><Button onClick={() => setToDelete(null)}>Keep payment</Button><Button variant="danger" onClick={() => { if (toDelete) del(toDelete); setToDelete(null) }}>Delete payment</Button></>}>
        <p className="text-sm">Delete the {toDelete ? modeInfo(toDelete.mode).label.toLowerCase() : ''} payment of <span className="font-medium">{inr(toDelete?.amount ?? 0)}</span>{delInv ? <> on <span className="font-medium">{delInv.number}</span> ({delInv.customerName})</> : null}?</p>
        {delInv && <p className="mt-2 text-xs text-muted">The invoice balance goes up by this amount and its status is worked out again.</p>}
      </Modal>
    </div>
  )
}
