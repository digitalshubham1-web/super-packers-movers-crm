import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { isThisWeek, isToday } from 'date-fns'
import { AlertTriangle, ChevronLeft, ChevronRight, Columns3, Download, KanbanSquare, List, MessageCircle, Phone, Plus, Search, Shuffle, Tag, Trash2, Upload, UserRound, Users, X, Zap } from 'lucide-react'
import { useStore, useCurrentUser } from '@/lib/store'
import { Avatar, Button, EmptyState, Field, Input, Modal, PageHeader, Select, Tabs, Toggle, tableCls, tableWrap, tdCls, thCls, trCls } from '@/components/ui'
import { cn, downloadCsv, fmtDate, fmtDateTime, friendlyDay, inr, nowIso, toDateInput } from '@/lib/utils'
import LeadForm from '@/components/LeadForm'
import Board from '@/components/leads/Board'
import ImportModal from '@/components/leads/ImportModal'
import { LostReasonModal, phoneDigits, telLink, waLink } from '@/components/leads/shared'
import type { Lead } from '@/lib/types'

const PAGE_SIZE = 25
const COLUMNS = [
  { id: 'phone', label: 'Phone' }, { id: 'city', label: 'City' }, { id: 'route', label: 'Move route' },
  { id: 'stage', label: 'Stage' }, { id: 'source', label: 'Source' }, { id: 'owner', label: 'Owner' },
  { id: 'value', label: 'Value' }, { id: 'followup', label: 'Next follow-up' }, { id: 'created', label: 'Created' },
] as const
type ColId = (typeof COLUMNS)[number]['id']
type View = 'list' | 'board'
type Sort = 'newest' | 'oldest' | 'value' | 'followup'

const EMPTY_FILTERS = { q: '', stage: '', source: '', owner: '', mine: false, from: '', to: '', due: '' }

/** useState that is remembered in localStorage. */
function useRemembered<T>(key: string, initial: T, valid: (v: unknown) => boolean) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw !== null) { const v: unknown = JSON.parse(raw); if (valid(v)) return v as T }
    } catch { /* ignore unreadable saved value */ }
    return initial
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full or blocked */ } }, [key, value])
  return [value, setValue] as const
}

const inlineSelect = 'h-7 w-36 rounded-md px-2 pr-6 text-xs'

