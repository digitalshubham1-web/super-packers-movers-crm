import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, CheckSquare, Download, Plus, Search, Settings2, Sparkles, Trash2, User as UserIcon } from 'lucide-react'
import { endOfDay, endOfWeek, formatDistanceToNowStrict, startOfDay, startOfWeek } from 'date-fns'
import { useStore } from '@/lib/store'
import type { Task } from '@/lib/types'
import { cn, downloadCsv, fmtDateTime, friendlyDay } from '@/lib/utils'
import { Avatar, Badge, Button, EmptyState, Input, Modal, PageHeader, Select, Tabs, tableCls, tableWrap, tdCls, thCls, trCls } from '@/components/ui'
import TaskForm from '@/components/TaskForm'
import { cap, isLate, priorities, priorityTone, taskView, toggleTaskDone, viewLabel, viewTone } from '@/components/work/shared'

type Scope = 'me' | 'team'
type StatusTab = 'pending' | 'late' | 'done' | 'cancelled' | 'all'

export default function Tasks() {
  const tasks = useStore(s => s.tasks)
  const leads = useStore(s => s.leads)
  const users = useStore(s => s.users)
  const taskTypes = useStore(s => s.settings.taskTypes)
  const me = useStore(s => s.currentUserId)

  const [scope, setScope] = useState<Scope>('me')
  const [tab, setTab] = useState<StatusTab>('pending')
  const [due, setDue] = useState('any')
  const [priority, setPriority] = useState('')
  const [type, setType] = useState('')
  const [q, setQ] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Task | undefined>()
  const [typesOpen, setTypesOpen] = useState(false)
  const [newType, setNewType] = useState('')

  const leadById = useMemo(() => new Map(leads.map(l => [l.id, l])), [leads])
  const userById = useMemo(() => new Map(users.map(u => [u.id, u])), [users])
  const allTypes = useMemo(() => Array.from(new Set([...taskTypes, ...tasks.map(t => t.type)])), [taskTypes, tasks])

  const { rows, counts, scopeCounts } = useMemo(() => {
    const now = Date.now()
    const s = q.trim().toLowerCase()
    const today0 = startOfDay(now).getTime(), today1 = endOfDay(now).getTime()
    const wk0 = startOfWeek(now, { weekStartsOn: 1 }).getTime(), wk1 = endOfWeek(now, { weekStartsOn: 1 }).getTime()
    const scopeCounts = { me: tasks.filter(t => t.assigneeId === me && t.status === 'pending').length, team: tasks.filter(t => t.status === 'pending').length }
    const base = tasks.filter(t => {
      if (scope === 'me' && t.assigneeId !== me) return false
      if (priority && t.priority !== priority) return false
      if (type && t.type !== type) return false
      const d = new Date(t.dueAt).getTime()
      if (due === 'today' && (d < today0 || d > today1)) return false
      if (due === 'week' && (d < wk0 || d > wk1)) return false
      if (due === 'overdue' && !isLate(t, now)) return false
      if (s) {
        const lead = t.leadId ? leadById.get(t.leadId) : undefined
        const hay = [t.title, t.description, t.type, lead?.name, lead?.phone, userById.get(t.assigneeId)?.name].join(' ').toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
    const counts = {
      pending: base.filter(t => t.status === 'pending').length,
      late: base.filter(t => isLate(t, now)).length,
      done: base.filter(t => t.status === 'done').length,
      cancelled: base.filter(t => t.status === 'cancelled').length,
      all: base.length,
    }
    const rows = base
      .filter(t => (tab === 'all' ? true : tab === 'late' ? isLate(t, now) : t.status === tab))
      .sort((a, b) => (tab === 'done' || tab === 'cancelled' ? b.dueAt.localeCompare(a.dueAt) : a.dueAt.localeCompare(b.dueAt)))
    return { rows, counts, scopeCounts }
  }, [tasks, scope, tab, due, priority, type, q, me, leadById, userById])

  const openNew = () => { setEditing(undefined); setFormOpen(true) }
  const openEdit = (t: Task) => { setEditing(t); setFormOpen(true) }

  const exportCsv = () =>
    downloadCsv('tasks.csv', rows.map(t => ({
      Title: t.title, Description: t.description ?? '', Type: t.type, Lead: t.leadId ? leadById.get(t.leadId)?.name ?? '' : '',
      'Assigned to': userById.get(t.assigneeId)?.name ?? '', Status: viewLabel[taskView(t)], Due: fmtDateTime(t.dueAt), Priority: cap(t.priority),
      'Created by': t.createdBy, 'Created at': fmtDateTime(t.createdAt), 'Completed at': t.completedAt ? fmtDateTime(t.completedAt) : '',
    })))

  const addType = () => {
    const v = newType.trim()
    if (!v || taskTypes.some(t => t.toLowerCase() === v.toLowerCase())) return
    useStore.getState().setSettings({ taskTypes: [...taskTypes, v] })
    setNewType('')
  }
  const removeType = (t: string) => useStore.getState().setSettings({ taskTypes: taskTypes.filter(x => x !== t) })
  const filtersOn = due !== 'any' || priority || type || q
  const clearFilters = () => { setDue('any'); setPriority(''); setType(''); setQ('') }

  return (
    <div>
      <PageHeader
        title="Tasks"
        icon={CheckSquare}
        subtitle="Follow-ups, calls, surveys and payment reminders for your team"
        actions={<>
          <Button icon={Settings2} onClick={() => setTypesOpen(true)}>Task types</Button>
          <Button icon={Download} onClick={exportCsv} disabled={!rows.length}>Download</Button>
          <Button variant="primary" icon={Plus} onClick={openNew}>New task</Button>
        </>}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Tabs<Scope> value={scope} onChange={setScope} tabs={[{ id: 'me', label: 'For Me', count: scopeCounts.me }, { id: 'team', label: 'Team', count: scopeCounts.team }]} />
        <Tabs<StatusTab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'pending', label: 'Pending', count: counts.pending }, { id: 'late', label: 'Late', count: counts.late },
            { id: 'done', label: 'Done', count: counts.done }, { id: 'cancelled', label: 'Cancelled', count: counts.cancelled }, { id: 'all', label: 'All', count: counts.all },
          ]}
        />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-[1fr_160px_150px_150px_auto]">
        <div className="relative col-span-2 md:col-span-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-muted" />
          <Input className="pl-8" placeholder="Search title, lead or assignee" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Select value={due} onChange={e => setDue(e.target.value)} aria-label="Due">
          <option value="any">Due: any time</option>
          <option value="today">Due today</option>
          <option value="week">Due this week</option>
          <option value="overdue">Overdue</option>
        </Select>
        <Select value={priority} onChange={e => setPriority(e.target.value)} aria-label="Priority">
          <option value="">All priorities</option>
          {priorities.map(p => <option key={p} value={p}>{cap(p)}</option>)}
        </Select>
        <Select value={type} onChange={e => setType(e.target.value)} aria-label="Type">
          <option value="">All types</option>
          {allTypes.map(t => <option key={t}>{t}</option>)}
        </Select>
        {filtersOn ? <Button variant="ghost" onClick={clearFilters}>Clear</Button> : <span className="hidden md:block" />}
      </div>

      <div className={tableWrap}>
        {rows.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title={tasks.length ? 'No tasks match these filters' : 'No tasks yet'}
            text={tasks.length ? 'Try another tab or clear the filters.' : 'Create a task to remember a follow-up, survey visit or payment collection.'}
            action={<Button variant="primary" icon={Plus} onClick={openNew}>New task</Button>}
          />
        ) : (
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={cn(thCls, 'w-10')}></th>
                <th className={thCls}>Task</th>
                <th className={thCls}>Lead</th>
                <th className={thCls}>Assigned to</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Due</th>
                <th className={thCls}>Priority</th>
                <th className={thCls}>Created by</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(t => {
                const lead = t.leadId ? leadById.get(t.leadId) : undefined
                const user = userById.get(t.assigneeId)
                const view = taskView(t)
                return (
                  <tr key={t.id} className={cn(trCls, 'cursor-pointer')} onClick={() => openEdit(t)}>
                    <td className={tdCls} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer accent-[var(--c-brand)]"
                        checked={t.status === 'done'}
                        disabled={t.status === 'cancelled'}
                        onChange={() => toggleTaskDone(t)}
                        aria-label={t.status === 'done' ? 'Mark as pending' : 'Mark as done'}
                      />
                    </td>
                    <td className={cn(tdCls, 'min-w-56 max-w-80')}>
                      <div className={cn('font-medium', t.status !== 'pending' && 'text-muted line-through')}>{t.title}</div>
                      <div className="truncate text-xs text-muted">{t.type}{t.description ? ' · ' + t.description : ''}</div>
                    </td>
                    <td className={cn(tdCls, 'whitespace-nowrap')}>
                      {lead ? <Link to={`/leads/${lead.id}`} onClick={e => e.stopPropagation()} className="text-brand hover:underline">{lead.name}</Link> : <span className="text-muted">—</span>}
                    </td>
                    <td className={cn(tdCls, 'whitespace-nowrap')}>
                      {user ? <span className="inline-flex items-center gap-2"><Avatar name={user.name} color={user.color} size={22} />{user.name}</span> : <span className="text-muted">Unassigned</span>}
                    </td>
                    <td className={tdCls}><Badge tone={viewTone[view]}>{viewLabel[view]}</Badge></td>
                    <td className={cn(tdCls, 'whitespace-nowrap')}>
                      <div>{friendlyDay(t.dueAt)}</div>
                      {view === 'late' && <div className="text-xs font-medium text-rose-600">overdue by {formatDistanceToNowStrict(new Date(t.dueAt))}</div>}
                    </td>
                    <td className={tdCls}><Badge tone={priorityTone[t.priority]}>{cap(t.priority)}</Badge></td>
                    <td className={tdCls}>
                      {t.createdBy === 'user' && <Badge><UserIcon size={12} />User</Badge>}
                      {t.createdBy === 'automation' && <Badge tone="info"><Bot size={12} />Automation</Badge>}
                      {t.createdBy === 'ai' && <Badge tone="brand"><Sparkles size={12} />AI</Badge>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">{rows.length} task{rows.length === 1 ? '' : 's'} shown</p>

      <TaskForm open={formOpen} onClose={() => setFormOpen(false)} task={editing} />

      <Modal open={typesOpen} onClose={() => setTypesOpen(false)} title="Manage task types" footer={<Button variant="primary" onClick={() => setTypesOpen(false)}>Done</Button>}>
        <p className="mb-3 text-sm text-muted">These appear in the "Type" list when someone creates a task. Removing a type does not change existing tasks.</p>
        <form className="mb-3 flex gap-2" onSubmit={e => { e.preventDefault(); addType() }}>
          <Input value={newType} onChange={e => setNewType(e.target.value)} placeholder="New type, e.g. Packing visit" />
          <Button type="submit" variant="primary" icon={Plus} disabled={!newType.trim()}>Add</Button>
        </form>
        {taskTypes.length === 0 && <p className="text-sm text-muted">No task types yet. Add one above.</p>}
        <ul className="divide-y divide-border rounded-lg border border-border">
          {taskTypes.map(t => (
            <li key={t} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{t} <span className="text-xs text-muted">· {tasks.filter(x => x.type === t).length} tasks</span></span>
              <button onClick={() => removeType(t)} className="cursor-pointer rounded p-1 text-muted hover:bg-surface-2 hover:text-rose-600" aria-label={`Remove ${t}`}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  )
}
