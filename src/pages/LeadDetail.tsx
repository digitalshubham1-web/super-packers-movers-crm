import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRightLeft, Building2, CalendarClock, CheckSquare, FileText, Gauge, History, ListChecks, Mail, MapPin, MessageCircle, Pencil, Phone,
  PhoneCall, Plus, Receipt, Settings2, StickyNote, Trash2, Truck, UserRound, UserX, X, type LucideIcon,
} from 'lucide-react'
import { useStore, useLead } from '@/lib/store'
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Tabs, Textarea, tableCls, tdCls, thCls, trCls } from '@/components/ui'
import { cn, docTotals, fmtDate, fmtDateTime, friendlyDay, inr, invoicePaid, nowIso, timeAgo } from '@/lib/utils'
import LeadForm from '@/components/LeadForm'
import TaskForm from '@/components/TaskForm'
import { LostReasonModal, Stars, engagementScore, telLink, waLink } from '@/components/leads/shared'
import type { ActivityType, Call, Lead, Task } from '@/lib/types'

type TabId = 'activity' | 'details' | 'billing' | 'tasks' | 'notes'

const ACT: Record<ActivityType, { icon: LucideIcon; label: string; cls: string }> = {
  note: { icon: StickyNote, label: 'Notes', cls: 'bg-amber-500/15 text-amber-600' },
  call: { icon: PhoneCall, label: 'Calls', cls: 'bg-sky-500/15 text-sky-600' },
  whatsapp: { icon: MessageCircle, label: 'WhatsApp', cls: 'bg-emerald-500/15 text-emerald-600' },
  email: { icon: Mail, label: 'Email', cls: 'bg-sky-500/15 text-sky-600' },
  stage: { icon: ArrowRightLeft, label: 'Stage changes', cls: 'bg-brand-soft text-brand' },
  owner: { icon: UserRound, label: 'Owner changes', cls: 'bg-surface-2 text-muted' },
  task: { icon: CheckSquare, label: 'Tasks', cls: 'bg-emerald-500/15 text-emerald-600' },
  system: { icon: Settings2, label: 'System', cls: 'bg-surface-2 text-muted' },
  invoice: { icon: Receipt, label: 'Invoices', cls: 'bg-rose-500/15 text-rose-600' },
  quotation: { icon: FileText, label: 'Quotations', cls: 'bg-amber-500/15 text-amber-600' },
}

const OUTCOMES: { id: Call['outcome']; label: string }[] = [
  { id: 'connected', label: 'Connected — spoke to the customer' },
  { id: 'no_answer', label: 'No answer' },
  { id: 'busy', label: 'Busy' },
  { id: 'missed', label: 'Missed (customer called, not picked up)' },
]

