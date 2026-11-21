import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { inr } from '@/lib/utils'
import { Button, Field, Input, Modal, Select } from '@/components/ui'
import { PAY_MODES, dateInputToIso, invoiceMoney, isOpen, modeInfo, syncInvoiceStatus, todayInput, type PayMode } from './shared'

/** Record money received against an invoice. Without `invoiceId` the user picks an unpaid invoice first. */
export default function PaymentModal({ open, onClose, invoiceId }: { open: boolean; onClose: () => void; invoiceId?: string }) {
  if (!open) return null
  return <Inner key={invoiceId ?? 'pick'} onClose={onClose} invoiceId={invoiceId} />
}

function Inner({ onClose, invoiceId }: { onClose: () => void; invoiceId?: string }) {
  const invoices = useStore(s => s.invoices)
  const payments = useStore(s => s.payments)
  const openInvoices = useMemo(() => invoices.filter(i => isOpen(i) && invoiceMoney(i, payments).balance > 0), [invoices, payments])
  const [invId, setInvId] = useState(invoiceId ?? openInvoices[0]?.id ?? '')
  const inv = invoices.find(i => i.id === invId)
  const balance = inv ? invoiceMoney(inv, payments).balance : 0
  const balanceOf = (id: string) => { const i = invoices.find(x => x.id === id); return i ? String(invoiceMoney(i, payments).balance) : '' }
  const [amount, setAmount] = useState<string>(() => balanceOf(invId))
  const [mode, setMode] = useState<PayMode>('upi')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState(todayInput())
  const amt = parseFloat(amount) || 0
  const error = !inv ? 'Choose an invoice.' : amt <= 0 ? 'Enter an amount above zero.' : amt > balance ? `This is more than the balance of ${inr(balance)}.` : !date ? 'Choose the payment date.' : ''

  const save = () => {
    if (error || !inv) return
    const { add, log } = useStore.getState()
    const today = date === todayInput()
    add('payments', { invoiceId: inv.id, amount: amt, mode, reference: reference.trim() || undefined, at: today ? new Date().toISOString() : dateInputToIso(date)! })
    syncInvoiceStatus(inv.id)
    const left = balance - amt
    log('invoice', `Payment of ${inr(amt)} received on ${inv.number} by ${modeInfo(mode).label}${left > 0 ? ` (balance ${inr(left)})` : ' (fully paid)'}`, inv.leadId)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Record payment" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={!!error}>Save payment</Button></>}>
      <div className="space-y-3">
        {invoiceId ? (
          inv && <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm"><span className="font-medium">{inv.number}</span> · {inv.customerName}<div className="text-xs text-muted">Balance {inr(balance)}</div></div>
        ) : (
          <Field label="Invoice">
            <Select value={invId} onChange={e => { setInvId(e.target.value); setAmount(balanceOf(e.target.value)) }}>
              {!openInvoices.length && <option value="">No unpaid invoices</option>}
              {openInvoices.map(i => <option key={i.id} value={i.id}>{i.number} · {i.customerName} · balance {inr(invoiceMoney(i, payments).balance)}</option>)}
            </Select>
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount received (₹)"><Input type="number" min={0} step="any" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
          <Field label="Paid by"><Select value={mode} onChange={e => setMode(e.target.value as PayMode)}>{PAY_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</Select></Field>
          <Field label="Reference" hint="UPI ID, cheque or transaction number (optional)"><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. UPI 4523…" /></Field>
          <Field label="Payment date"><Input type="date" value={date} max={todayInput()} onChange={e => setDate(e.target.value)} /></Field>
        </div>
        {error && inv && <p className="text-xs text-rose-600">{error}</p>}
        {!inv && <p className="text-xs text-muted">There is no invoice waiting for payment.</p>}
      </div>
    </Modal>
  )
}
