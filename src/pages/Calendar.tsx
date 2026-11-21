import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, CheckSquare, ChevronLeft, ChevronRight, Clock, PhoneForwarded, Plus, Trash2 } from 'lucide-react'
import { addDays, addHours, addMonths, addWeeks, eachDayOfInterval, endOfDay, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, set as setTime, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import { useStore } from '@/lib/store'
import type { CalEvent, Task } from '@/lib/types'
import { cn, fmtTime, friendlyDay, toLocalInput } from '@/lib/utils'
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Tabs, Textarea } from '@/components/ui'
import TaskForm from '@/components/TaskForm'
import { LeadPicker, taskView } from '@/components/work/shared'

type View = 'month' | 'week' | 'day'
type Scope = 'mine' | 'all'
type Kind = 'pending' | 'late' | 'done' | 'cancelled' | 'event' | 'followup'
interface CalItem { key: string; kind: Kind; title: string; at: Date; end?: Date; task?: Task; event?: CalEvent; leadId?: string }
interface EventDraft { id?: string; title: string; start: string; end: string; leadId: string; notes: string }

const KIND: Record<Kind, { label: string; chip: string; dot: string }> = {
  pending: { label: 'Task pending', chip: 'bg-amber-500/15 text-amber-600', dot: 'bg-amber-500' },
  late: { label: 'Task late', chip: 'bg-rose-500/15 text-rose-600', dot: 'bg-rose-500' },
  done: { label: 'Task done', chip: 'bg-emerald-500/15 text-emerald-600', dot: 'bg-emerald-500' },
  cancelled: { label: 'Task cancelled', chip: 'bg-surface-2 text-muted line-through', dot: 'bg-border' },
  event: { label: 'Event', chip: 'bg-brand-soft text-brand', dot: 'bg-brand' },
  followup: { label: 'Lead follow-up', chip: 'bg-sky-500/15 text-sky-600', dot: 'bg-sky-500' },
}
const WEEK = { weekStartsOn: 1 } as const
const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')
const HOURS = Array.from({ length: 24 }, (_, i) => i)

