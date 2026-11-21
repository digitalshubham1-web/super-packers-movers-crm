import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Ban, Check, MessageCircle, Printer, Receipt, RotateCcw, Save, Send, Wallet } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Invoice, LineItem } from '@/lib/types'
import { fmtDate, inr, toDateInput } from '@/lib/utils'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Tabs, Textarea } from '@/components/ui'
import LineItemsEditor, { TotalsBox } from '@/components/billing/LineItemsEditor'
import PrintableDoc from '@/components/billing/PrintableDoc'
import PaymentModal from '@/components/billing/PaymentModal'
import { INVOICE_STATUS, cleanLines, dateInputToIso, daysOverdue, invoiceMoney, invoiceShareText, isOpen, modeInfo, newLine, nextNumber, syncInvoiceStatus, todayInput, waLink } from '@/components/billing/shared'

interface Form { leadId: string; customerName: string; customerPhone: string; customerAddress: string; gstin: string; issueDate: string; dueDate: string; lines: LineItem[]; discount: string; notes: string }
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/

export default function InvoiceEditor() {
  const { id } = useParams()
  const invoice = useStore(s => s.invoices.find(i => i.id === id))
  if (id && !invoice) {
    return (
      <div>
        <PageHeader title="Invoice not found" icon={Receipt} />
        <Card><EmptyState icon={Receipt} title="This invoice does not exist" text="It may have been removed, or the link is wrong." action={<Link to="/billing/invoices"><Button variant="primary" icon={ArrowLeft}>Back to invoices</Button></Link>} /></Card>
      </div>
    )
  }
  return <Editor key={id ?? 'new'} invoice={invoice} />
}

