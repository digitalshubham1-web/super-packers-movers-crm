import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Ban, Download, FolderOpen, IndianRupee, Plus, Receipt, Search, Wallet } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Invoice, InvoiceStatus } from '@/lib/types'
import { downloadCsv, fmtDate, inr } from '@/lib/utils'
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select, StatCard, tableCls, tableWrap, tdCls, thCls, trCls } from '@/components/ui'
import PaymentModal from '@/components/billing/PaymentModal'
import { INVOICE_STATUS, daysOverdue, invoiceMoney, isBilled, isOpen } from '@/components/billing/shared'

type SortKey = 'newest' | 'oldest' | 'amount' | 'balance' | 'due'

export default function Invoices() {
  const invoices = useStore(s => s.invoices)
  const payments = useStore(s => s.payments)
  const navigate = useNavigate()
  const [status, setStatus] = useState<'all' | InvoiceStatus>('all')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [payFor, setPayFor] = useState<string | null>(null)
  const [toCancel, setToCancel] = useState<Invoice | null>(null)

  const rows = useMemo(() => invoices.map(inv => ({ inv, ...invoiceMoney(inv, payments), late: daysOverdue(inv) })), [invoices, payments])
  const stats = useMemo(() => {
    const billed = rows.filter(r => isBilled(r.inv))
    const open = rows.filter(r => isOpen(r.inv))
    const late = open.filter(r => r.late > 0)
    return {
      invoiced: billed.reduce((s, r) => s + r.total, 0), count: billed.length, collected: billed.reduce((s, r) => s + r.paid, 0),
      outstanding: open.reduce((s, r) => s + r.balance, 0), openCount: open.filter(r => r.balance > 0).length, overdue: late.reduce((s, r) => s + r.balance, 0), lateCount: late.length,
    }
  }, [rows])
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = rows.filter(r => (status === 'all' || r.inv.status === status) && (!overdueOnly || r.late > 0) && (!t || [r.inv.number, r.inv.customerName, r.inv.customerPhone].some(v => v?.toLowerCase().includes(t))))
    const by: Record<SortKey, (a: typeof rows[number], b: typeof rows[number]) => number> = {
      newest: (a, b) => b.inv.issueDate.localeCompare(a.inv.issueDate) || b.inv.number.localeCompare(a.inv.number),
      oldest: (a, b) => a.inv.issueDate.localeCompare(b.inv.issueDate) || a.inv.number.localeCompare(b.inv.number),
      amount: (a, b) => b.total - a.total,
      balance: (a, b) => (isOpen(b.inv) ? b.balance : -1) - (isOpen(a.inv) ? a.balance : -1),
      due: (a, b) => (a.inv.dueDate ?? '9999').localeCompare(b.inv.dueDate ?? '9999'),
    }
    return [...list].sort(by[sort])
  }, [rows, status, overdueOnly, q, sort])

  const exportCsv = () => downloadCsv('invoices.csv', shown.map(r => ({
    number: r.inv.number, customer: r.inv.customerName, phone: r.inv.customerPhone ?? '', issued: fmtDate(r.inv.issueDate), due: r.inv.dueDate ? fmtDate(r.inv.dueDate) : '',
    subtotal: Math.round(r.subtotal), gst: Math.round(r.tax), discount: r.inv.discount, amount: Math.round(r.total), collected: Math.round(r.paid), balance: isBilled(r.inv) ? r.balance : 0, status: INVOICE_STATUS[r.inv.status].label,
  })))
  const cancel = (inv: Invoice) => {
    const s = useStore.getState()
    s.update('invoices', inv.id, { status: 'cancelled' })
    s.log('invoice', `Invoice ${inv.number} cancelled`, inv.leadId)
  }
  const cancelPaid = toCancel ? invoiceMoney(toCancel, payments).paid : 0

  return (
    <div>
      <PageHeader title="Invoices" icon={Receipt} subtitle="GST invoices and what is still to be collected" actions={<>
        <Button icon={Download} onClick={exportCsv} disabled={!shown.length}>Export CSV</Button>
        <Button variant="primary" icon={Plus} onClick={() => navigate('/billing/invoices/new')}>New invoice</Button>
      </>} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total invoiced" value={inr(stats.invoiced)} hint={`${stats.count} invoice${stats.count === 1 ? '' : 's'}, drafts and cancelled left out`} icon={IndianRupee} />
        <StatCard label="Collected" value={inr(stats.collected)} tone="good" icon={Wallet} hint={stats.invoiced ? `${Math.round((stats.collected / stats.invoiced) * 100)}% of invoiced` : undefined} />
        <StatCard label="Outstanding" value={inr(stats.outstanding)} tone={stats.outstanding ? 'warn' : 'default'} icon={Receipt} hint={`${stats.openCount} invoice${stats.openCount === 1 ? '' : 's'} waiting`} />
        <StatCard label="Overdue" value={inr(stats.overdue)} tone={stats.overdue ? 'bad' : 'default'} icon={AlertTriangle} hint={`${stats.lateCount} past the due date`} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1 sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input className="pl-8" placeholder="Search number, customer or phone" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Select className="w-auto" value={status} onChange={e => setStatus(e.target.value as typeof status)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          {(Object.keys(INVOICE_STATUS) as InvoiceStatus[]).map(k => <option key={k} value={k}>{INVOICE_STATUS[k].label}</option>)}
        </Select>
        <Select className="w-auto" value={sort} onChange={e => setSort(e.target.value as SortKey)} aria-label="Sort invoices">
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="amount">Amount: high to low</option><option value="balance">Balance: high to low</option><option value="due">Due date: earliest first</option>
        </Select>
        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm">
          <input type="checkbox" className="accent-[var(--c-brand)]" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} /> Overdue only
        </label>
      </div>

      {!shown.length ? (
        <Card><EmptyState icon={Receipt} title={invoices.length ? 'No invoices match' : 'No invoices yet'} text={invoices.length ? 'Change the filters or search.' : 'Create your first GST invoice, or convert an accepted quotation.'} action={<Button variant="primary" icon={Plus} onClick={() => navigate('/billing/invoices/new')}>New invoice</Button>} /></Card>
      ) : (
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead><tr><th className={thCls}>Number</th><th className={thCls}>Customer</th><th className={thCls}>Issued</th><th className={thCls}>Due</th><th className={thCls + ' text-right'}>Amount</th><th className={thCls + ' text-right'}>Collected</th><th className={thCls + ' text-right'}>Balance</th><th className={thCls}>Status</th><th className={thCls + ' text-right'}>Actions</th></tr></thead>
            <tbody>
              {shown.map(({ inv, total, paid, balance, late }) => (
                <tr key={inv.id} className={trCls}>
                  <td className={tdCls}><Link to={`/billing/invoices/${inv.id}`} className="whitespace-nowrap font-medium text-brand hover:underline">{inv.number}</Link></td>
                  <td className={tdCls}>{inv.leadId ? <Link to={`/leads/${inv.leadId}`} className="font-medium hover:text-brand">{inv.customerName}</Link> : <span className="font-medium">{inv.customerName}</span>}<div className="text-xs text-muted">{inv.customerPhone || 'No phone'}</div></td>
                  <td className={tdCls + ' whitespace-nowrap'}>{fmtDate(inv.issueDate)}</td>
                  <td className={tdCls + ' whitespace-nowrap'}>{fmtDate(inv.dueDate)}{late > 0 && <div className="text-xs text-rose-600">{late} day{late === 1 ? '' : 's'} overdue</div>}</td>
                  <td className={tdCls + ' whitespace-nowrap text-right font-medium'}>{inr(total)}</td>
                  <td className={tdCls + ' whitespace-nowrap text-right text-emerald-600'}>{paid ? inr(paid) : '—'}</td>
                  <td className={tdCls + ' whitespace-nowrap text-right font-medium'}>{isOpen(inv) ? inr(balance) : '—'}</td>
                  <td className={tdCls}><Badge tone={INVOICE_STATUS[inv.status].tone}>{INVOICE_STATUS[inv.status].label}</Badge></td>
                  <td className={tdCls}>
                    <div className="flex items-center justify-end gap-1">
                      {isOpen(inv) && balance > 0 && <Button size="sm" icon={Wallet} onClick={() => setPayFor(inv.id)}>Record payment</Button>}
                      <Button size="sm" variant="ghost" icon={FolderOpen} onClick={() => navigate(`/billing/invoices/${inv.id}`)}>Open</Button>
                      {inv.status !== 'cancelled' && <Button size="sm" variant="ghost" icon={Ban} onClick={() => setToCancel(inv)}>Cancel</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaymentModal open={!!payFor} invoiceId={payFor ?? undefined} onClose={() => setPayFor(null)} />
      <Modal open={!!toCancel} onClose={() => setToCancel(null)} title="Cancel invoice?" footer={<><Button onClick={() => setToCancel(null)}>Keep invoice</Button><Button variant="danger" onClick={() => { if (toCancel) cancel(toCancel); setToCancel(null) }}>Cancel invoice</Button></>}>
        <p className="text-sm">Cancel <span className="font-medium">{toCancel?.number}</span> for {toCancel?.customerName}? It stays in the list as cancelled and is left out of the totals.</p>
        {cancelPaid > 0 && <p className="mt-2 rounded-lg bg-amber-500/15 px-3 py-2 text-xs text-amber-600">{inr(cancelPaid)} is already recorded against this invoice. Those payments stay on the Payments page; delete them there if you refunded the customer.</p>}
      </Modal>
    </div>
  )
}