export default function LeadDetail() {
  const { id } = useParams()
  const lead = useLead(id)
  if (!lead) {
    return (
      <>
        <PageHeader title="Lead not found" icon={UserX} />
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState icon={UserX} title="This lead does not exist" text="It may have been deleted, or the link is wrong." action={<Link to="/leads" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"><ArrowLeft size={14} /> Back to all leads</Link>} />
        </div>
      </>
    )
  }
  return <LeadView key={lead.id} lead={lead} />
}

function LeadView({ lead }: { lead: Lead }) {
  const navigate = useNavigate()
  const allStages = useStore(s => s.stages)
  const sources = useStore(s => s.sources)
  const users = useStore(s => s.users)
  const lostReasons = useStore(s => s.lostReasons)
  const customFields = useStore(s => s.customFields)
  const allActivities = useStore(s => s.activities)
  const allTasks = useStore(s => s.tasks)
  const allQuotes = useStore(s => s.quotations)
  const allInvoices = useStore(s => s.invoices)
  const payments = useStore(s => s.payments)

  const stages = useMemo(() => [...allStages].sort((a, b) => a.order - b.order), [allStages])
  const activities = useMemo(() => allActivities.filter(a => a.leadId === lead.id).sort((a, b) => b.at.localeCompare(a.at)), [allActivities, lead.id])
  const tasks = useMemo(() => allTasks.filter(t => t.leadId === lead.id).sort((a, b) => a.dueAt.localeCompare(b.dueAt)), [allTasks, lead.id])
  const quotes = useMemo(() => allQuotes.filter(q => q.leadId === lead.id), [allQuotes, lead.id])
  const invoices = useMemo(() => allInvoices.filter(i => i.leadId === lead.id), [allInvoices, lead.id])
  const notes = useMemo(() => activities.filter(a => a.type === 'note'), [activities])
  const score = useMemo(() => engagementScore(lead, allStages, allActivities, quotes.length + invoices.length > 0), [lead, allStages, allActivities, quotes.length, invoices.length])

  const [tab, setTab] = useState<TabId>('activity')
  const [actFilter, setActFilter] = useState<ActivityType | ''>('')
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [callOpen, setCallOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [taskForm, setTaskForm] = useState<{ task?: Task } | null>(null)
  const [lostStage, setLostStage] = useState('')
  const [tagText, setTagText] = useState('')
  const [noteText, setNoteText] = useState('')

  const stage = stages.find(s => s.id === lead.stageId)
  const source = sources.find(s => s.id === lead.sourceId)
  const owner = users.find(u => u.id === lead.ownerId)
  const overdue = lead.nextFollowUpAt && new Date(lead.nextFollowUpAt).getTime() < Date.now()
  const pendingTasks = tasks.filter(t => t.status === 'pending').length
  const patch = (p: Partial<Lead>) => useStore.getState().update('leads', lead.id, { ...p, updatedAt: nowIso() })

  const changeStage = (stageId: string) => {
    if (stageId === lead.stageId) return
    if (stages.find(s => s.id === stageId)?.isLost) setLostStage(stageId)
    else useStore.getState().setLeadStage(lead.id, stageId)
  }
  const addTag = () => {
    const t = tagText.trim()
    if (t && !lead.tags.includes(t)) patch({ tags: [...lead.tags, t] })
    setTagText('')
  }
  const saveNote = (text: string) => {
    const t = text.trim()
    if (!t) return false
    useStore.getState().log('note', t, lead.id)
    return true
  }
  const toggleTask = (t: Task) => {
    const { update, log } = useStore.getState()
    if (t.status === 'done') update('tasks', t.id, { status: 'pending', completedAt: undefined })
    else { update('tasks', t.id, { status: 'done', completedAt: nowIso() }); log('task', `Task completed: ${t.title}`, lead.id) }
  }
  const doDelete = () => {
    useStore.getState().remove('leads', lead.id)
    navigate('/leads')
  }

  const shownActivities = actFilter ? activities.filter(a => a.type === actFilter) : activities
  const typesPresent = (Object.keys(ACT) as ActivityType[]).filter(t => activities.some(a => a.type === t))
  const scoreTone = score.total >= 70 ? 'text-emerald-600' : score.total >= 40 ? 'text-amber-600' : 'text-rose-600'
  const scoreBar = score.total >= 70 ? 'bg-emerald-500' : score.total >= 40 ? 'bg-amber-500' : 'bg-rose-500'

  const customValue = (v: string | number | boolean | undefined, type: string): ReactNode => {
    if (v === undefined || v === '') return '—'
    if (typeof v === 'boolean') return v ? 'Yes' : 'No'
    if (type === 'currency') return inr(Number(v))
    if (type === 'date') return fmtDate(String(v))
    if (type === 'rating') return <Stars value={Number(v)} size={14} />
    if (type === 'url') return <a href={String(v)} target="_blank" rel="noreferrer" className="text-brand hover:underline">{String(v)}</a>
    return String(v)
  }

  return (
    <>
      <PageHeader
        title={lead.name}
        icon={UserRound}
        subtitle={<>Lead #{lead.no} · created {timeAgo(lead.createdAt)}{source && <> · from {source.label}</>}</>}
        actions={<>
          <Button icon={Pencil} onClick={() => setEditOpen(true)}>Edit</Button>
          <Button variant="ghost" icon={Trash2} onClick={() => setDeleteOpen(true)} className="hover:text-rose-600">Delete</Button>
        </>}
      />

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Left column */}
        <div className="space-y-4">
          <Card className="p-4">
            <Link to="/leads" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-brand"><ArrowLeft size={13} /> All leads</Link>
            <div className="mt-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold leading-tight">{lead.name}</h2>
                <p className="text-xs text-muted">#{lead.no}{lead.company && <> · {lead.company}</>}</p>
              </div>
              {stage && <Badge color={stage.color}>{stage.label}</Badge>}
            </div>
            <div className="mt-2"><Stars value={lead.rating} onChange={v => patch({ rating: v })} size={18} /></div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Stage">
                <Select value={lead.stageId} onChange={e => changeStage(e.target.value)}>
                  {!stage && <option value={lead.stageId}>Unknown</option>}
                  {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              </Field>
              <Field label="Owner">
                <Select value={lead.ownerId ?? ''} onChange={e => useStore.getState().setLeadOwner(lead.id, e.target.value || undefined)}>
                  <option value="">No owner</option>
                  {users.filter(u => u.active || u.id === lead.ownerId).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
              </Field>
            </div>
            {stage?.isLost && <p className="mt-2 text-xs text-rose-600">Lost reason: {lostReasons.find(r => r.id === lead.lostReasonId)?.label ?? 'not recorded'}</p>}

            <dl className="mt-4 space-y-2 text-sm">
              <InfoRow icon={Phone}><a href={telLink(lead.phone)} className="hover:text-brand hover:underline">{lead.phone}</a>{lead.altPhone && <span className="text-muted"> · alt {lead.altPhone}</span>}</InfoRow>
              <InfoRow icon={Mail}>{lead.email ? <a href={`mailto:${lead.email}`} className="break-all hover:text-brand hover:underline">{lead.email}</a> : <span className="text-muted">No email</span>}</InfoRow>
              <InfoRow icon={Building2}>{lead.city || <span className="text-muted">No city</span>}</InfoRow>
              <InfoRow icon={CalendarClock}>
                {lead.nextFollowUpAt
                  ? <span className={cn(overdue && 'font-medium text-rose-600')}>Follow-up {friendlyDay(lead.nextFollowUpAt)}{overdue && ' · overdue'}</span>
                  : <span className="text-muted">No follow-up planned</span>}
              </InfoRow>
              {owner && <InfoRow icon={UserRound}><span className="inline-flex items-center gap-1.5"><Avatar name={owner.name} color={owner.color} size={18} />{owner.name}</span></InfoRow>}
            </dl>

            <div className="mt-4">
              <p className="mb-1.5 text-xs font-medium text-muted">Tags</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {lead.tags.map(t => (
                  <Badge key={t} tone="brand">
                    {t}
                    <button type="button" onClick={() => patch({ tags: lead.tags.filter(x => x !== t) })} aria-label={`Remove tag ${t}`} className="cursor-pointer rounded-full hover:opacity-70"><X size={11} /></button>
                  </Badge>
                ))}
                <form onSubmit={e => { e.preventDefault(); addTag() }} className="flex items-center gap-1">
                  <Input value={tagText} onChange={e => setTagText(e.target.value)} placeholder="Add tag" aria-label="New tag" className="h-7 w-24 px-2 text-xs" />
                  <Button size="sm" type="submit" icon={Plus} disabled={!tagText.trim()} className="h-7 px-2" aria-label="Add tag" />
                </form>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="primary" icon={Phone} onClick={() => setCallOpen(true)}>Call</Button>
              <a
                href={waLink(lead.phone)} target="_blank" rel="noreferrer"
                onClick={() => useStore.getState().log('whatsapp', 'Opened a WhatsApp chat with the customer', lead.id)}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 px-3.5 text-sm font-medium text-emerald-600 hover:bg-emerald-500/25"
              ><MessageCircle size={16} /> WhatsApp</a>
              <Button icon={StickyNote} onClick={() => setNoteOpen(true)}>Add note</Button>
              <Button icon={ListChecks} onClick={() => setTaskForm({})}>Add task</Button>
            </div>
          </Card>

          <Card title={<span className="inline-flex items-center gap-1.5"><Gauge size={15} /> Engagement score</span>} action={<Badge>rule-based score</Badge>}>
            <div className="p-4">
              <div className="flex items-baseline gap-1">
                <span className={cn('text-3xl font-semibold', scoreTone)}>{score.total}</span>
                <span className="text-sm text-muted">/ 100</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"><div className={cn('h-full rounded-full', scoreBar)} style={{ width: `${score.total}%` }} /></div>
              <ul className="mt-3 space-y-2">
                {score.rules.map(r => (
                  <li key={r.label} className="flex items-start justify-between gap-3 text-xs">
                    <span className="min-w-0"><span className="block font-medium text-text">{r.label}</span><span className="block text-muted">{r.detail}</span></span>
                    <span className={cn('shrink-0 font-semibold', r.points ? 'text-emerald-600' : 'text-muted')}>+{r.points}<span className="font-normal text-muted"> / {r.max}</span></span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-muted">Worked out from the fixed rules above. It is not an AI prediction.</p>
            </div>
          </Card>

          <Card title={<span className="inline-flex items-center gap-1.5"><Truck size={15} /> Move details</span>} action={<Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditOpen(true)}>Edit</Button>}>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-3 p-4 text-sm">
              <Detail label="From"><span className="inline-flex items-center gap-1"><MapPin size={13} className="text-muted" />{lead.moveFrom || '—'}</span></Detail>
              <Detail label="To"><span className="inline-flex items-center gap-1"><MapPin size={13} className="text-muted" />{lead.moveTo || '—'}</span></Detail>
              <Detail label="Move date">{fmtDate(lead.moveDate)}</Detail>
              <Detail label="Home size">{lead.homeSize || '—'}</Detail>
              <Detail label="Expected value">{lead.value ? inr(lead.value) : '—'}</Detail>
            </dl>
          </Card>
        </div>

        {/* Right column */}
        <div className="min-w-0">
          <Tabs<TabId>
            value={tab} onChange={setTab} className="mb-3"
            tabs={[
              { id: 'activity', label: 'Activity', icon: History, count: activities.length },
              { id: 'details', label: 'Details', icon: FileText },
              { id: 'billing', label: 'Quotes & billing', icon: Receipt, count: quotes.length + invoices.length },
              { id: 'tasks', label: 'Tasks', icon: ListChecks, count: pendingTasks },
              { id: 'notes', label: 'Notes', icon: StickyNote, count: notes.length },
            ]}
          />

          {tab === 'activity' && (
            <Card
              title="Timeline"
              action={
                <Select value={actFilter} onChange={e => setActFilter(e.target.value as ActivityType | '')} className="h-8 w-44 text-xs" aria-label="Filter timeline by type">
                  <option value="">All activity</option>
                  {typesPresent.map(t => <option key={t} value={t}>{ACT[t].label}</option>)}
                </Select>
              }
            >
              {shownActivities.length === 0 ? (
                <EmptyState icon={History} title={actFilter ? 'Nothing of this type yet' : 'No activity yet'} text="Calls, notes, stage changes and messages for this lead show up here." action={<Button icon={StickyNote} onClick={() => setNoteOpen(true)}>Add note</Button>} />
              ) : (
                <ol className="p-4">
                  {shownActivities.map((a, i) => {
                    const meta = ACT[a.type] ?? ACT.system
                    const who = users.find(u => u.id === a.userId)
                    return (
                      <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                        {i < shownActivities.length - 1 && <span className="absolute bottom-0 left-[15px] top-8 w-px bg-border" />}
                        <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', meta.cls)}><meta.icon size={15} /></span>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="whitespace-pre-wrap break-words text-sm">{a.text}</p>
                          <p className="mt-0.5 text-xs text-muted" title={fmtDateTime(a.at)}>{who ? who.name : 'System'} · {timeAgo(a.at)} · {fmtDateTime(a.at)}</p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </Card>
          )}

          {tab === 'details' && (
            <Card title="All details" action={<Button size="sm" icon={Pencil} onClick={() => setEditOpen(true)}>Edit</Button>}>
              <dl className="grid gap-x-4 gap-y-4 p-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
                <Detail label="Lead number">#{lead.no}</Detail>
                <Detail label="Name">{lead.name}</Detail>
                <Detail label="Phone">{lead.phone}</Detail>
                <Detail label="Alternate phone">{lead.altPhone || '—'}</Detail>
                <Detail label="Email">{lead.email || '—'}</Detail>
                <Detail label="Company">{lead.company || '—'}</Detail>
                <Detail label="City">{lead.city || '—'}</Detail>
                <Detail label="State">{lead.state || '—'}</Detail>
                <Detail label="Address">{lead.address || '—'}</Detail>
                <Detail label="Stage">{stage ? <Badge color={stage.color}>{stage.label}</Badge> : '—'}</Detail>
                {stage?.isLost && <Detail label="Lost reason">{lostReasons.find(r => r.id === lead.lostReasonId)?.label ?? '—'}</Detail>}
                <Detail label="Source">{source ? <Badge color={source.color}>{source.label}</Badge> : '—'}</Detail>
                <Detail label="Owner">{owner?.name ?? 'No owner'}</Detail>
                <Detail label="Expected value">{inr(lead.value)}</Detail>
                <Detail label="Rating"><Stars value={lead.rating} size={14} /></Detail>
                <Detail label="Tags">{lead.tags.length ? lead.tags.join(', ') : '—'}</Detail>
                <Detail label="Move from">{lead.moveFrom || '—'}</Detail>
                <Detail label="Move to">{lead.moveTo || '—'}</Detail>
                <Detail label="Move date">{fmtDate(lead.moveDate)}</Detail>
                <Detail label="Home size">{lead.homeSize || '—'}</Detail>
                <Detail label="Next follow-up">{fmtDateTime(lead.nextFollowUpAt)}</Detail>
                <Detail label="Do not call">{lead.doNotCall ? 'Yes' : 'No'}</Detail>
                {customFields.filter(cf => cf.active || lead.custom[cf.id] !== undefined).map(cf => <Detail key={cf.id} label={cf.label}>{customValue(lead.custom[cf.id], cf.type)}</Detail>)}
                <Detail label="Created">{fmtDateTime(lead.createdAt)}</Detail>
                <Detail label="Last updated">{fmtDateTime(lead.updatedAt)}</Detail>
              </dl>
            </Card>
          )}

          {tab === 'billing' && (
            <div className="space-y-4">
              <Card title={`Quotations (${quotes.length})`} action={<Button size="sm" variant="primary" icon={Plus} onClick={() => navigate(`/billing/quotations?new=1&leadId=${lead.id}`)}>New quotation</Button>}>
                {quotes.length === 0 ? (
                  <EmptyState icon={FileText} title="No quotations for this lead" text="Send a price for the move before booking." action={<Button icon={Plus} onClick={() => navigate(`/billing/quotations?new=1&leadId=${lead.id}`)}>New quotation</Button>} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className={tableCls}>
                      <thead><tr><th className={thCls}>Number</th><th className={thCls}>Date</th><th className={thCls}>Valid until</th><th className={thCls}>Total</th><th className={thCls}>Status</th></tr></thead>
                      <tbody>
                        {quotes.map(q => (
                          <tr key={q.id} className={trCls}>
                            <td className={cn(tdCls, 'whitespace-nowrap')}><Link to="/billing/quotations" className="font-medium hover:text-brand hover:underline">{q.number}</Link></td>
                            <td className={cn(tdCls, 'whitespace-nowrap')}>{fmtDate(q.issueDate)}</td>
                            <td className={cn(tdCls, 'whitespace-nowrap')}>{fmtDate(q.validUntil)}</td>
                            <td className={cn(tdCls, 'whitespace-nowrap font-medium')}>{inr(docTotals(q).total)}</td>
                            <td className={tdCls}><Badge tone={q.status === 'accepted' ? 'good' : q.status === 'rejected' ? 'bad' : q.status === 'sent' ? 'info' : 'neutral'} className="capitalize">{q.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
              <Card title={`Invoices (${invoices.length})`} action={<Button size="sm" variant="primary" icon={Plus} onClick={() => navigate(`/billing/invoices/new?leadId=${lead.id}`)}>New invoice</Button>}>
                {invoices.length === 0 ? (
                  <EmptyState icon={Receipt} title="No invoices for this lead" text="Create a GST invoice once the booking is confirmed." action={<Button icon={Plus} onClick={() => navigate(`/billing/invoices/new?leadId=${lead.id}`)}>New invoice</Button>} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className={tableCls}>
                      <thead><tr><th className={thCls}>Number</th><th className={thCls}>Date</th><th className={thCls}>Total</th><th className={thCls}>Paid</th><th className={thCls}>Balance</th><th className={thCls}>Status</th></tr></thead>
                      <tbody>
                        {invoices.map(inv => {
                          const total = docTotals(inv).total, paid = invoicePaid(inv, payments)
                          return (
                            <tr key={inv.id} className={trCls}>
                              <td className={cn(tdCls, 'whitespace-nowrap')}><Link to={`/billing/invoices/${inv.id}`} className="font-medium hover:text-brand hover:underline">{inv.number}</Link></td>
                              <td className={cn(tdCls, 'whitespace-nowrap')}>{fmtDate(inv.issueDate)}</td>
                              <td className={cn(tdCls, 'whitespace-nowrap font-medium')}>{inr(total)}</td>
                              <td className={cn(tdCls, 'whitespace-nowrap')}>{inr(paid)}</td>
                              <td className={cn(tdCls, 'whitespace-nowrap', total - paid > 0 && inv.status !== 'cancelled' && 'text-rose-600')}>{inr(Math.max(0, total - paid))}</td>
                              <td className={tdCls}><Badge tone={inv.status === 'paid' ? 'good' : inv.status === 'partial' ? 'warn' : inv.status === 'cancelled' ? 'bad' : inv.status === 'issued' ? 'info' : 'neutral'} className="capitalize">{inv.status}</Badge></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {tab === 'tasks' && (
            <Card title={`Tasks (${tasks.length})`} action={<Button size="sm" variant="primary" icon={Plus} onClick={() => setTaskForm({})}>Add task</Button>}>
              {tasks.length === 0 ? (
                <EmptyState icon={ListChecks} title="No tasks for this lead" text="Add a follow-up, survey visit or payment reminder." action={<Button icon={Plus} onClick={() => setTaskForm({})}>Add task</Button>} />
              ) : (
                <ul className="divide-y divide-border">
                  {tasks.map(t => {
                    const late = t.status === 'pending' && new Date(t.dueAt).getTime() < Date.now()
                    const who = users.find(u => u.id === t.assigneeId)
                    return (
                      <li key={t.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2/50">
                        <input type="checkbox" className="mt-1 size-4 cursor-pointer accent-[var(--c-brand)]" checked={t.status === 'done'} disabled={t.status === 'cancelled'} onChange={() => toggleTask(t)} aria-label={`Mark "${t.title}" as done`} />
                        <button type="button" onClick={() => setTaskForm({ task: t })} className="min-w-0 flex-1 cursor-pointer text-left" title="Edit task">
                          <span className={cn('block text-sm font-medium', t.status !== 'pending' && 'text-muted line-through')}>{t.title}</span>
                          <span className={cn('mt-0.5 block text-xs', late ? 'text-rose-600' : 'text-muted')}>
                            {t.type} · due {friendlyDay(t.dueAt)}{late && ' · overdue'}{who && ` · ${who.name}`}
                          </span>
                        </button>
                        <Badge tone={t.priority === 'urgent' ? 'bad' : t.priority === 'high' ? 'warn' : t.priority === 'medium' ? 'info' : 'neutral'} className="capitalize">{t.priority}</Badge>
                        {t.status === 'cancelled' && <Badge>Cancelled</Badge>}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          )}

          {tab === 'notes' && (
            <Card title={`Notes (${notes.length})`}>
              <form onSubmit={e => { e.preventDefault(); if (saveNote(noteText)) setNoteText('') }} className="border-b border-border p-4">
                <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Write a note about this lead — what the customer said, items to move, special requests…" rows={3} aria-label="New note" />
                <div className="mt-2 flex justify-end"><Button variant="primary" type="submit" icon={Plus} disabled={!noteText.trim()}>Add note</Button></div>
              </form>
              {notes.length === 0 ? (
                <EmptyState icon={StickyNote} title="No notes yet" text="Notes you add above are saved here and on the timeline." />
              ) : (
                <ul className="divide-y divide-border">
                  {notes.map(n => (
                    <li key={n.id} className="px-4 py-3">
                      <p className="whitespace-pre-wrap break-words text-sm">{n.text}</p>
                      <p className="mt-1 text-xs text-muted">{users.find(u => u.id === n.userId)?.name ?? 'System'} · {fmtDateTime(n.at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>

      <LeadForm open={editOpen} onClose={() => setEditOpen(false)} lead={lead} />
      <TaskForm open={!!taskForm} onClose={() => setTaskForm(null)} task={taskForm?.task} leadId={lead.id} />
      <LostReasonModal open={!!lostStage} onClose={() => setLostStage('')} leadIds={[lead.id]} stageId={lostStage} />
      {callOpen && <CallModal lead={lead} onClose={() => setCallOpen(false)} />}
      {noteOpen && <NoteModal onClose={() => setNoteOpen(false)} onSave={saveNote} />}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this lead?"
        footer={<><Button onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" icon={Trash2} onClick={doDelete}>Delete lead</Button></>}
      >
        <p className="text-sm text-muted"><span className="font-medium text-text">{lead.name}</span> (#{lead.no}) will be removed from your leads. Quotations and invoices already made stay in Billing. This cannot be undone.</p>
      </Modal>
    </>
  )
}

function InfoRow({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <div className="flex items-start gap-2"><Icon size={14} className="mt-0.5 shrink-0 text-muted" /><dd className="min-w-0">{children}</dd></div>
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted">{label}</dt><dd className="mt-0.5 break-words font-medium">{children}</dd></div>
}

function NoteModal({ onClose, onSave }: { onClose: () => void; onSave: (text: string) => boolean }) {
  const [text, setText] = useState('')
  const save = () => { if (onSave(text)) onClose() }
  return (
    <Modal open onClose={onClose} title="Add note" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!text.trim()} onClick={save}>Save note</Button></>}>
      <Textarea autoFocus rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="What should the team know about this lead?" aria-label="Note" />
    </Modal>
  )
}

/** Record a phone call made from your own phone. The CRM does not place the call itself. */
function CallModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [outcome, setOutcome] = useState<Call['outcome']>('connected')
  const [minutes, setMinutes] = useState('2')
  const [notes, setNotes] = useState('')
  const save = () => {
    const st = useStore.getState()
    const label = { connected: 'Connected', no_answer: 'No answer', busy: 'Busy', missed: 'Missed call' }[outcome]
    const durationSec = outcome === 'connected' ? Math.max(0, Math.round((Number(minutes) || 0) * 60)) : 0
    st.add('calls', {
      leadId: lead.id, name: lead.name, phone: lead.phone, userId: st.currentUserId, direction: outcome === 'missed' ? 'incoming' : 'outgoing',
      outcome, durationSec, at: nowIso(), summary: notes.trim() || undefined,
    })
    st.log('call', `Call logged — ${label}${durationSec ? ` (${Math.round(durationSec / 60)} min)` : ''}${notes.trim() ? `. ${notes.trim()}` : ''}`, lead.id)
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="Log a call" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={PhoneCall} onClick={save}>Save call</Button></>}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/60 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{lead.name}</p>
            <p className="text-xs text-muted">{lead.phone}</p>
          </div>
          <a href={telLink(lead.phone)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg hover:opacity-90"><Phone size={14} /> Dial on this device</a>
        </div>
        {lead.doNotCall && <p className="text-xs text-rose-600">This customer asked not to be called.</p>}
        <p className="text-xs text-muted">Dialling uses your phone or calling app. After the call, record what happened here so it shows on the timeline and in Calling.</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <Field label="Outcome">
            <Select value={outcome} onChange={e => setOutcome(e.target.value as Call['outcome'])}>{OUTCOMES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</Select>
          </Field>
          <Field label="Minutes">
            <Input type="number" min={0} step={0.5} value={outcome === 'connected' ? minutes : '0'} disabled={outcome !== 'connected'} onChange={e => setMinutes(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes"><Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What was discussed? Next step?" /></Field>
      </div>
    </Modal>
  )
}
