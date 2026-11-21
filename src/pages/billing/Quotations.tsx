import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Eye, FileText, MessageCircle, Pencil, Plus, Printer, Receipt, Search, Send, Trash2, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { LineItem, Quotation, QuotationStatus } from '@/lib/types'
import { docTotals, fmtDate, inr, toDateInput, uid } from '@/lib/utils'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Tabs, Textarea, tableCls, tableWrap, tdCls, thCls, trCls } from '@/components/ui'
import LineItemsEditor, { TotalsBox } from '@/components/billing/LineItemsEditor'
import PrintableDoc from '@/components/billing/PrintableDoc'
import { QUOTE_STATUS, cleanLines, dateInputToIso, newLine, nextNumber, quotationShareText, startOfToday, todayInput, waLink } from '@/components/billing/shared'

interface Form { id?: string; leadId: string; customerName: string; customerPhone: string; issueDate: string; validUntil: string; lines: LineItem[]; discount: string; notes: string }
type Filter = 'all' | QuotationStatus

const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return toDateInput(d.toISOString()) }

export default function Quotations() {
  const quotations = useStore(s => s.quotations)
  const invoices = useStore(s => s.invoices)
  const leads = useStore(s => s.leads)
  const settings = useStore(s => s.settings)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [form, setForm] = useState<Form | null>(null)
  const [viewId, setViewId] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Quotation | null>(null)

  const blank = (leadId = ''): Form => {
    const lead = useStore.getState().leads.find(l => l.id === leadId)
    return { leadId: lead?.id ?? '', customerName: lead?.name ?? '', customerPhone: lead?.phone ?? '', issueDate: todayInput(), validUntil: plusDays(15), lines: [newLine(settings.defaultTax)], discount: '', notes: '' }
  }
  // /billing/quotations?new=1&leadId=ID opens the create form once, then the address is cleaned up.
  useEffect(() => {
    if (params.get('new') !== '1') return
    setForm(blank(params.get('leadId') ?? ''))
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: quotations.length, draft: 0, sent: 0, accepted: 0, rejected: 0 }
    quotations.forEach(x => c[x.status]++)
    return c
  }, [quotations])
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return quotations
      .filter(x => (filter === 'all' || x.status === filter) && (!t || [x.number, x.customerName, x.customerPhone].some(v => v?.toLowerCase().includes(t))))
      .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number))
  }, [quotations, filter, q])
  const viewing = quotations.find(x => x.id === viewId)

  const edit = (x: Quotation) => setForm({ id: x.id, leadId: x.leadId ?? '', customerName: x.customerName, customerPhone: x.customerPhone ?? '', issueDate: toDateInput(x.issueDate), validUntil: toDateInput(x.validUntil), lines: x.lines.map(l => ({ ...l })), discount: x.discount ? String(x.discount) : '', notes: x.notes ?? '' })
  const pickLead = (leadId: string) => setForm(f => { if (!f) return f; const lead = leads.find(l => l.id === leadId); return lead ? { ...f, leadId, customerName: lead.name, customerPhone: lead.phone } : { ...f, leadId: '' } })
  const formLines = form ? cleanLines(form.lines) : []
  const formError = !form ? '' : !form.customerName.trim() ? 'Enter the customer name.' : !formLines.length ? 'Add at least one line with a description or rate.' : !form.issueDate ? 'Choose the quotation date.' : ''

  const save = (send: boolean) => {
    if (!form || formError) return
    const s = useStore.getState()
    const data = {
      leadId: form.leadId || undefined, customerName: form.customerName.trim(), customerPhone: form.customerPhone.trim() || undefined, lines: formLines,
      discount: Math.max(0, parseFloat(form.discount) || 0), notes: form.notes.trim() || undefined, issueDate: dateInputToIso(form.issueDate)!, validUntil: dateInputToIso(form.validUntil),
    }
    let saved: Quotation
    if (form.id) { s.update('quotations', form.id, data); saved = { ...s.quotations.find(x => x.id === form.id)!, ...data } }
    else saved = s.add('quotations', { ...data, number: nextNumber(s.settings.quotationPrefix, s.quotations.map(x => x.number)), status: 'draft', createdAt: new Date().toISOString() })
    setForm(null)
    if (send) markSent(saved)
  }
  const markSent = (x: Quotation) => {
    const s = useStore.getState()
    s.update('quotations', x.id, { status: 'sent' })
    s.log('quotation', `Quotation ${x.number} for ${inr(docTotals(x).total)} marked as sent`, x.leadId)
  }
  const setStatus = (x: Quotation, status: 'accepted' | 'rejected') => {
    const s = useStore.getState()
    s.update('quotations', x.id, { status })
    s.log('quotation', `Quotation ${x.number} ${status} by the customer`, x.leadId)
  }
  const convert = (x: Quotation) => {
    const s = useStore.getState()
    const existing = x.invoiceId && s.invoices.find(i => i.id === x.invoiceId)
    if (existing) return navigate(`/billing/invoices/${existing.id}`)
    const lead = s.leads.find(l => l.id === x.leadId)
    const due = new Date(); due.setDate(due.getDate() + 7)
    const inv = s.add('invoices', {
      number: nextNumber(s.settings.invoicePrefix, s.invoices.map(i => i.number)), leadId: x.leadId, quotationId: x.id, customerName: x.customerName, customerPhone: x.customerPhone,
      customerAddress: lead?.address ?? lead?.moveFrom, lines: x.lines.map(l => ({ ...l, id: uid() })), discount: x.discount, notes: s.settings.invoiceTerms, status: 'draft',
      issueDate: new Date().toISOString(), dueDate: due.toISOString(), createdAt: new Date().toISOString(),
    })
    s.update('quotations', x.id, { invoiceId: inv.id, status: 'accepted' })
    s.log('invoice', `Draft invoice ${inv.number} created from quotation ${x.number}`, x.leadId)
    navigate(`/billing/invoices/${inv.id}`)
  }
  const share = (x: Quotation) => window.open(waLink(x.customerPhone, quotationShareText(x, settings.businessName)), '_blank', 'noopener')
  const linkedInvoice = (x: Quotation) => invoices.find(i => i.id === x.invoiceId)
  const expired = (x: Quotation) => (x.status === 'draft' || x.status === 'sent') && !!x.validUntil && new Date(x.validUntil) < startOfToday()
  const set = (p: Partial<Form>) => setForm(f => (f ? { ...f, ...p } : f))

  return (
    <div>
      <PageHeader title="Quotations" icon={FileText} subtitle="Price estimates you send before a booking is confirmed" actions={<Button variant="primary" icon={Plus} onClick={() => setForm(blank())}>New quotation</Button>} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Tabs<Filter> value={filter} onChange={setFilter} tabs={(['all', 'draft', 'sent', 'accepted', 'rejected'] as Filter[]).map(id => ({ id, label: id === 'all' ? 'All' : QUOTE_STATUS[id].label, count: counts[id] }))} />
        <div className="relative min-w-40 flex-1 sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input className="pl-8" placeholder="Search number, customer or phone" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      {!shown.length ? (
        <Card><EmptyState icon={FileText} title={quotations.length ? 'No quotations match' : 'No quotations yet'} text={quotations.length ? 'Try another status or search.' : 'Create a quotation for a lead and share it on WhatsApp or as a PDF.'} action={<Button variant="primary" icon={Plus} onClick={() => setForm(blank())}>New quotation</Button>} /></Card>
      ) : (
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead><tr><th className={thCls}>Number</th><th className={thCls}>Customer</th><th className={thCls}>Date</th><th className={thCls}>Valid until</th><th className={thCls + ' text-right'}>Amount</th><th className={thCls}>Status</th><th className={thCls + ' text-right'}>Actions</th></tr></thead>
            <tbody>
              {shown.map(x => {
                const inv = linkedInvoice(x)
                return (
                  <tr key={x.id} className={trCls}>
                    <td className={tdCls}><button className="cursor-pointer whitespace-nowrap font-medium text-brand hover:underline" onClick={() => setViewId(x.id)}>{x.number}</button></td>
                    <td className={tdCls}>{x.leadId ? <Link to={`/leads/${x.leadId}`} className="font-medium hover:text-brand">{x.customerName}</Link> : <span className="font-medium">{x.customerName}</span>}<div className="text-xs text-muted">{x.customerPhone || 'No phone'}</div></td>
                    <td className={tdCls + ' whitespace-nowrap'}>{fmtDate(x.issueDate)}</td>
                    <td className={tdCls + ' whitespace-nowrap'}>{fmtDate(x.validUntil)}{expired(x) && <div className="text-xs text-rose-600">Expired</div>}</td>
                    <td className={tdCls + ' whitespace-nowrap text-right font-medium'}>{inr(docTotals(x).total)}</td>
                    <td className={tdCls}><Badge tone={QUOTE_STATUS[x.status].tone}>{QUOTE_STATUS[x.status].label}</Badge>{inv && <div className="mt-0.5"><Link className="text-xs text-brand hover:underline" to={`/billing/invoices/${inv.id}`}>{inv.number}</Link></div>}</td>
                    <td className={tdCls}>
                      <div className="flex items-center justify-end gap-1">
                        {x.status === 'draft' && <Button size="sm" icon={Send} onClick={() => markSent(x)}>Mark sent</Button>}
                        {x.status === 'sent' && <><Button size="sm" icon={Check} onClick={() => setStatus(x, 'accepted')}>Accepted</Button><Button size="sm" variant="ghost" icon={X} onClick={() => setStatus(x, 'rejected')}>Rejected</Button></>}
                        {x.status === 'accepted' && <Button size="sm" icon={Receipt} onClick={() => convert(x)}>{inv ? 'Open invoice' : 'Convert to invoice'}</Button>}
                        {x.status === 'rejected' && <Button size="sm" variant="ghost" onClick={() => useStore.getState().update('quotations', x.id, { status: 'draft' })}>Reopen</Button>}
                        <Button size="sm" variant="ghost" icon={Eye} onClick={() => setViewId(x.id)} title="View, print or save as PDF" aria-label={`View ${x.number}`} />
                        <Button size="sm" variant="ghost" icon={MessageCircle} onClick={() => share(x)} title="Share on WhatsApp" aria-label={`Share ${x.number} on WhatsApp`} />
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => edit(x)} title="Edit" aria-label={`Edit ${x.number}`} />
                        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setToDelete(x)} title="Delete" aria-label={`Delete ${x.number}`} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} wide title={form?.id ? 'Edit quotation' : 'New quotation'} footer={<>
        {formError && <span className="mr-auto self-center text-xs text-muted">{formError}</span>}
        <Button onClick={() => setForm(null)}>Cancel</Button>
        <Button onClick={() => save(false)} disabled={!!formError}>{form?.id ? 'Save changes' : 'Save as draft'}</Button>
        {!form?.id && <Button variant="primary" icon={Send} onClick={() => save(true)} disabled={!!formError}>Save and mark sent</Button>}
      </>}>
        {form && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Lead" hint="Picking a lead fills the name and phone" className="sm:col-span-2">
                <Select value={form.leadId} onChange={e => pickLead(e.target.value)}>
                  <option value="">No lead — type the customer below</option>
                  {leads.map(l => <option key={l.id} value={l.id}>#{l.no} · {l.name} · {l.phone}</option>)}
                </Select>
              </Field>
              <Field label="Customer name *"><Input value={form.customerName} onChange={e => set({ customerName: e.target.value })} placeholder="Full name" /></Field>
              <Field label="Phone"><Input value={form.customerPhone} onChange={e => set({ customerPhone: e.target.value })} placeholder="+91 98XXXXXXXX" /></Field>
              <Field label="Quotation date"><Input type="date" value={form.issueDate} onChange={e => set({ issueDate: e.target.value })} /></Field>
              <Field label="Valid until"><Input type="date" value={form.validUntil} min={form.issueDate} onChange={e => set({ validUntil: e.target.value })} /></Field>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted">Line items</div>
              <LineItemsEditor lines={form.lines} onChange={lines => set({ lines })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-3">
                <Field label="Discount (₹)"><Input type="number" min={0} step="any" value={form.discount} onChange={e => set({ discount: e.target.value })} placeholder="0" /></Field>
                <Field label="Notes"><Textarea value={form.notes} onChange={e => set({ notes: e.target.value })} placeholder="e.g. Includes packing, loading and unloading. Toll extra." /></Field>
              </div>
              <TotalsBox lines={formLines} discount={Math.max(0, parseFloat(form.discount) || 0)} />
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewId(null)} wide title={viewing ? `Quotation ${viewing.number}` : ''} footer={viewing && <>
        <Button icon={Pencil} onClick={() => { edit(viewing); setViewId(null) }}>Edit</Button>
        <Button icon={MessageCircle} onClick={() => share(viewing)}>Share on WhatsApp</Button>
        <Button variant="primary" icon={Printer} onClick={() => window.print()}>Print / Save as PDF</Button>
      </>}>
        {viewing && <PrintableDoc doc={{ kind: 'quotation', number: viewing.number, customerName: viewing.customerName, customerPhone: viewing.customerPhone, lines: viewing.lines, discount: viewing.discount, notes: viewing.notes, issueDate: viewing.issueDate, secondDate: viewing.validUntil }} />}
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Delete quotation?" footer={<><Button onClick={() => setToDelete(null)}>Keep it</Button><Button variant="danger" onClick={() => { if (toDelete) useStore.getState().remove('quotations', toDelete.id); setToDelete(null) }}>Delete</Button></>}>
        <p className="text-sm">Delete quotation <span className="font-medium">{toDelete?.number}</span> for {toDelete?.customerName}? {toDelete?.invoiceId ? 'The invoice made from it stays.' : 'This cannot be undone.'}</p>
      </Modal>
    </div>
  )
}
