import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { LineItem } from '@/lib/types'
import { docTotals, inr, lineTotal } from '@/lib/utils'
import { Button, Input, Select } from '@/components/ui'
import { newLine } from './shared'

const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : 0 }

/** Editable list of document lines. Pick a catalogue item to fill a line, or type freely. */
export default function LineItemsEditor({ lines, onChange }: { lines: LineItem[]; onChange: (lines: LineItem[]) => void }) {
  const items = useStore(s => s.items)
  const defaultTax = useStore(s => s.settings.defaultTax)
  const patch = (id: string, p: Partial<LineItem>) => onChange(lines.map(l => (l.id === id ? { ...l, ...p } : l)))
  const pick = (id: string, itemId: string) => {
    const it = items.find(i => i.id === itemId)
    if (!it) return patch(id, { itemId: undefined })
    patch(id, { itemId: it.id, description: it.name, rate: it.price, taxPercent: it.taxPercent })
  }
  const lbl = 'mb-1 block text-[11px] font-medium text-muted'
  return (
    <div className="space-y-2">
      {lines.map((l, i) => (
        <div key={l.id} className="rounded-lg border border-border bg-surface-2/40 p-2.5">
          <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div>
              <span className={lbl}>Line {i + 1} · item</span>
              <Select value={l.itemId && items.some(x => x.id === l.itemId) ? l.itemId : ''} onChange={e => pick(l.id, e.target.value)} aria-label="Pick an item">
                <option value="">Free text</option>
                {items.filter(x => x.active || x.id === l.itemId).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </Select>
            </div>
            <div>
              <span className={lbl}>Description</span>
              <Input value={l.description} onChange={e => patch(l.id, { description: e.target.value })} placeholder="What are you charging for?" />
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 items-end gap-2 sm:grid-cols-[90px_130px_90px_minmax(0,1fr)_auto]">
            <div>
              <span className={lbl}>Qty</span>
              <Input type="number" min={0} step="any" value={l.qty || ''} onChange={e => patch(l.id, { qty: num(e.target.value) })} />
            </div>
            <div>
              <span className={lbl}>Rate (₹)</span>
              <Input type="number" min={0} step="any" value={l.rate || ''} placeholder="0" onChange={e => patch(l.id, { rate: num(e.target.value) })} />
            </div>
            <div>
              <span className={lbl}>GST %</span>
              <Input type="number" min={0} max={100} step="any" value={l.taxPercent === 0 ? '0' : l.taxPercent || ''} onChange={e => patch(l.id, { taxPercent: Math.min(100, num(e.target.value)) })} />
            </div>
            <div className="col-span-2 sm:col-span-1 sm:text-right">
              <span className={lbl}>Line total (incl. GST)</span>
              <div className="flex h-9 items-center font-semibold sm:justify-end">{inr(lineTotal(l))}</div>
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" icon={Trash2} onClick={() => onChange(lines.filter(x => x.id !== l.id))} aria-label={`Remove line ${i + 1}`}>Remove</Button>
            </div>
          </div>
        </div>
      ))}
      {!lines.length && <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted">No lines yet. Add the first one.</p>}
      <Button size="sm" icon={Plus} onClick={() => onChange([...lines, newLine(defaultTax)])}>Add line</Button>
    </div>
  )
}

/** Subtotal / GST / discount / total box shown under the editor. */
export function TotalsBox({ lines, discount, paid }: { lines: LineItem[]; discount: number; paid?: number }) {
  const { subtotal, tax, total } = docTotals({ lines, discount })
  const row = 'flex justify-between gap-6 py-1 text-sm'
  return (
    <div className="ml-auto w-full max-w-xs rounded-lg border border-border bg-surface-2/40 px-3 py-2">
      <div className={row}><span className="text-muted">Subtotal</span><span>{inr(subtotal)}</span></div>
      <div className={row}><span className="text-muted">GST</span><span>{inr(tax)}</span></div>
      {discount > 0 && <div className={row}><span className="text-muted">Discount</span><span>− {inr(discount)}</span></div>}
      <div className={row + ' border-t border-border font-semibold'}><span>Total</span><span>{inr(total)}</span></div>
      {paid !== undefined && paid > 0 && (
        <>
          <div className={row}><span className="text-muted">Received</span><span className="text-emerald-600">{inr(paid)}</span></div>
          <div className={row + ' font-semibold'}><span>Balance</span><span>{inr(Math.max(0, Math.round(total) - Math.round(paid)))}</span></div>
        </>
      )}
    </div>
  )
}
