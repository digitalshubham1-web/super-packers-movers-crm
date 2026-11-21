import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, Download, Upload } from 'lucide-react'
import { useStore } from '@/lib/store'
import { Button, Field, Modal, Select, Textarea, tableCls, tableWrap, tdCls, thCls } from '@/components/ui'
import { downloadCsv, parseCsv } from '@/lib/utils'

const TARGETS = [
  { id: 'name', label: 'Name *', match: /name|customer|client/i },
  { id: 'phone', label: 'Phone *', match: /phone|mobile|contact|number|whatsapp/i },
  { id: 'email', label: 'Email', match: /e-?mail/i },
  { id: 'city', label: 'City', match: /city|location|town/i },
  { id: 'source', label: 'Source', match: /source|channel|medium/i },
] as const
type Target = (typeof TARGETS)[number]['id']

const SAMPLE = [
  { Name: 'Rahul Sharma', Phone: '9876543210', Email: 'rahul@example.com', City: 'Gurugram', Source: 'Website' },
  { Name: 'Sunita Devi', Phone: '9812345678', Email: '', City: 'Noida', Source: 'Referral' },
]

/** Paste or upload a CSV, check the column mapping, then add the rows as leads. */
export default function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sources = useStore(s => s.sources)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [override, setOverride] = useState<Partial<Record<Target, string>>>({})
  const [defaultSource, setDefaultSource] = useState('')
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const rows = useMemo(() => parseCsv(text), [text])
  const headers = useMemo(() => (rows[0] ? Object.keys(rows[0]) : []), [rows])
  const mapping = useMemo(() => {
    const m = {} as Record<Target, string>
    const used = new Set<string>()
    TARGETS.forEach(t => {
      const chosen = override[t.id]
      const auto = headers.find(h => !used.has(h) && t.match.test(h)) ?? ''
      m[t.id] = chosen !== undefined && (chosen === '' || headers.includes(chosen)) ? chosen : auto
      if (m[t.id]) used.add(m[t.id])
    })
    return m
  }, [headers, override])

  const cell = (r: Record<string, string>, t: Target) => (mapping[t] ? (r[mapping[t]] ?? '').trim() : '')
  const ready = rows.filter(r => cell(r, 'name') && cell(r, 'phone')).length

  const close = () => { setText(''); setFileName(''); setOverride({}); setResult(null); setDefaultSource(''); onClose() }

  const pickFile = async (file?: File) => {
    if (!file) return
    setFileName(file.name)
    setOverride({})
    setText(await file.text())
  }

  const runImport = () => {
    const { createLead } = useStore.getState()
    let added = 0, skipped = 0
    rows.forEach(r => {
      const name = cell(r, 'name'), phone = cell(r, 'phone')
      if (!name || !phone) { skipped++; return }
      const srcText = cell(r, 'source').toLowerCase()
      const src = sources.find(s => s.label.toLowerCase() === srcText) ?? sources.find(s => srcText && s.label.toLowerCase().includes(srcText))
      createLead({ name, phone, email: cell(r, 'email') || undefined, city: cell(r, 'city') || undefined, sourceId: src?.id ?? (defaultSource || sources[0]?.id || '') })
      added++
    })
    setResult({ added, skipped })
  }

  return (
    <Modal
      open={open}
      onClose={close}
      wide
      title="Import leads from CSV"
      footer={result
        ? <Button variant="primary" onClick={close}>Done</Button>
        : <><Button onClick={close}>Cancel</Button><Button variant="primary" icon={Upload} disabled={!ready} onClick={runImport}>Import {ready || ''} lead{ready === 1 ? '' : 's'}</Button></>}
    >
      {result ? (
        <div className="flex flex-col items-center py-6 text-center">
          <span className="mb-3 grid size-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600"><CheckCircle2 size={22} /></span>
          <p className="font-medium">{result.added} lead{result.added === 1 ? '' : 's'} added</p>
          <p className="mt-1 text-sm text-muted">
            {result.skipped ? `${result.skipped} row${result.skipped === 1 ? ' was' : 's were'} skipped because the name or phone was missing.` : 'No rows were skipped.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { void pickFile(e.target.files?.[0]); e.target.value = '' }} />
            <Button icon={Upload} onClick={() => fileRef.current?.click()}>Choose a .csv file</Button>
            {fileName && <span className="text-xs text-muted">{fileName}</span>}
            <button type="button" onClick={() => downloadCsv('sample-leads.csv', SAMPLE)} className="ml-auto inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-brand hover:underline">
              <Download size={13} /> Download sample CSV
            </button>
          </div>
          <Field label="Or paste CSV text" hint="The first line must be the column headings, for example: Name,Phone,Email,City,Source">
            <Textarea rows={5} value={text} onChange={e => { setText(e.target.value); setFileName('') }} placeholder={'Name,Phone,Email,City,Source\nRahul Sharma,9876543210,rahul@example.com,Gurugram,Website'} className="font-mono text-xs" />
          </Field>

          {text.trim() !== '' && rows.length === 0 && <p className="text-sm text-amber-600">No data rows found. Add at least one line below the headings.</p>}

          {rows.length > 0 && (
            <>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Column mapping</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {TARGETS.map(t => (
                    <Field key={t.id} label={t.label}>
                      <Select value={mapping[t.id]} onChange={e => setOverride(o => ({ ...o, [t.id]: e.target.value }))}>
                        <option value="">Not in file</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </Select>
                    </Field>
                  ))}
                </div>
                {(!mapping.name || !mapping.phone) && <p className="mt-2 text-xs text-rose-600">Choose which columns hold the name and the phone number.</p>}
              </div>
              <Field label="Source for rows without a matching source" className="max-w-xs">
                <Select value={defaultSource || sources[0]?.id || ''} onChange={e => setDefaultSource(e.target.value)}>
                  {sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              </Field>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Preview — first {Math.min(5, rows.length)} of {rows.length} row{rows.length === 1 ? '' : 's'}</p>
                <div className={tableWrap}>
                  <table className={tableCls}>
                    <thead><tr>{TARGETS.map(t => <th key={t.id} className={thCls}>{t.label.replace(' *', '')}</th>)}<th className={thCls}>Result</th></tr></thead>
                    <tbody>
                      {rows.slice(0, 5).map((r, i) => {
                        const ok = cell(r, 'name') && cell(r, 'phone')
                        return (
                          <tr key={i}>
                            {TARGETS.map(t => <td key={t.id} className={tdCls}>{cell(r, t.id) || <span className="text-muted">—</span>}</td>)}
                            <td className={tdCls}>{ok ? <span className="text-xs text-emerald-600">Will be added</span> : <span className="text-xs text-rose-600">Skipped: name or phone missing</span>}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted">{ready} of {rows.length} row{rows.length === 1 ? '' : 's'} will be added{rows.length - ready ? `, ${rows.length - ready} will be skipped` : ''}.</p>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
