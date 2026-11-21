import { createPortal } from 'react-dom'
import { useStore } from '@/lib/store'
import type { LineItem } from '@/lib/types'
import { docTotals, fmtDate, inr, lineTotal } from '@/lib/utils'
import { amountInWords } from './shared'

export interface PrintDoc {
  kind: 'invoice' | 'quotation'
  number: string
  customerName: string; customerPhone?: string; customerAddress?: string; gstin?: string
  lines: LineItem[]; discount: number; notes?: string
  issueDate: string; secondDate?: string
  statusLabel?: string
  paid?: number
}

/* On paper only the copy placed directly under <body> is shown; the app (#root) is hidden. */
const PRINT_CSS = `
.spm-print-root { display: none; }
@media print {
  @page { size: A4; margin: 12mm; }
  html, body { height: auto !important; background: #fff !important; }
  #root { display: none !important; }
  .spm-print-root { display: block; --c-surface: #fff; --c-surface-2: #f4f4f4; --c-border: #cfcfcf; --c-text: #111; --c-muted: #555; --c-brand: #c2410c; color: #111; font-size: 12px; }
  .spm-print-root .spm-sheet { border: 0 !important; padding: 0 !important; }
  .spm-print-root tr { break-inside: avoid; }
}`

const money = (n: number) => '₹' + (Math.round(n * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Sheet({ doc }: { doc: PrintDoc }) {
  const st = useStore(s => s.settings)
  const { subtotal, tax, total } = docTotals(doc)
  const isInv = doc.kind === 'invoice'
  const rates = [...new Set(doc.lines.map(l => l.taxPercent))].sort((a, b) => a - b)
  const th = 'border-b border-border bg-surface-2 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted'
  const td = 'border-b border-border px-2 py-1.5 align-top'
  const balance = Math.max(0, Math.round(total) - Math.round(doc.paid ?? 0))
  return (
    <div className="spm-sheet rounded-xl border border-border bg-surface p-5 text-text sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <div className="text-xl font-bold text-brand">{st.businessName}</div>
          <div className="mt-1 max-w-xs text-xs text-muted">{st.businessAddress}</div>
          <div className="text-xs text-muted">{[st.businessPhone, st.businessEmail].filter(Boolean).join(' · ')}</div>
          <div className="text-xs text-muted">GSTIN: {st.gstin || 'Not registered / not provided'}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold uppercase tracking-wide">{isInv ? 'Tax Invoice' : 'Quotation'}</div>
          <div className="text-sm font-medium">{doc.number}</div>
          <div className="mt-1 text-xs text-muted">{isInv ? 'Issued' : 'Date'}: {fmtDate(doc.issueDate)}</div>
          {doc.secondDate && <div className="text-xs text-muted">{isInv ? 'Due' : 'Valid until'}: {fmtDate(doc.secondDate)}</div>}
          {doc.statusLabel && <div className="mt-1 text-xs font-semibold uppercase">{doc.statusLabel}</div>}
        </div>
      </div>

      <div className="py-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{isInv ? 'Bill to' : 'Quotation for'}</div>
        <div className="font-semibold">{doc.customerName || '—'}</div>
        {doc.customerPhone && <div className="text-xs text-muted">{doc.customerPhone}</div>}
        {doc.customerAddress && <div className="max-w-sm whitespace-pre-line text-xs text-muted">{doc.customerAddress}</div>}
        {doc.gstin && <div className="text-xs text-muted">GSTIN: {doc.gstin}</div>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr>
              <th className={th}>#</th><th className={th}>Description</th><th className={th + ' text-right'}>Qty</th><th className={th + ' text-right'}>Rate</th>
              <th className={th + ' text-right'}>Taxable</th><th className={th + ' text-right'}>GST %</th><th className={th + ' text-right'}>CGST</th><th className={th + ' text-right'}>SGST</th><th className={th + ' text-right'}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => {
              const taxable = l.qty * l.rate, gst = (taxable * l.taxPercent) / 100
              return (
                <tr key={l.id}>
                  <td className={td}>{i + 1}</td><td className={td}>{l.description}</td><td className={td + ' text-right'}>{l.qty}</td><td className={td + ' text-right'}>{money(l.rate)}</td>
                  <td className={td + ' text-right'}>{money(taxable)}</td><td className={td + ' text-right'}>{l.taxPercent}%</td><td className={td + ' text-right'}>{money(gst / 2)}</td><td className={td + ' text-right'}>{money(gst / 2)}</td>
                  <td className={td + ' text-right font-medium'}>{money(lineTotal(l))}</td>
                </tr>
              )
            })}
            {!doc.lines.length && <tr><td className={td + ' text-center text-muted'} colSpan={9}>No lines added</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap justify-between gap-4">
        <div className="min-w-0 flex-1 text-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">GST summary</div>
          {rates.map(r => {
            const taxable = doc.lines.filter(l => l.taxPercent === r).reduce((s, l) => s + l.qty * l.rate, 0)
            const gst = (taxable * r) / 100
            return <div key={r} className="text-muted">On {money(taxable)} @ {r}%: CGST {r / 2}% {money(gst / 2)} + SGST {r / 2}% {money(gst / 2)}</div>
          })}
          <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Amount in words</div>
          <div className="font-medium">{amountInWords(total)}</div>
        </div>
        <div className="w-full max-w-[260px] text-sm">
          <div className="flex justify-between py-0.5"><span className="text-muted">Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="flex justify-between py-0.5"><span className="text-muted">CGST</span><span>{money(tax / 2)}</span></div>
          <div className="flex justify-between py-0.5"><span className="text-muted">SGST</span><span>{money(tax / 2)}</span></div>
          {doc.discount > 0 && <div className="flex justify-between py-0.5"><span className="text-muted">Discount</span><span>− {money(doc.discount)}</span></div>}
          <div className="mt-1 flex justify-between border-t border-border py-1 text-base font-bold"><span>Total</span><span>{inr(total)}</span></div>
          {isInv && (doc.paid ?? 0) > 0 && (
            <>
              <div className="flex justify-between py-0.5"><span className="text-muted">Received</span><span>{inr(doc.paid ?? 0)}</span></div>
              <div className="flex justify-between py-0.5 font-semibold"><span>Balance due</span><span>{inr(balance)}</span></div>
            </>
          )}
        </div>
      </div>

      {doc.notes && (
        <div className="mt-5 border-t border-border pt-3 text-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{isInv ? 'Terms and notes' : 'Notes'}</div>
          <div className="whitespace-pre-line text-muted">{doc.notes}</div>
        </div>
      )}
      <div className="mt-8 flex justify-between text-xs text-muted">
        <span>This is a computer-generated {isInv ? 'invoice' : 'quotation'}.</span>
        <span className="text-right">For {st.businessName}<br /><br />Authorised signatory</span>
      </div>
    </div>
  )
}

/** Shows the document on screen and keeps a print-only copy under <body>, so window.print() prints just the document. */
export default function PrintableDoc({ doc }: { doc: PrintDoc }) {
  return (
    <>
      <Sheet doc={doc} />
      {createPortal(<div className="spm-print-root"><style>{PRINT_CSS}</style><Sheet doc={doc} /></div>, document.body)}
    </>
  )
}
