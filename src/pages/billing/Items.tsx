import { useMemo, useRef, useState } from 'react'
import { Download, LayoutGrid, List, Minus, Package, Pencil, Plus, Search, Trash2, Upload, Wrench } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Item } from '@/lib/types'
import { downloadCsv, inr, parseCsv } from '@/lib/utils'
import { Badge, Button, Card, Drawer, EmptyState, Field, Input, Modal, PageHeader, Select, Tabs, Textarea, Toggle, tableCls, tableWrap, tdCls, thCls, trCls } from '@/components/ui'

const LOW_STOCK = 10
type Kind = 'all' | 'goods' | 'service'
type SortKey = 'name' | 'price_desc' | 'price_asc' | 'stock_asc' | 'category'
type Form = { name: string; kind: Item['kind']; sku: string; category: string; unit: string; price: string; taxPercent: string; stock: string; active: boolean }

const SAMPLE = 'name,kind,sku,category,unit,price,gst,stock\nPacking tape (48mm),goods,TAPE-48,Packing material,roll,60,12,150\nOffice shifting (per truck),service,OS-TRK,Office shifting,trip,18000,18,'

interface ImportRow { data: Omit<Item, 'id'>; existingId?: string; problem?: string }

export default function Items() {
  const items = useStore(s => s.items)
  const defaultTax = useStore(s => s.settings.defaultTax)
  const [view, setView] = useState<'list' | 'cards'>('list')
  const [kind, setKind] = useState<Kind>('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('name')
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [toDelete, setToDelete] = useState<Item | null>(null)
  const [adjust, setAdjust] = useState<{ item: Item; qty: string; dir: 'add' | 'remove' } | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const counts = useMemo(() => ({ all: items.length, goods: items.filter(i => i.kind === 'goods').length, service: items.filter(i => i.kind === 'service').length }), [items])
  const categories = useMemo(() => [...new Set(items.map(i => i.category).filter(Boolean) as string[])].sort(), [items])
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = items.filter(i => (kind === 'all' || i.kind === kind) && (!t || [i.name, i.sku, i.category].some(v => v?.toLowerCase().includes(t))))
    const by: Record<SortKey, (a: Item, b: Item) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      price_desc: (a, b) => b.price - a.price,
      price_asc: (a, b) => a.price - b.price,
      stock_asc: (a, b) => (a.kind === 'goods' ? a.stock ?? 0 : Infinity) - (b.kind === 'goods' ? b.stock ?? 0 : Infinity),
      category: (a, b) => (a.category ?? '').localeCompare(b.category ?? '') || a.name.localeCompare(b.name),
    }
    return [...list].sort(by[sort])
  }, [items, kind, q, sort])

  const openForm = (it: Item | 'new') => {
    setEditing(it)
    setForm(it === 'new'
      ? { name: '', kind: kind === 'goods' ? 'goods' : 'service', sku: '', category: '', unit: kind === 'goods' ? 'pc' : 'job', price: '', taxPercent: String(defaultTax), stock: '0', active: true }
      : { name: it.name, kind: it.kind, sku: it.sku ?? '', category: it.category ?? '', unit: it.unit, price: String(it.price), taxPercent: String(it.taxPercent), stock: String(it.stock ?? 0), active: it.active })
  }
  const closeForm = () => { setEditing(null); setForm(null) }
  const saveForm = () => {
    if (!form || !form.name.trim()) return
    const data: Omit<Item, 'id'> = {
      name: form.name.trim(), kind: form.kind, sku: form.sku.trim() || undefined, category: form.category.trim() || undefined, unit: form.unit.trim() || 'unit',
      price: Math.max(0, parseFloat(form.price) || 0), taxPercent: Math.min(100, Math.max(0, parseFloat(form.taxPercent) || 0)),
      stock: form.kind === 'goods' ? Math.max(0, Math.round(parseFloat(form.stock) || 0)) : undefined, active: form.active,
    }
    const { add, update } = useStore.getState()
    if (editing && editing !== 'new') update('items', editing.id, data); else add('items', data)
    closeForm()
  }
  const bump = (it: Item, by: number) => useStore.getState().update('items', it.id, { stock: Math.max(0, (it.stock ?? 0) + by) })

  const importRows = useMemo<ImportRow[]>(() => {
    if (!csvText.trim()) return []
    return parseCsv(csvText).map(raw => {
      const r: Record<string, string> = {}
      for (const [k, v] of Object.entries(raw)) r[k.toLowerCase().replace(/[^a-z]/g, '')] = v
      const name = r.name ?? r.item ?? r.itemname ?? ''
      const k: Item['kind'] = /good|product/i.test(r.kind ?? r.type ?? '') ? 'goods' : 'service'
      const n = (v?: string) => { const x = parseFloat((v ?? '').replace(/[₹,%\s]/g, '')); return Number.isFinite(x) && x >= 0 ? x : undefined }
      const sku = r.sku || undefined
      const existing = items.find(i => (sku && i.sku?.toLowerCase() === sku.toLowerCase()) || i.name.toLowerCase() === name.toLowerCase())
      return {
        data: {
          name, kind: k, sku, category: r.category || undefined, unit: r.unit || (k === 'goods' ? 'pc' : 'job'), price: n(r.price ?? r.rate) ?? 0,
          taxPercent: Math.min(100, n(r.gst ?? r.taxpercent ?? r.tax ?? r.gstpercent) ?? defaultTax), stock: k === 'goods' ? Math.round(n(r.stock) ?? 0) : undefined,
          active: !/^(no|false|0|inactive)$/i.test(r.active ?? ''),
        },
        existingId: existing?.id, problem: name ? undefined : 'No name',
      }
    })
  }, [csvText, items, defaultTax])
  const goodRows = importRows.filter(r => !r.problem)
  const runImport = () => {
    const { add, update } = useStore.getState()
    goodRows.forEach(r => (r.existingId ? update('items', r.existingId, r.data) : add('items', r.data)))
    setImportOpen(false); setCsvText('')
  }
  const readFile = (f?: File) => { if (!f) return; const rd = new FileReader(); rd.onload = () => setCsvText(String(rd.result ?? '')); rd.readAsText(f) }
  const exportCsv = () => downloadCsv('items.csv', shown.map(i => ({ name: i.name, kind: i.kind, sku: i.sku ?? '', category: i.category ?? '', unit: i.unit, price: i.price, gst: i.taxPercent, stock: i.kind === 'goods' ? i.stock ?? 0 : '', active: i.active ? 'yes' : 'no' })))

  const StockCell = ({ it }: { it: Item }) => it.kind !== 'goods' ? <span className="text-muted">—</span> : (
    <div className="flex items-center gap-1.5">
      <button onClick={() => bump(it, -1)} disabled={(it.stock ?? 0) <= 0} className="grid size-6 cursor-pointer place-items-center rounded border border-border text-muted hover:bg-surface-2 disabled:opacity-40" aria-label={`Reduce stock of ${it.name}`}><Minus size={12} /></button>
      <button onClick={() => setAdjust({ item: it, qty: '', dir: 'add' })} className="min-w-9 cursor-pointer rounded px-1 text-center font-medium hover:bg-surface-2" title="Adjust stock by a quantity">{it.stock ?? 0}</button>
      <button onClick={() => bump(it, 1)} className="grid size-6 cursor-pointer place-items-center rounded border border-border text-muted hover:bg-surface-2" aria-label={`Add stock of ${it.name}`}><Plus size={12} /></button>
      {(it.stock ?? 0) < LOW_STOCK && <Badge tone="bad">Low stock</Badge>}
    </div>
  )
  const KindBadge = ({ it }: { it: Item }) => <Badge tone={it.kind === 'goods' ? 'info' : 'brand'}>{it.kind === 'goods' ? <Package size={11} /> : <Wrench size={11} />}{it.kind === 'goods' ? 'Goods' : 'Service'}</Badge>
  const set = (p: Partial<Form>) => setForm(f => (f ? { ...f, ...p } : f))

  return (
    <div>
      <PageHeader title="Items" icon={Package} subtitle="Services and packing material you bill for" actions={<>
        <Button icon={Upload} onClick={() => setImportOpen(true)}>Import CSV</Button>
        <Button icon={Download} onClick={exportCsv} disabled={!shown.length}>Export CSV</Button>
        <Button variant="primary" icon={Plus} onClick={() => openForm('new')}>New item</Button>
      </>} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Tabs<Kind> value={kind} onChange={setKind} tabs={[{ id: 'all', label: 'All', count: counts.all }, { id: 'goods', label: 'Goods', count: counts.goods }, { id: 'service', label: 'Service', count: counts.service }]} />
        <div className="relative min-w-40 flex-1 sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input className="pl-8" placeholder="Search name, SKU or category" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Select className="w-auto" value={sort} onChange={e => setSort(e.target.value as SortKey)} aria-label="Sort items">
          <option value="name">Name A–Z</option><option value="price_desc">Price: high to low</option><option value="price_asc">Price: low to high</option><option value="stock_asc">Stock: lowest first</option><option value="category">Category</option>
        </Select>
        <Tabs<'list' | 'cards'> className="ml-auto" value={view} onChange={setView} tabs={[{ id: 'list', label: 'List', icon: List }, { id: 'cards', label: 'Cards', icon: LayoutGrid }]} />
      </div>

      {!shown.length ? (
        <Card><EmptyState icon={Package} title={items.length ? 'No items match' : 'No items yet'} text={items.length ? 'Try a different search or tab.' : 'Add the services and packing material you sell so quotations and invoices fill in faster.'} action={<Button variant="primary" icon={Plus} onClick={() => openForm('new')}>New item</Button>} /></Card>
      ) : view === 'list' ? (
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead><tr><th className={thCls}>Item</th><th className={thCls}>Type</th><th className={thCls}>Category</th><th className={thCls + ' text-right'}>Price</th><th className={thCls + ' text-right'}>GST</th><th className={thCls}>Stock</th><th className={thCls}>Active</th><th className={thCls} /></tr></thead>
            <tbody>
              {shown.map(it => (
                <tr key={it.id} className={trCls}>
                  <td className={tdCls}><button className="cursor-pointer text-left font-medium hover:text-brand" onClick={() => openForm(it)}>{it.name}</button><div className="text-xs text-muted">{it.sku || 'No SKU'}</div></td>
                  <td className={tdCls}><KindBadge it={it} /></td>
                  <td className={tdCls + ' whitespace-nowrap text-muted'}>{it.category || '—'}</td>
                  <td className={tdCls + ' whitespace-nowrap text-right font-medium'}>{inr(it.price)}<span className="text-xs font-normal text-muted"> / {it.unit}</span></td>
                  <td className={tdCls + ' text-right'}>{it.taxPercent}%</td>
                  <td className={tdCls}><StockCell it={it} /></td>
                  <td className={tdCls}><Toggle checked={it.active} onChange={v => useStore.getState().update('items', it.id, { active: v })} label={`${it.name} active`} /></td>
                  <td className={tdCls}><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" icon={Pencil} onClick={() => openForm(it)}>Edit</Button><Button size="sm" variant="ghost" icon={Trash2} onClick={() => setToDelete(it)} aria-label={`Delete ${it.name}`} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map(it => (
            <Card key={it.id} className={it.active ? 'p-4' : 'p-4 opacity-70'}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="truncate font-medium">{it.name}</div><div className="text-xs text-muted">{[it.sku, it.category].filter(Boolean).join(' · ') || 'No SKU'}</div></div>
                <KindBadge it={it} />
              </div>
              <div className="mt-3 text-xl font-semibold">{inr(it.price)}<span className="text-xs font-normal text-muted"> / {it.unit} · GST {it.taxPercent}%</span></div>
              <div className="mt-3 flex min-h-6 items-center justify-between gap-2 text-sm">{it.kind === 'goods' ? <StockCell it={it} /> : <span className="text-xs text-muted">Service · no stock</span>}{!it.active && <Badge>Inactive</Badge>}</div>
              <div className="mt-3 flex gap-1 border-t border-border pt-3"><Button size="sm" icon={Pencil} onClick={() => openForm(it)}>Edit</Button><Button size="sm" variant="ghost" icon={Trash2} onClick={() => setToDelete(it)}>Delete</Button></div>
            </Card>
          ))}
        </div>
      )}

      <Drawer open={!!form} onClose={closeForm} title={editing === 'new' ? 'New item' : 'Edit item'} footer={<><Button onClick={closeForm}>Cancel</Button><Button variant="primary" onClick={saveForm} disabled={!form?.name.trim()}>{editing === 'new' ? 'Add item' : 'Save changes'}</Button></>}>
        {form && (
          <div className="space-y-3">
            <Field label="Name *"><Input autoFocus value={form.name} onChange={e => set({ name: e.target.value })} placeholder="e.g. Home shifting - 2 BHK (local)" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type"><Select value={form.kind} onChange={e => set({ kind: e.target.value as Item['kind'] })}><option value="service">Service</option><option value="goods">Goods</option></Select></Field>
              <Field label="SKU / code"><Input value={form.sku} onChange={e => set({ sku: e.target.value })} placeholder="HS-2BHK" /></Field>
              <Field label="Category"><Input list="item-categories" value={form.category} onChange={e => set({ category: e.target.value })} placeholder="Home shifting" /><datalist id="item-categories">{categories.map(c => <option key={c} value={c} />)}</datalist></Field>
              <Field label="Unit"><Input value={form.unit} onChange={e => set({ unit: e.target.value })} placeholder="job, pc, roll, km" /></Field>
              <Field label="Price (₹, before GST)"><Input type="number" min={0} step="any" value={form.price} onChange={e => set({ price: e.target.value })} placeholder="0" /></Field>
              <Field label="GST %"><Input type="number" min={0} max={100} step="any" value={form.taxPercent} onChange={e => set({ taxPercent: e.target.value })} /></Field>
              {form.kind === 'goods' && <Field label="Stock in hand" hint={`A low-stock badge shows under ${LOW_STOCK}`}><Input type="number" min={0} step={1} value={form.stock} onChange={e => set({ stock: e.target.value })} /></Field>}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"><div><div className="text-sm font-medium">Active</div><div className="text-xs text-muted">Inactive items are hidden when you pick lines on a quotation or invoice.</div></div><Toggle checked={form.active} onChange={v => set({ active: v })} label="Active" /></div>
          </div>
        )}
      </Drawer>

      <Modal open={!!adjust} onClose={() => setAdjust(null)} title={`Adjust stock · ${adjust?.item.name ?? ''}`} footer={<><Button onClick={() => setAdjust(null)}>Cancel</Button><Button variant="primary" disabled={!(parseFloat(adjust?.qty ?? '') > 0)} onClick={() => { if (adjust) { const cur = useStore.getState().items.find(i => i.id === adjust.item.id); if (cur) bump(cur, (adjust.dir === 'add' ? 1 : -1) * Math.round(parseFloat(adjust.qty) || 0)) } setAdjust(null) }}>Update stock</Button></>}>
        {adjust && (
          <div className="space-y-3">
            <p className="text-sm text-muted">Stock in hand now: <span className="font-medium text-text">{adjust.item.stock ?? 0} {adjust.item.unit}</span></p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="What happened"><Select value={adjust.dir} onChange={e => setAdjust({ ...adjust, dir: e.target.value as 'add' | 'remove' })}><option value="add">Stock received (+)</option><option value="remove">Stock used or damaged (−)</option></Select></Field>
              <Field label="Quantity"><Input autoFocus type="number" min={1} step={1} value={adjust.qty} onChange={e => setAdjust({ ...adjust, qty: e.target.value })} /></Field>
            </div>
            <p className="text-xs text-muted">New stock: {Math.max(0, (adjust.item.stock ?? 0) + (adjust.dir === 'add' ? 1 : -1) * Math.round(parseFloat(adjust.qty) || 0))}</p>
          </div>
        )}
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import items from CSV" wide footer={<><Button onClick={() => setImportOpen(false)}>Cancel</Button><Button variant="primary" disabled={!goodRows.length} onClick={runImport}>Import {goodRows.length || ''} item{goodRows.length === 1 ? '' : 's'}</Button></>}>
        <div className="space-y-3">
          <p className="text-sm text-muted">Columns: <span className="font-medium text-text">name, kind (goods/service), sku, category, unit, price, gst, stock</span>. Only <em>name</em> is required. A row whose SKU or name already exists updates that item.</p>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { readFile(e.target.files?.[0]); e.target.value = '' }} />
            <Button size="sm" icon={Upload} onClick={() => fileRef.current?.click()}>Choose CSV file</Button>
            <Button size="sm" variant="ghost" onClick={() => setCsvText(SAMPLE)}>Fill with a sample</Button>
            {csvText && <Button size="sm" variant="ghost" onClick={() => setCsvText('')}>Clear</Button>}
          </div>
          <Textarea className="min-h-28 font-mono text-xs" value={csvText} onChange={e => setCsvText(e.target.value)} placeholder={'Or paste CSV here\n' + SAMPLE} />
          {importRows.length > 0 && (
            <div className={tableWrap + ' max-h-64 overflow-y-auto'}>
              <table className={tableCls}>
                <thead><tr><th className={thCls}>Name</th><th className={thCls}>Type</th><th className={thCls}>SKU</th><th className={thCls + ' text-right'}>Price</th><th className={thCls + ' text-right'}>GST</th><th className={thCls + ' text-right'}>Stock</th><th className={thCls}>Result</th></tr></thead>
                <tbody>{importRows.map((r, i) => (
                  <tr key={i}><td className={tdCls}>{r.data.name || '—'}</td><td className={tdCls}>{r.data.kind}</td><td className={tdCls}>{r.data.sku ?? '—'}</td><td className={tdCls + ' text-right'}>{inr(r.data.price)}</td><td className={tdCls + ' text-right'}>{r.data.taxPercent}%</td><td className={tdCls + ' text-right'}>{r.data.stock ?? '—'}</td>
                    <td className={tdCls}>{r.problem ? <Badge tone="bad">Skipped: {r.problem}</Badge> : r.existingId ? <Badge tone="warn">Updates existing</Badge> : <Badge tone="good">New</Badge>}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {csvText.trim() && !importRows.length && <p className="text-xs text-rose-600">No rows found. The first line must be the column names.</p>}
        </div>
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Delete item?" footer={<><Button onClick={() => setToDelete(null)}>Keep item</Button><Button variant="danger" onClick={() => { if (toDelete) useStore.getState().remove('items', toDelete.id); setToDelete(null) }}>Delete</Button></>}>
        <p className="text-sm">Delete <span className="font-medium">{toDelete?.name}</span> from the catalogue? Quotations and invoices that already use it keep their lines.</p>
      </Modal>
    </div>
  )
}