export default function CalendarPage() {
  const navigate = useNavigate()
  const tasks = useStore(s => s.tasks)
  const events = useStore(s => s.events)
  const leads = useStore(s => s.leads)
  const stages = useStore(s => s.stages)
  const me = useStore(s => s.currentUserId)

  const [view, setView] = useState<View>('month')
  const [scope, setScope] = useState<Scope>('mine')
  const [cursor, setCursor] = useState(() => new Date())
  const [draft, setDraft] = useState<EventDraft | null>(null)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [task, setTask] = useState<Task | undefined>()
  const [taskOpen, setTaskOpen] = useState(false)

  const items = useMemo(() => {
    const now = Date.now()
    const closed = new Set(stages.filter(s => s.isWon || s.isLost).map(s => s.id))
    const out: CalItem[] = []
    for (const t of tasks) {
      if (scope === 'mine' && t.assigneeId !== me) continue
      out.push({ key: 't' + t.id, kind: taskView(t, now), title: t.title, at: new Date(t.dueAt), task: t, leadId: t.leadId })
    }
    for (const e of events) {
      if (scope === 'mine' && e.userId !== me) continue
      out.push({ key: 'e' + e.id, kind: 'event', title: e.title, at: new Date(e.start), end: new Date(e.end), event: e, leadId: e.leadId })
    }
    for (const l of leads) {
      if (!l.nextFollowUpAt || closed.has(l.stageId)) continue
      if (scope === 'mine' && l.ownerId !== me) continue
      out.push({ key: 'f' + l.id, kind: 'followup', title: 'Follow up: ' + l.name, at: new Date(l.nextFollowUpAt), leadId: l.id })
    }
    return out.filter(i => !isNaN(i.at.getTime())).sort((a, b) => a.at.getTime() - b.at.getTime())
  }, [tasks, events, leads, stages, scope, me])

  const byDay = useMemo(() => {
    const m = new Map<string, CalItem[]>()
    for (const i of items) { const k = dayKey(i.at); m.set(k, [...(m.get(k) ?? []), i]) }
    return m
  }, [items])

  const upcoming = useMemo(() => {
    const from = Date.now(), to = endOfDay(addDays(new Date(), 7)).getTime()
    return items.filter(i => i.at.getTime() >= from && i.at.getTime() <= to && i.kind !== 'done' && i.kind !== 'cancelled')
  }, [items])

  const days = useMemo(() => {
    if (view === 'month') return eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor), WEEK), end: endOfWeek(endOfMonth(cursor), WEEK) })
    if (view === 'week') return eachDayOfInterval({ start: startOfWeek(cursor, WEEK), end: endOfWeek(cursor, WEEK) })
    return [startOfDay(cursor)]
  }, [view, cursor])

  const heading = view === 'month' ? format(cursor, 'MMMM yyyy')
    : view === 'week' ? `${format(days[0], 'dd MMM')} – ${format(days[6], 'dd MMM yyyy')}`
    : format(cursor, 'EEEE, dd MMM yyyy')
  const step = (n: number) => setCursor(c => (view === 'month' ? addMonths(c, n) : view === 'week' ? addWeeks(c, n) : addDays(c, n)))

  const newEvent = (day?: Date, hour?: number) => {
    const base = day ?? (isToday(cursor) || view === 'month' ? new Date() : cursor)
    const start = hour !== undefined ? setTime(base, { hours: hour, minutes: 0, seconds: 0, milliseconds: 0 })
      : day || !isToday(base) ? setTime(base, { hours: 10, minutes: 0, seconds: 0, milliseconds: 0 })
      : setTime(addHours(new Date(), 1), { minutes: 0, seconds: 0, milliseconds: 0 })
    setError('')
    setDraft({ title: '', start: toLocalInput(start.toISOString()), end: toLocalInput(addHours(start, 1).toISOString()), leadId: '', notes: '' })
  }
  const openItem = (i: CalItem) => {
    if (i.task) { setTask(i.task); setTaskOpen(true) }
    else if (i.event) { setError(''); setDraft({ id: i.event.id, title: i.event.title, start: toLocalInput(i.event.start), end: toLocalInput(i.event.end), leadId: i.event.leadId ?? '', notes: i.event.notes ?? '' }) }
    else if (i.leadId) navigate(`/leads/${i.leadId}`)
  }
  const saveEvent = () => {
    if (!draft) return
    if (!draft.title.trim()) return setError('Please enter a title.')
    const s = new Date(draft.start), e = new Date(draft.end)
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return setError('Please choose a start and end time.')
    if (e.getTime() <= s.getTime()) return setError('The end time must be after the start time.')
    const { add, update, log } = useStore.getState()
    const data = { title: draft.title.trim(), start: s.toISOString(), end: e.toISOString(), leadId: draft.leadId || undefined, notes: draft.notes.trim() || undefined }
    if (draft.id) update('events', draft.id, data)
    else {
      add('events', { ...data, userId: me })
      if (data.leadId) log('system', `Event scheduled: ${data.title} (${friendlyDay(data.start)})`, data.leadId)
    }
    setDraft(null)
  }
  const deleteEvent = () => {
    if (draft?.id) useStore.getState().remove('events', draft.id)
    setConfirmDelete(false)
    setDraft(null)
  }
  const patch = (p: Partial<EventDraft>) => { setError(''); setDraft(d => (d ? { ...d, ...p } : d)) }

  const Chip = ({ i, showDay }: { i: CalItem; showDay?: boolean }) => (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); openItem(i) }}
      title={`${KIND[i.kind].label} · ${i.title} · ${friendlyDay(i.at.toISOString())}`}
      className={cn('block w-full cursor-pointer truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium hover:opacity-80', KIND[i.kind].chip)}
    >
      <span className="opacity-75">{showDay ? format(i.at, 'EEE d, ') : ''}{format(i.at, 'h:mm a')}</span> {i.title}
    </button>
  )
  const Row = ({ i }: { i: CalItem }) => (
    <button type="button" onClick={e => { e.stopPropagation(); openItem(i) }} className="flex w-full cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2">
      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', KIND[i.kind].dot)} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-sm', i.kind === 'cancelled' && 'text-muted line-through')}>{i.title}</span>
        <span className="block text-xs text-muted">{friendlyDay(i.at.toISOString())}{i.end ? ' – ' + fmtTime(i.end.toISOString()) : ''} · {KIND[i.kind].label}</span>
      </span>
    </button>
  )

  return (
    <div>
      <PageHeader
        title="Calendar"
        icon={CalendarDays}
        subtitle="Tasks, events and lead follow-ups in one place"
        actions={<>
          <Button icon={CheckSquare} onClick={() => { setTask(undefined); setTaskOpen(true) }}>New task</Button>
          <Button variant="primary" icon={Plus} onClick={() => newEvent()}>New event</Button>
        </>}
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button size="sm" icon={ChevronLeft} onClick={() => step(-1)} aria-label="Previous" />
            <Button size="sm" onClick={() => setCursor(new Date())}>Today</Button>
            <Button size="sm" icon={ChevronRight} onClick={() => step(1)} aria-label="Next" />
          </div>
          <h2 className="text-base font-semibold">{heading}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs<Scope> value={scope} onChange={setScope} tabs={[{ id: 'mine', label: 'My items' }, { id: 'all', label: 'Everyone' }]} />
          <Tabs<View> value={view} onChange={setView} tabs={[{ id: 'month', label: 'Month' }, { id: 'week', label: 'Week' }, { id: 'day', label: 'Day' }]} />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {(Object.keys(KIND) as Kind[]).map(k => <span key={k} className="inline-flex items-center gap-1.5"><span className={cn('size-2.5 rounded-full', KIND[k].dot)} />{KIND[k].label}</span>)}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          {view === 'month' && (
            <div className="min-w-[640px]">
              <div className="grid grid-cols-7 border-b border-border bg-surface-2/60 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
                {days.slice(0, 7).map(d => <div key={d.toISOString()} className="py-2">{format(d, 'EEE')}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {days.map(d => {
                  const list = byDay.get(dayKey(d)) ?? []
                  return (
                    <div
                      key={d.toISOString()}
                      onClick={() => newEvent(d)}
                      title="Click to add an event"
                      className={cn('min-h-28 cursor-pointer border-b border-r border-border p-1 hover:bg-surface-2/40 [&:nth-child(7n)]:border-r-0', !isSameMonth(d, cursor) && 'bg-surface-2/30')}
                    >
                      <div className="mb-1 flex justify-end">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setCursor(d); setView('day') }}
                          title="Open this day"
                          className={cn('grid size-6 cursor-pointer place-items-center rounded-full text-xs hover:bg-surface-2', isToday(d) ? 'bg-brand font-semibold text-brand-fg hover:bg-brand' : !isSameMonth(d, cursor) ? 'text-muted' : '')}
                        >
                          {format(d, 'd')}
                        </button>
                      </div>
                      <div className="space-y-0.5">
                        {list.slice(0, 3).map(i => <Chip key={i.key} i={i} />)}
                        {list.length > 3 && (
                          <button type="button" onClick={e => { e.stopPropagation(); setCursor(d); setView('day') }} className="cursor-pointer px-1.5 text-[11px] font-medium text-muted hover:text-text">+{list.length - 3} more</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {view === 'week' && (
            <div className="grid min-w-[840px] grid-cols-7">
              {days.map(d => {
                const list = byDay.get(dayKey(d)) ?? []
                return (
                  <div key={d.toISOString()} onClick={() => newEvent(d)} title="Click to add an event" className="min-h-96 cursor-pointer border-r border-border last:border-r-0 hover:bg-surface-2/40">
                    <button type="button" onClick={e => { e.stopPropagation(); setCursor(d); setView('day') }} className="block w-full cursor-pointer border-b border-border bg-surface-2/60 py-2 text-center">
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">{format(d, 'EEE')}</span>
                      <span className={cn('mx-auto mt-0.5 grid size-7 place-items-center rounded-full text-sm font-semibold', isToday(d) && 'bg-brand text-brand-fg')}>{format(d, 'd')}</span>
                    </button>
                    <div className="space-y-1 p-1.5">
                      {list.map(i => <Chip key={i.key} i={i} />)}
                      {list.length === 0 && <p className="py-3 text-center text-[11px] text-muted">Nothing planned</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {view === 'day' && (() => {
            const list = byDay.get(dayKey(cursor)) ?? []
            return (
              <div>
                {list.length === 0 && (
                  <div className="border-b border-border">
                    <EmptyState icon={CalendarDays} title="Nothing planned for this day" text="Click an hour below or add an event." action={<Button variant="primary" icon={Plus} onClick={() => newEvent(cursor)}>New event</Button>} />
                  </div>
                )}
                {HOURS.map(h => {
                  const inHour = list.filter(i => i.at.getHours() === h)
                  if (list.length === 0 && (h < 8 || h > 20)) return null
                  return (
                    <div key={h} onClick={() => newEvent(cursor, h)} title="Click to add an event at this time" className={cn('flex cursor-pointer gap-2 border-b border-border px-2 last:border-b-0 hover:bg-surface-2/40', inHour.length ? 'py-1.5' : 'py-2.5')}>
                      <span className="w-14 shrink-0 pt-1 text-right text-[11px] text-muted">{format(setTime(cursor, { hours: h, minutes: 0 }), 'h a')}</span>
                      <div className="min-w-0 flex-1">{inHour.map(i => <Row key={i.key} i={i} />)}</div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>

        <Card title="Next 7 days" action={<span className="text-xs text-muted">{upcoming.length}</span>} className="self-start">
          {upcoming.length === 0 ? (
            <EmptyState icon={Clock} title="Nothing coming up" text="No open tasks, events or follow-ups in the next 7 days." action={<Button size="sm" variant="primary" icon={Plus} onClick={() => newEvent()}>New event</Button>} />
          ) : (
            <div className="max-h-[36rem] overflow-y-auto p-2">
              {upcoming.map((i, n) => (
                <div key={i.key}>
                  {(n === 0 || !isSameDay(upcoming[n - 1].at, i.at)) && <p className="px-2 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{isToday(i.at) ? 'Today' : format(i.at, 'EEE, dd MMM')}</p>}
                  <Row i={i} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <TaskForm open={taskOpen} onClose={() => setTaskOpen(false)} task={task} />

      <Modal
        open={!!draft && !confirmDelete}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit event' : 'New event'}
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <div>{draft?.id && <Button variant="ghost" icon={Trash2} onClick={() => setConfirmDelete(true)}>Delete</Button>}</div>
            <div className="flex gap-2">
              <Button onClick={() => setDraft(null)}>Cancel</Button>
              <Button variant="primary" onClick={saveEvent}>{draft?.id ? 'Save changes' : 'Create event'}</Button>
            </div>
          </div>
        }
      >
        {draft && (
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); saveEvent() }}>
            <Field label="Title *"><Input autoFocus value={draft.title} onChange={e => patch({ title: e.target.value })} placeholder="e.g. Pre-move survey at customer's flat" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts *">
                <Input type="datetime-local" value={draft.start} onChange={e => {
                  const s = new Date(e.target.value), oldS = new Date(draft.start), oldE = new Date(draft.end)
                  const keep = !isNaN(s.getTime()) && !isNaN(oldS.getTime()) && !isNaN(oldE.getTime())
                  patch({ start: e.target.value, ...(keep ? { end: toLocalInput(new Date(s.getTime() + Math.max(oldE.getTime() - oldS.getTime(), 0)).toISOString()) } : {}) })
                }} />
              </Field>
              <Field label="Ends *"><Input type="datetime-local" value={draft.end} min={draft.start} onChange={e => patch({ end: e.target.value })} /></Field>
            </div>
            <div>
              <span className="mb-1 flex items-center gap-1 text-xs font-medium text-muted"><PhoneForwarded size={12} />Linked lead</span>
              <LeadPicker value={draft.leadId} onChange={id => patch({ leadId: id })} />
            </div>
            <Field label="Notes"><Textarea value={draft.notes} onChange={e => patch({ notes: e.target.value })} placeholder="Address, what to carry, who to meet" /></Field>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button type="submit" className="hidden" />
          </form>
        )}
      </Modal>
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this event?"
        footer={<><Button onClick={() => setConfirmDelete(false)}>Keep event</Button><Button variant="danger" onClick={deleteEvent}>Delete event</Button></>}
      >
        <p className="text-sm">"{draft?.title}" will be removed from the calendar. This cannot be undone.</p>
      </Modal>
    </div>
  )
}