export default function Leads() {
  const leads = useStore(s => s.leads)
  const allStages = useStore(s => s.stages)
  const sources = useStore(s => s.sources)
  const users = useStore(s => s.users)
  const me = useCurrentUser()
  const stages = useMemo(() => [...allStages].sort((a, b) => a.order - b.order), [allStages])
  const activeUsers = useMemo(() => users.filter(u => u.active), [users])

  const [params, setParams] = useSearchParams()
  const [view, setView] = useRemembered<View>('spm-leads-view', 'list', v => v === 'list' || v === 'board')
  const [hidden, setHidden] = useRemembered<ColId[]>('spm-leads-hidden-cols', [], v => Array.isArray(v))
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState<Sort>('newest')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [colsOpen, setColsOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [lost, setLost] = useState<{ ids: string[]; stageId: string } | null>(null)
  const [bulkTag, setBulkTag] = useState('')

  // ?new=1 and ?import=1 open the matching dialog; closing it removes the flag from the URL.
  const showForm = formOpen || params.get('new') === '1'
  const showImport = importOpen || params.get('import') === '1'
  const dropParam = (k: string) => { if (params.has(k)) { const p = new URLSearchParams(params); p.delete(k); setParams(p, { replace: true }) } }

  const setFilter = (patch: Partial<typeof EMPTY_FILTERS>) => { setFilters(f => ({ ...f, ...patch })); setPage(1) }
  const filtersOn = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase().replace(/^#/, '')
    const qDigits = q.replace(/\D/g, '')
    const now = Date.now()
    const out = leads.filter(l => {
      if (q) {
        const hit = l.name.toLowerCase().includes(q) || (l.city ?? '').toLowerCase().includes(q) || String(l.no).includes(q)
          || l.phone.toLowerCase().includes(q) || (qDigits.length >= 3 && l.phone.replace(/\D/g, '').includes(qDigits))
        if (!hit) return false
      }
      if (filters.stage && l.stageId !== filters.stage) return false
      if (filters.source && l.sourceId !== filters.source) return false
      if (filters.owner === 'none' ? Boolean(l.ownerId) : filters.owner && l.ownerId !== filters.owner) return false
      if (filters.mine && l.ownerId !== me?.id) return false
      const created = toDateInput(l.createdAt)
      if (filters.from && created < filters.from) return false
      if (filters.to && created > filters.to) return false
      if (filters.due) {
        if (!l.nextFollowUpAt) return false
        const d = new Date(l.nextFollowUpAt)
        if (filters.due === 'overdue' && d.getTime() >= now) return false
        if (filters.due === 'today' && !isToday(d)) return false
        if (filters.due === 'week' && !isThisWeek(d, { weekStartsOn: 1 })) return false
      }
      return true
    })
    const t = (iso?: string) => (iso ? new Date(iso).getTime() : 0)
    out.sort((a, b) => {
      if (sort === 'oldest') return t(a.createdAt) - t(b.createdAt)
      if (sort === 'value') return (b.value || 0) - (a.value || 0)
      if (sort === 'followup') return (a.nextFollowUpAt ? t(a.nextFollowUpAt) : Infinity) - (b.nextFollowUpAt ? t(b.nextFollowUpAt) : Infinity)
      return t(b.createdAt) - t(a.createdAt) || b.no - a.no
    })
    return out
  }, [leads, filters, sort, me?.id])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const curPage = Math.min(page, pages)
  const pageRows = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE)
  const selectedIds = useMemo(() => leads.filter(l => selected.has(l.id)).map(l => l.id), [leads, selected])
  const pageAllSelected = pageRows.length > 0 && pageRows.every(l => selected.has(l.id))
  const show = (c: ColId) => !hidden.includes(c)
  const now = Date.now()

  const toggleRow = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const togglePage = () => setSelected(s => { const n = new Set(s); pageRows.forEach(l => (pageAllSelected ? n.delete(l.id) : n.add(l.id))); return n })

  const changeStage = (ids: string[], stageId: string) => {
    const st = stages.find(s => s.id === stageId)
    const targets = ids.filter(id => leads.find(l => l.id === id)?.stageId !== stageId)
    if (!st || !targets.length) return
    if (st.isLost) { setLost({ ids: targets, stageId }); return }
    const { setLeadStage } = useStore.getState()
    targets.forEach(id => setLeadStage(id, stageId))
  }
  const changeOwner = (ids: string[], ownerId: string) => {
    const { setLeadOwner } = useStore.getState()
    ids.forEach(id => { if ((leads.find(l => l.id === id)?.ownerId ?? '') !== ownerId) setLeadOwner(id, ownerId || undefined) })
  }
  const changeSource = (lead: Lead, sourceId: string) => {
    const { update, log } = useStore.getState()
    update('leads', lead.id, { sourceId, updatedAt: nowIso() })
    log('system', `Source changed to ${sources.find(s => s.id === sourceId)?.label ?? sourceId}`, lead.id)
  }
  const addBulkTag = () => {
    const tag = bulkTag.trim()
    if (!tag) return
    const { update, log } = useStore.getState()
    selectedIds.forEach(id => {
      const l = leads.find(x => x.id === id)
      if (l && !l.tags.includes(tag)) { update('leads', id, { tags: [...l.tags, tag], updatedAt: nowIso() }); log('system', `Tag "${tag}" added`, id) }
    })
    setBulkTag('')
  }
  const deleteSelected = () => {
    const { remove } = useStore.getState()
    selectedIds.forEach(id => remove('leads', id))
    setSelected(new Set()); setConfirmDelete(false)
  }
  const exportRows = () => downloadCsv(`leads-${toDateInput(nowIso())}.csv`, filtered.map(l => ({
    'Lead no': l.no, Name: l.name, Phone: l.phone, Email: l.email ?? '', City: l.city ?? '',
    Stage: stages.find(s => s.id === l.stageId)?.label ?? '', Source: sources.find(s => s.id === l.sourceId)?.label ?? '',
    Owner: users.find(u => u.id === l.ownerId)?.name ?? '', 'Expected value': l.value || 0, Rating: l.rating,
    'Move from': l.moveFrom ?? '', 'Move to': l.moveTo ?? '', 'Move date': l.moveDate ?? '', 'Home size': l.homeSize ?? '',
    'Next follow-up': l.nextFollowUpAt ? fmtDateTime(l.nextFollowUpAt) : '', Tags: l.tags.join('; '), Created: fmtDateTime(l.createdAt),
  })))

  const colCount = 3 + COLUMNS.filter(c => show(c.id)).length

  return (
    <>
      <PageHeader
        title="Leads"
        icon={Users}
        subtitle={filtersOn ? `${filtered.length} of ${leads.length} leads match your filters` : `${leads.length} lead${leads.length === 1 ? '' : 's'}`}
        actions={<>
          <Tabs<View> value={view} onChange={setView} tabs={[{ id: 'list', label: 'List', icon: List }, { id: 'board', label: 'Board', icon: KanbanSquare }]} />
          <Button icon={Shuffle} onClick={() => setAssignOpen(true)}>Auto-assign</Button>
          <Button icon={Upload} onClick={() => setImportOpen(true)}>Import</Button>
          <Button icon={Download} onClick={exportRows} disabled={!filtered.length} title="Download the leads shown below as a CSV file">Export</Button>
          <Button icon={Zap} onClick={() => setQuickOpen(true)}>Quick add</Button>
          <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>New lead</Button>
        </>}
      />

      {/* Toolbar */}
      <div className="mb-3 rounded-xl border border-border bg-surface p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <div className="relative col-span-2">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input value={filters.q} onChange={e => setFilter({ q: e.target.value })} placeholder="Search name, phone, lead no. or city" className="pl-9" aria-label="Search leads" />
          </div>
          <Select value={filters.stage} onChange={e => setFilter({ stage: e.target.value })} aria-label="Filter by stage">
            <option value="">All stages</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
          <Select value={filters.source} onChange={e => setFilter({ source: e.target.value })} aria-label="Filter by source">
            <option value="">All sources</option>
            {sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
          <Select value={filters.owner} onChange={e => setFilter({ owner: e.target.value })} aria-label="Filter by owner">
            <option value="">All owners</option>
            <option value="none">No owner</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <Select value={filters.due} onChange={e => setFilter({ due: e.target.value })} aria-label="Filter by follow-up">
            <option value="">Any follow-up</option>
            <option value="overdue">Follow-up overdue</option>
            <option value="today">Follow-up today</option>
            <option value="week">Follow-up this week</option>
          </Select>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted">Created from
            <Input type="date" value={filters.from} max={filters.to || undefined} onChange={e => setFilter({ from: e.target.value })} className="h-8 w-36" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted">to
            <Input type="date" value={filters.to} min={filters.from || undefined} onChange={e => setFilter({ to: e.target.value })} className="h-8 w-36" />
          </label>
          <Button size="sm" icon={UserRound} onClick={() => setFilter({ mine: !filters.mine })} aria-pressed={filters.mine} className={cn(filters.mine && 'border-brand bg-brand-soft text-brand hover:bg-brand-soft')}>My leads</Button>
          {filtersOn && <Button size="sm" variant="ghost" icon={X} onClick={() => { setFilters(EMPTY_FILTERS); setPage(1) }}>Clear filters</Button>}
          <div className="ml-auto flex items-center gap-2">
            <Select value={sort} onChange={e => { setSort(e.target.value as Sort); setPage(1) }} className="h-8 w-44 text-xs" aria-label="Sort leads">
              <option value="newest">Sort: newest first</option>
              <option value="oldest">Sort: oldest first</option>
              <option value="value">Sort: highest value</option>
              <option value="followup">Sort: follow-up soonest</option>
            </Select>
            {view === 'list' && (
              <div className="relative">
                <Button size="sm" icon={Columns3} onClick={() => setColsOpen(o => !o)}>Columns</Button>
                {colsOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setColsOpen(false)} />
                    <div className="absolute right-0 z-40 mt-1 w-48 rounded-lg border border-border bg-surface p-2 shadow-xl">
                      <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Show columns</p>
                      {COLUMNS.map(c => (
                        <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-2">
                          <input type="checkbox" className="accent-[var(--c-brand)]" checked={show(c.id)} onChange={() => setHidden(h => (h.includes(c.id) ? h.filter(x => x !== c.id) : [...h, c.id]))} />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {view === 'list' && selectedIds.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand bg-brand-soft px-3 py-2">
          <span className="text-sm font-medium text-brand">{selectedIds.length} selected</span>
          <Select value="" onChange={e => e.target.value && changeStage(selectedIds, e.target.value)} className="h-8 w-40 text-xs" aria-label="Change stage of selected leads">
            <option value="">Change stage…</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
          <Select value="" onChange={e => e.target.value && changeOwner(selectedIds, e.target.value === 'none' ? '' : e.target.value)} className="h-8 w-40 text-xs" aria-label="Change owner of selected leads">
            <option value="">Change owner…</option>
            <option value="none">No owner</option>
            {activeUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <form onSubmit={e => { e.preventDefault(); addBulkTag() }} className="flex items-center gap-1">
            <Input value={bulkTag} onChange={e => setBulkTag(e.target.value)} placeholder="Tag name" className="h-8 w-28 text-xs" aria-label="Tag to add" />
            <Button size="sm" icon={Tag} type="submit" disabled={!bulkTag.trim()}>Add tag</Button>
          </form>
          <Button size="sm" variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)}>Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="ml-auto">Clear selection</Button>
        </div>
      )}

      {leads.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState icon={Users} title="No leads yet" text="Add your first enquiry by hand, or import a list from a CSV file." action={<Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>New lead</Button>} />
        </div>
      ) : view === 'board' ? (
        <Board leads={filtered} stages={stages} users={users} onMove={(id, stageId) => changeStage([id], stageId)} />
      ) : (
        <>
          <div className={tableWrap}>
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={cn(thCls, 'w-8')}><input type="checkbox" className="accent-[var(--c-brand)]" checked={pageAllSelected} onChange={togglePage} aria-label="Select all leads on this page" /></th>
                  <th className={thCls}>#</th>
                  <th className={thCls}>Name</th>
                  {COLUMNS.filter(c => show(c.id)).map(c => <th key={c.id} className={thCls}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && (
                  <tr><td colSpan={colCount}>
                    <EmptyState icon={Search} title="No leads match these filters" text="Try a different search or clear the filters." action={<Button onClick={() => { setFilters(EMPTY_FILTERS); setPage(1) }}>Clear filters</Button>} />
                  </td></tr>
                )}
                {pageRows.map(l => {
                  const stage = stages.find(s => s.id === l.stageId)
                  const owner = users.find(u => u.id === l.ownerId)
                  const overdue = l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() < now
                  return (
                    <tr key={l.id} className={cn(trCls, selected.has(l.id) && 'bg-brand-soft/50')}>
                      <td className={tdCls}><input type="checkbox" className="accent-[var(--c-brand)]" checked={selected.has(l.id)} onChange={() => toggleRow(l.id)} aria-label={`Select ${l.name}`} /></td>
                      <td className={cn(tdCls, 'whitespace-nowrap text-xs text-muted')}>#{l.no}</td>
                      <td className={cn(tdCls, 'whitespace-nowrap')}>
                        <div className="flex items-center gap-2">
                          <Link to={`/leads/${l.id}`} className="font-medium hover:text-brand hover:underline">{l.name}</Link>
                          <a href={telLink(l.phone)} title={`Call ${l.phone}`} aria-label={`Call ${l.name}`} className="rounded p-1 text-muted hover:bg-sky-500/15 hover:text-sky-600"><Phone size={14} /></a>
                          <a href={waLink(l.phone)} target="_blank" rel="noreferrer" title="Open WhatsApp chat" aria-label={`WhatsApp ${l.name}`} className="rounded p-1 text-muted hover:bg-emerald-500/15 hover:text-emerald-600"><MessageCircle size={14} /></a>
                        </div>
                      </td>
                      {show('phone') && <td className={cn(tdCls, 'whitespace-nowrap')}>{l.phone}</td>}
                      {show('city') && <td className={cn(tdCls, 'whitespace-nowrap')}>{l.city || <span className="text-muted">—</span>}</td>}
                      {show('route') && <td className={cn(tdCls, 'whitespace-nowrap text-xs')}>{l.moveFrom || l.moveTo ? `${l.moveFrom || '?'} → ${l.moveTo || '?'}` : <span className="text-muted">—</span>}</td>}
                      {show('stage') && (
                        <td className={tdCls}>
                          <div className="flex items-center gap-1.5">
                            <span className="size-2 shrink-0 rounded-full" style={{ background: stage?.color ?? 'var(--c-muted)' }} />
                            <Select value={l.stageId} onChange={e => changeStage([l.id], e.target.value)} className={inlineSelect} aria-label={`Stage of ${l.name}`}>
                              {!stage && <option value={l.stageId}>Unknown</option>}
                              {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </Select>
                          </div>
                        </td>
                      )}
                      {show('source') && (
                        <td className={tdCls}>
                          <Select value={l.sourceId} onChange={e => changeSource(l, e.target.value)} className={inlineSelect} aria-label={`Source of ${l.name}`}>
                            {!sources.some(s => s.id === l.sourceId) && <option value={l.sourceId}>Unknown</option>}
                            {sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                          </Select>
                        </td>
                      )}
                      {show('owner') && (
                        <td className={tdCls}>
                          <div className="flex items-center gap-1.5">
                            {owner && <Avatar name={owner.name} color={owner.color} size={20} />}
                            <Select value={l.ownerId ?? ''} onChange={e => changeOwner([l.id], e.target.value)} className={inlineSelect} aria-label={`Owner of ${l.name}`}>
                              <option value="">No owner</option>
                              {users.filter(u => u.active || u.id === l.ownerId).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </Select>
                          </div>
                        </td>
                      )}
                      {show('value') && <td className={cn(tdCls, 'whitespace-nowrap font-medium')}>{l.value ? inr(l.value) : <span className="font-normal text-muted">—</span>}</td>}
                      {show('followup') && (
                        <td className={cn(tdCls, 'whitespace-nowrap text-xs', overdue && 'font-medium text-rose-600')}>
                          {l.nextFollowUpAt ? <>{friendlyDay(l.nextFollowUpAt)}{overdue && ' · overdue'}</> : <span className="text-muted">—</span>}
                        </td>
                      )}
                      {show('created') && <td className={cn(tdCls, 'whitespace-nowrap text-xs text-muted')}>{fmtDate(l.createdAt)}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>Showing {(curPage - 1) * PAGE_SIZE + 1}–{Math.min(curPage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
              <div className="flex items-center gap-2">
                <Button size="sm" icon={ChevronLeft} disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>Previous</Button>
                <span>Page {curPage} of {pages}</span>
                <Button size="sm" disabled={curPage >= pages} onClick={() => setPage(curPage + 1)}>Next<ChevronRight size={14} /></Button>
              </div>
            </div>
          )}
        </>
      )}

      <LeadForm open={showForm} onClose={() => { setFormOpen(false); dropParam('new') }} />
      <ImportModal open={showImport} onClose={() => { setImportOpen(false); dropParam('import') }} />
      {quickOpen && <QuickAdd onClose={() => setQuickOpen(false)} />}
      <AutoAssignModal open={assignOpen} onClose={() => setAssignOpen(false)} />
      <LostReasonModal open={!!lost} onClose={() => setLost(null)} leadIds={lost?.ids ?? []} stageId={lost?.stageId ?? ''} />
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${selectedIds.length} lead${selectedIds.length === 1 ? '' : 's'}?`}
        footer={<><Button onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="danger" icon={Trash2} onClick={deleteSelected}>Delete</Button></>}
      >
        <p className="text-sm text-muted">The selected leads will be removed from the list and the board. This cannot be undone.</p>
      </Modal>
    </>
  )
}

function QuickAdd({ onClose }: { onClose: () => void }) {
  const leads = useStore(s => s.leads)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const digits = phoneDigits(phone)
  const dup = digits.length === 10 ? leads.find(l => phoneDigits(l.phone) === digits) : undefined
  const save = () => {
    if (!name.trim()) return setError('Enter the customer name.')
    if (phone.replace(/\D/g, '').length < 10) return setError('Enter a phone number with at least 10 digits.')
    useStore.getState().createLead({ name: name.trim(), phone: phone.trim() })
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="Quick add lead" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Add lead</Button></>}>
      <form onSubmit={e => { e.preventDefault(); save() }} className="space-y-3">
        <Field label="Name *"><Input autoFocus value={name} onChange={e => { setName(e.target.value); setError('') }} placeholder="Customer name" /></Field>
        <Field label="Phone *"><Input type="tel" value={phone} onChange={e => { setPhone(e.target.value); setError('') }} placeholder="10-digit mobile number" /></Field>
        {dup && <p className="flex items-start gap-1 text-xs text-amber-600"><AlertTriangle size={13} className="mt-0.5 shrink-0" />Lead #{dup.no} ({dup.name}) already has this phone number. You can still add it.</p>}
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <p className="text-xs text-muted">The lead starts in the first stage. The owner is set by auto-assign when it is on.</p>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

function AutoAssignModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useStore(s => s.settings)
  const users = useStore(s => s.users)
  const automations = useStore(s => s.automations)
  const ruleOn = automations.some(a => a.active && a.trigger === 'new_lead' && a.action === 'assign')
  const pool = settings.autoAssignUserIds
  const { setSettings } = useStore.getState()
  const toggleUser = (id: string) => setSettings({ autoAssignUserIds: pool.includes(id) ? pool.filter(x => x !== id) : [...pool, id] })
  const activePool = pool.filter(id => users.some(u => u.id === id && u.active))
  return (
    <Modal open={open} onClose={onClose} title="Auto-assign new leads" footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Share new leads in turn (round-robin)</p>
          <p className="mt-0.5 text-xs text-muted">Each new lead without an owner goes to the next person in the pool below.</p>
        </div>
        <Toggle checked={settings.autoAssign} onChange={v => setSettings({ autoAssign: v })} label="Auto-assign new leads" />
      </div>
      {settings.autoAssign && !ruleOn && (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Leads are not being assigned yet: the "assign new leads" automation is switched off. <Link to="/automations" className="font-medium underline">Turn it on in Automations</Link>.
        </p>
      )}
      {settings.autoAssign && ruleOn && activePool.length === 0 && (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">Pick at least one person, otherwise new leads stay without an owner.</p>
      )}
      <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted">People in the pool ({activePool.length})</p>
      <div className={cn('divide-y divide-border rounded-lg border border-border', !settings.autoAssign && 'opacity-60')}>
        {users.map(u => (
          <label key={u.id} className={cn('flex items-center gap-3 px-3 py-2', u.active ? 'cursor-pointer hover:bg-surface-2' : 'opacity-60')}>
            <input type="checkbox" className="accent-[var(--c-brand)]" checked={pool.includes(u.id)} disabled={!u.active} onChange={() => toggleUser(u.id)} />
            <Avatar name={u.name} color={u.color} size={26} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{u.name}</span>
              <span className="block text-xs capitalize text-muted">{u.role}{!u.active && ' · inactive'}</span>
            </span>
          </label>
        ))}
      </div>
    </Modal>
  )
}