function Editor({ invoice }: { invoice?: Invoice }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const leads = useStore(s => s.leads)
  const allPayments = useStore(s => s.payments)
  const invoiceNumbers = useStore(s => s.invoices.map(i => i.number).join('|'))
  const settings = useStore(s => s.settings)
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [payOpen, setPayOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setFormRaw] = useState<Form>(() => {
    if (invoice) return { leadId: invoice.leadId ?? '', customerName: invoice.customerName, customerPhone: invoice.customerPhone ?? '', customerAddress: invoice.customerAddress ?? '', gstin: invoice.gstin ?? '', issueDate: toDateInput(invoice.issueDate), dueDate: toDateInput(invoice.dueDate), lines: invoice.lines.map(l => ({ ...l })), discount: invoice.discount ? String(invoice.discount) : '', notes: invoice.notes ?? '' }
    const s = useStore.getState()
    const lead = s.leads.find(l => l.id === params.get('leadId'))
    const due = new Date(); due.setDate(due.getDate() + 7)
    return { leadId: lead?.id ?? '', customerName: lead?.name ?? '', customerPhone: lead?.phone ?? '', customerAddress: lead?.address ?? lead?.moveFrom ?? '', gstin: '', issueDate: todayInput(), dueDate: toDateInput(due.toISOString()), lines: [newLine(s.settings.defaultTax)], discount: '', notes: s.settings.invoiceTerms }
  })
  const set = (p: Partial<Form>) => { setSaved(false); setFormRaw(f => ({ ...f, ...p })) }

  const number = invoice?.number ?? nextNumber(settings.invoicePrefix, invoiceNumbers ? invoiceNumbers.split('|') : [])
  const status = invoice?.status ?? 'draft'
  const lines = useMemo(() => cleanLines(form.lines), [form.lines])
  const discount = Math.max(0, parseFloat(form.discount) || 0)
  const payments = useMemo(() => (invoice ? allPayments.filter(p => p.invoiceId === invoice.id).sort((a, b) => b.at.localeCompare(a.at)) : []), [allPayments, invoice])
  // The invoice as it would be saved right now; used for the totals, the preview and the WhatsApp text.
  const working: Invoice = {
    id: invoice?.id ?? 'new', number, leadId: form.leadId || undefined, quotationId: invoice?.quotationId, customerName: form.customerName.trim(), customerPhone: form.customerPhone.trim() || undefined,
    customerAddress: form.customerAddress.trim() || undefined, gstin: form.gstin.trim().toUpperCase() || undefined, lines, discount, notes: form.notes.trim() || undefined, status,
    issueDate: dateInputToIso(form.issueDate) ?? new Date().toISOString(), dueDate: dateInputToIso(form.dueDate), createdAt: invoice?.createdAt ?? new Date().toISOString(),
  }
  const money = invoiceMoney(working, payments)
  const late = invoice ? daysOverdue(invoice) : 0
  const gstinOdd = !!working.gstin && !GSTIN_RE.test(working.gstin)
  const error = !working.customerName ? 'Enter the customer name.' : !lines.length ? 'Add at least one line with a description or rate.' : !form.issueDate ? 'Choose the issue date.' : form.dueDate && form.dueDate < form.issueDate ? 'The due date is before the issue date.' : ''

  const pickLead = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return set({ leadId: '' })
    set({ leadId, customerName: lead.name, customerPhone: lead.phone, customerAddress: lead.address ?? lead.moveFrom ?? form.customerAddress })
  }
  const save = (issue: boolean) => {
    if (error) return
    const s = useStore.getState()
    const { id: _id, status: _st, number: _no, createdAt: _c, ...data } = working
    void _id; void _st; void _no; void _c
    if (!invoice) {
      const no = nextNumber(s.settings.invoicePrefix, s.invoices.map(i => i.number))
      const inv = s.add('invoices', { ...data, number: no, status: issue ? 'issued' : 'draft', createdAt: new Date().toISOString() })
      if (issue) s.log('invoice', `Invoice ${no} issued for ${inr(money.total)}`, inv.leadId)
      navigate(`/billing/invoices/${inv.id}`, { replace: true })
      return
    }
    const issuing = issue && invoice.status === 'draft'
    s.update('invoices', invoice.id, { ...data, ...(issuing ? { status: 'issued' as const } : {}) })
    syncInvoiceStatus(invoice.id)
    if (issuing) s.log('invoice', `Invoice ${invoice.number} issued for ${inr(money.total)}`, working.leadId)
    setSaved(true)
  }
  const cancelInvoice = () => {
    if (!invoice) return
    const s = useStore.getState()
    s.update('invoices', invoice.id, { status: 'cancelled' })
    s.log('invoice', `Invoice ${invoice.number} cancelled`, invoice.leadId)
    setCancelOpen(false)
  }
  const restore = () => {
    if (!invoice) return
    const s = useStore.getState()
    s.update('invoices', invoice.id, { status: 'issued' })
    syncInvoiceStatus(invoice.id)
    s.log('invoice', `Invoice ${invoice.number} restored`, invoice.leadId)
  }
  const share = () => window.open(waLink(working.customerPhone, invoiceShareText(working, payments, settings.businessName)), '_blank', 'noopener')
  const isDraft = status === 'draft'

  return (
    <div>
      <PageHeader
        title={invoice ? `Invoice ${number}` : 'New invoice'} icon={Receipt}
        subtitle={<span className="flex flex-wrap items-center gap-1.5"><Badge tone={INVOICE_STATUS[status].tone}>{invoice ? INVOICE_STATUS[status].label : 'Not saved yet'}</Badge>{!invoice && <span>Will be numbered {number}</span>}{late > 0 && <span className="text-rose-600">{late} day{late === 1 ? '' : 's'} overdue</span>}{saved && <span className="inline-flex items-center gap-1 text-emerald-600"><Check size={12} />Saved</span>}</span>}
        actions={<>
          <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/billing/invoices')}>All invoices</Button>
          {invoice && status === 'cancelled' && <Button icon={RotateCcw} onClick={restore}>Restore invoice</Button>}
          {invoice && status !== 'cancelled' && <Button variant="ghost" icon={Ban} onClick={() => setCancelOpen(true)}>Cancel invoice</Button>}
          {isDraft ? <>
            <Button icon={Save} onClick={() => save(false)} disabled={!!error}>Save as draft</Button>
            <Button variant="primary" icon={Send} onClick={() => save(true)} disabled={!!error}>Save and issue</Button>
          </> : <Button variant="primary" icon={Save} onClick={() => save(false)} disabled={!!error}>Save changes</Button>}
        </>}
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Tabs<'edit' | 'preview'> value={tab} onChange={setTab} tabs={[{ id: 'edit', label: 'Details' }, { id: 'preview', label: 'Preview' }]} />
        {error && <span className="text-xs text-muted">{error}</span>}
      </div>

      {tab === 'preview' ? (
        <div className="mx-auto max-w-4xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">{invoice && !saved ? 'The preview shows what is on the Details tab, including changes you have not saved yet.' : 'This is how the tax invoice prints.'}</p>
            <div className="flex flex-wrap gap-2">
              <Button icon={MessageCircle} onClick={share}>Share on WhatsApp</Button>
              <Button variant="primary" icon={Printer} onClick={() => window.print()}>Print / Save as PDF</Button>
            </div>
          </div>
          {!settings.gstin && <p className="mb-3 rounded-lg bg-amber-500/15 px-3 py-2 text-xs text-amber-600">Your business GSTIN is empty. Add it in Settings so it prints on tax invoices.</p>}
          <PrintableDoc doc={{ kind: 'invoice', number, customerName: working.customerName, customerPhone: working.customerPhone, customerAddress: working.customerAddress, gstin: working.gstin, lines, discount, notes: working.notes, issueDate: working.issueDate, secondDate: working.dueDate, statusLabel: status === 'draft' ? 'Draft' : status === 'cancelled' ? 'Cancelled' : status === 'paid' ? 'Paid' : undefined, paid: money.paid }} />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <Card title="Customer">
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <Field label="Lead" hint="Picking a lead fills the name, phone and address" className="sm:col-span-2">
                  <Select value={form.leadId} onChange={e => pickLead(e.target.value)}>
                    <option value="">No lead — type the customer below</option>
                    {leads.map(l => <option key={l.id} value={l.id}>#{l.no} · {l.name} · {l.phone}</option>)}
                  </Select>
                </Field>
                <Field label="Customer name *"><Input value={form.customerName} onChange={e => set({ customerName: e.target.value })} placeholder="Full name or company" /></Field>
                <Field label="Phone"><Input value={form.customerPhone} onChange={e => set({ customerPhone: e.target.value })} placeholder="+91 98XXXXXXXX" /></Field>
                <Field label="Billing address"><Textarea className="min-h-16" value={form.customerAddress} onChange={e => set({ customerAddress: e.target.value })} placeholder="House / flat, area, city, PIN" /></Field>
                <Field label="Customer GSTIN" hint={gstinOdd ? 'This does not look like a 15-character GSTIN. You can still save.' : 'Only for business customers'}><Input value={form.gstin} onChange={e => set({ gstin: e.target.value.toUpperCase() })} placeholder="06ABCDE1234F1Z5" maxLength={15} /></Field>
              </div>
            </Card>

            <Card title="Dates">
              <div className="grid grid-cols-2 gap-3 p-4">
                <Field label="Issue date"><Input type="date" value={form.issueDate} onChange={e => set({ issueDate: e.target.value })} /></Field>
                <Field label="Due date"><Input type="date" value={form.dueDate} min={form.issueDate} onChange={e => set({ dueDate: e.target.value })} /></Field>
              </div>
            </Card>

            <Card title="Line items">
              <div className="p-4"><LineItemsEditor lines={form.lines} onChange={l => set({ lines: l })} /></div>
            </Card>

            <Card title="Discount, notes and terms">
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <Field label="Discount (₹)"><Input type="number" min={0} step="any" value={form.discount} onChange={e => set({ discount: e.target.value })} placeholder="0" /></Field>
                  <Field label="Notes and terms" hint="Printed at the bottom of the invoice"><Textarea className="min-h-24" value={form.notes} onChange={e => set({ notes: e.target.value })} /></Field>
                  {form.notes !== settings.invoiceTerms && <Button size="sm" variant="ghost" onClick={() => set({ notes: settings.invoiceTerms })}>Use the standard terms</Button>}
                </div>
                <TotalsBox lines={lines} discount={discount} paid={money.paid} />
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card title="Summary">
              <div className="space-y-1.5 p-4 text-sm">
                <div className="flex justify-between"><span className="text-muted">Total</span><span className="font-semibold">{inr(money.total)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Received</span><span className="text-emerald-600">{inr(money.paid)}</span></div>
                <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold"><span>Balance</span><span>{inr(status === 'cancelled' ? 0 : money.balance)}</span></div>
                {form.leadId && <Link to={`/leads/${form.leadId}`} className="block pt-1 text-xs text-brand hover:underline">Open the lead</Link>}
                {invoice?.quotationId && <div className="text-xs text-muted">Made from a quotation</div>}
              </div>
            </Card>

            {invoice ? (
              <Card title="Payment history" action={isOpen(invoice) && money.balance > 0 ? <Button size="sm" variant="primary" icon={Wallet} onClick={() => setPayOpen(true)}>Record payment</Button> : undefined}>
                {payments.length ? (
                  <ul>
                    {payments.map(p => (
                      <li key={p.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-sm last:border-b-0">
                        <div className="min-w-0"><div className="font-medium">{inr(p.amount)}</div><div className="truncate text-xs text-muted">{fmtDate(p.at)}{p.reference ? ` · ${p.reference}` : ''}</div></div>
                        <Badge tone={modeInfo(p.mode).tone}>{modeInfo(p.mode).label}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-6 text-center text-sm text-muted">{isDraft ? 'Issue the invoice to start recording payments.' : status === 'cancelled' ? 'No payments were recorded.' : 'No payments recorded yet.'}</p>
                )}
              </Card>
            ) : (
              <Card><p className="p-4 text-xs text-muted">Save the invoice to record payments against it. A draft is not counted in revenue until you issue it.</p></Card>
            )}
          </div>
        </div>
      )}

      {invoice && <PaymentModal open={payOpen} invoiceId={invoice.id} onClose={() => setPayOpen(false)} />}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel invoice?" footer={<><Button onClick={() => setCancelOpen(false)}>Keep invoice</Button><Button variant="danger" onClick={cancelInvoice}>Cancel invoice</Button></>}>
        <p className="text-sm">Cancel <span className="font-medium">{number}</span>? It is left out of revenue and outstanding totals. You can restore it later.</p>
        {money.paid > 0 && <p className="mt-2 rounded-lg bg-amber-500/15 px-3 py-2 text-xs text-amber-600">{inr(money.paid)} is already recorded against it. Those payments stay on the Payments page.</p>}
      </Modal>
    </div>
  )
}
