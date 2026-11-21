import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlarmClock, CalendarClock, CheckSquare, LayoutDashboard, MessageCircle, Phone, Plus, Trophy, Upload, UserPlus, Wallet } from 'lucide-react'
import { endOfDay, format, startOfDay, subDays } from 'date-fns'
import { useCurrentUser, useStore } from '@/lib/store'
import { cn, friendlyDay, inr, timeAgo } from '@/lib/utils'
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, Select, StatCard, tableCls, tdCls, thCls, trCls } from '@/components/ui'
import TaskForm from '@/components/TaskForm'
import { isLate } from '@/components/work/shared'
import { activityMeta } from '@/components/work/activityMeta'

type Range = 'today' | 'yesterday' | '7d' | '30d' | 'all'
const RANGES: { id: Range; label: string }[] = [
  { id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' }, { id: '7d', label: 'Last 7 days' }, { id: '30d', label: 'Last 30 days' }, { id: 'all', label: 'All time' },
]
function bounds(r: Range): [number, number] {
  const now = new Date()
  if (r === 'today') return [startOfDay(now).getTime(), endOfDay(now).getTime()]
  if (r === 'yesterday') return [startOfDay(subDays(now, 1)).getTime(), endOfDay(subDays(now, 1)).getTime()]
  if (r === '7d') return [startOfDay(subDays(now, 6)).getTime(), endOfDay(now).getTime()]
  if (r === '30d') return [startOfDay(subDays(now, 29)).getTime(), endOfDay(now).getTime()]
  return [-Infinity, Infinity]
}

export default function Dashboard() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const leads = useStore(s => s.leads)
  const stages = useStore(s => s.stages)
  const sources = useStore(s => s.sources)
  const users = useStore(s => s.users)
  const tasks = useStore(s => s.tasks)
  const activities = useStore(s => s.activities)
  const [range, setRange] = useState<Range>('30d')
  const [taskOpen, setTaskOpen] = useState(false)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const rangeLabel = RANGES.find(r => r.id === range)!.label.toLowerCase()

  const d = useMemo(() => {
    const now = Date.now()
    const [from, to] = bounds(range)
    const inRange = (iso: string) => { const t = new Date(iso).getTime(); return t >= from && t <= to }
    const sortedStages = [...stages].sort((a, b) => a.order - b.order)
    const wonIds = new Set(stages.filter(s => s.isWon).map(s => s.id))
    const closedIds = new Set(stages.filter(s => s.isWon || s.isLost).map(s => s.id))
    const activeUsers = users.filter(u => u.active)

    const created = leads.filter(l => inRange(l.createdAt))
    const open = leads.filter(l => !closedIds.has(l.stageId))
    const won = leads.filter(l => wonIds.has(l.stageId) && inRange(l.updatedAt))
    const todayEnd = endOfDay(now).getTime()
    const followUps = open
      .filter(l => l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() <= todayEnd)
      .sort((a, b) => a.nextFollowUpAt!.localeCompare(b.nextFollowUpAt!))
    const overdue = followUps.filter(l => new Date(l.nextFollowUpAt!).getTime() < now)

    const taskRow = (list: typeof tasks) => ({ late: list.filter(t => isLate(t, now)).length, open: list.filter(t => t.status === 'pending' && !isLate(t, now)).length, done: list.filter(t => t.status === 'done').length })
    const teamTasks = { total: taskRow(tasks), rows: activeUsers.map(u => ({ user: u, ...taskRow(tasks.filter(t => t.assigneeId === u.id)) })) }

    const repRows = [
      ...activeUsers.map(u => ({ id: u.id, name: u.name, color: u.color as string | undefined, list: created.filter(l => l.ownerId === u.id) })),
      { id: 'none', name: 'Unassigned', color: undefined, list: created.filter(l => !l.ownerId || !activeUsers.some(u => u.id === l.ownerId)) },
    ]
      .filter(r => r.id !== 'none' || r.list.length)
      .map(r => ({ ...r, total: r.list.length, byStage: sortedStages.map(s => r.list.filter(l => l.stageId === s.id).length) }))

    const sourceRows = sources
      .map(s => {
        const list = created.filter(l => l.sourceId === s.id)
        const w = list.filter(l => wonIds.has(l.stageId)).length
        return { ...s, leads: list.length, won: w, rate: list.length ? Math.round((w / list.length) * 100) : 0 }
      })
      .sort((a, b) => b.leads - a.leads)
    const maxSource = Math.max(1, ...sourceRows.map(s => s.leads))

    const stageRows = sortedStages.map(s => {
      const list = created.filter(l => l.stageId === s.id)
      return { ...s, count: list.length, value: list.reduce((n, l) => n + (l.value || 0), 0) }
    })
    const maxStage = Math.max(1, ...stageRows.map(s => s.count))

    const recent = [...activities].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8)
    return {
      sortedStages, created, open, openValue: open.reduce((n, l) => n + (l.value || 0), 0), won, wonValue: won.reduce((n, l) => n + (l.value || 0), 0),
      followUps, overdue, teamTasks, repRows, sourceRows, maxSource, stageRows, maxStage, recent, now,
    }
  }, [leads, stages, sources, users, tasks, activities, range])

  const leadById = useMemo(() => new Map(leads.map(l => [l.id, l])), [leads])
  const userById = useMemo(() => new Map(users.map(u => [u.id, u])), [users])
  const num = (n: number, cls?: string) => <span className={cn('tabular-nums', n === 0 ? 'text-muted' : cls)}>{n}</span>

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${user?.name.split(' ')[0] ?? 'there'}`}
        subtitle={format(new Date(), 'EEEE, dd MMMM yyyy')}
        icon={LayoutDashboard}
        actions={
          <Select value={range} onChange={e => setRange(e.target.value as Range)} className="w-40" aria-label="Date range">
            {RANGES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </Select>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="primary" icon={UserPlus} onClick={() => navigate('/leads?new=1')}>New lead</Button>
        <Button icon={Plus} onClick={() => setTaskOpen(true)}>New task</Button>
        <Button icon={MessageCircle} onClick={() => navigate('/whatsapp')}>WhatsApp</Button>
        <Button icon={Upload} onClick={() => navigate('/leads?import=1')}>Import leads</Button>
        <Button icon={Phone} onClick={() => navigate('/calling')}>Call</Button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <StatCard label="New leads" value={d.created.length} hint={`Created ${range === 'all' ? 'in all time' : rangeLabel}`} icon={UserPlus} />
        <StatCard label="Open pipeline" value={d.open.length} hint={`${inr(d.openValue)} in leads not yet won or lost`} icon={Wallet} />
        <StatCard label="Won" value={d.won.length} hint={`${inr(d.wonValue)} · ${range === 'all' ? 'all time' : rangeLabel}`} icon={Trophy} tone="good" />
        <StatCard label="Follow-ups overdue" value={d.overdue.length} hint={d.overdue.length ? 'Open leads past their follow-up time' : 'Nothing is overdue'} icon={AlarmClock} tone={d.overdue.length ? 'bad' : 'default'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Team tasks" action={<Link to="/tasks" className="text-xs font-medium text-brand hover:underline">Open tasks</Link>}>
          <div className="grid grid-cols-3 gap-2 border-b border-border p-4 text-center">
            <div className="rounded-lg bg-rose-500/15 py-2"><div className="text-xl font-semibold text-rose-600">{d.teamTasks.total.late}</div><div className="text-xs text-rose-600">Late</div></div>
            <div className="rounded-lg bg-amber-500/15 py-2"><div className="text-xl font-semibold text-amber-600">{d.teamTasks.total.open}</div><div className="text-xs text-amber-600">Open</div></div>
            <div className="rounded-lg bg-emerald-500/15 py-2"><div className="text-xl font-semibold text-emerald-600">{d.teamTasks.total.done}</div><div className="text-xs text-emerald-600">Done</div></div>
          </div>
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead><tr><th className={thCls}>Team member</th><th className={cn(thCls, 'text-right')}>Late</th><th className={cn(thCls, 'text-right')}>Open</th><th className={cn(thCls, 'text-right')}>Done</th></tr></thead>
              <tbody>
                {d.teamTasks.rows.map(r => (
                  <tr key={r.user.id} className={trCls}>
                    <td className={tdCls}><span className="inline-flex items-center gap-2 whitespace-nowrap"><Avatar name={r.user.name} color={r.user.color} size={22} />{r.user.name}</span></td>
                    <td className={cn(tdCls, 'text-right')}>{num(r.late, 'font-semibold text-rose-600')}</td>
                    <td className={cn(tdCls, 'text-right')}>{num(r.open)}</td>
                    <td className={cn(tdCls, 'text-right')}>{num(r.done, 'text-emerald-600')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Today's follow-ups" action={<Badge tone={d.followUps.length ? 'warn' : 'neutral'}>{d.followUps.length}</Badge>}>
          {d.followUps.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No follow-ups due today" text="Set a next follow-up on a lead and it will appear here on the day." action={<Link to="/leads"><Button>Go to leads</Button></Link>} />
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {d.followUps.map(l => {
                const late = new Date(l.nextFollowUpAt!).getTime() < d.now
                const st = d.sortedStages.find(s => s.id === l.stageId)
                return (
                  <li key={l.id}>
                    <Link to={`/leads/${l.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2/50">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{l.name}</div>
                        <div className="truncate text-xs text-muted">{l.phone}{l.ownerId && userById.get(l.ownerId) ? ' · ' + userById.get(l.ownerId)!.name : ''}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={cn('text-xs', late ? 'font-medium text-rose-600' : 'text-muted')}>{late ? 'Overdue · ' : ''}{friendlyDay(l.nextFollowUpAt!)}</span>
                        {st && <Badge color={st.color}>{st.label}</Badge>}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card title="Leads by stage" action={<span className="text-xs text-muted">Created {rangeLabel}</span>}>
          {d.created.length === 0 ? (
            <EmptyState title="No leads in this period" text="Pick a longer date range or add a lead." action={<Button variant="primary" icon={UserPlus} onClick={() => navigate('/leads?new=1')}>New lead</Button>} />
          ) : (
            <ul className="space-y-3 p-4">
              {d.stageRows.map(s => (
                <li key={s.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: s.color }} />{s.label}</span>
                    <span className="whitespace-nowrap tabular-nums"><span className="font-semibold">{s.count}</span> <span className="text-xs text-muted">· {inr(s.value)}</span></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${(s.count / d.maxStage) * 100}%`, background: s.color }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Lead sources" action={<span className="text-xs text-muted">Created {rangeLabel}</span>}>
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead><tr><th className={thCls}>Source</th><th className={cn(thCls, 'w-2/5')}>Leads</th><th className={cn(thCls, 'text-right')}>Won</th><th className={cn(thCls, 'text-right')}>Win rate</th></tr></thead>
              <tbody>
                {d.sourceRows.map(s => (
                  <tr key={s.id} className={trCls}>
                    <td className={cn(tdCls, 'whitespace-nowrap')}><span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: s.color ?? 'var(--c-muted)' }} />{s.label}</span></td>
                    <td className={tdCls}>
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-right tabular-nums">{s.leads}</span>
                        <div className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${(s.leads / d.maxSource) * 100}%`, background: s.color ?? 'var(--c-brand)' }} /></div>
                      </div>
                    </td>
                    <td className={cn(tdCls, 'text-right')}>{num(s.won, 'text-emerald-600')}</td>
                    <td className={cn(tdCls, 'text-right tabular-nums')}>{s.leads ? s.rate + '%' : <span className="text-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="xl:col-span-2" title="Leads by stage per rep" action={<span className="text-xs text-muted">Created {rangeLabel}</span>}>
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={thCls}>Rep</th>
                  {d.sortedStages.map(s => <th key={s.id} className={cn(thCls, 'text-right')}><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: s.color }} />{s.label}</span></th>)}
                  <th className={cn(thCls, 'text-right')}>Total</th>
                </tr>
              </thead>
              <tbody>
                {d.repRows.map(r => (
                  <tr key={r.id} className={trCls}>
                    <td className={cn(tdCls, 'whitespace-nowrap')}><span className="inline-flex items-center gap-2"><Avatar name={r.name} color={r.color} size={22} />{r.name}</span></td>
                    {r.byStage.map((n, i) => <td key={i} className={cn(tdCls, 'text-right')}>{num(n)}</td>)}
                    <td className={cn(tdCls, 'text-right font-semibold tabular-nums')}>{r.total}</td>
                  </tr>
                ))}
                <tr className="bg-surface-2/40 font-semibold">
                  <td className={tdCls}>All</td>
                  {d.stageRows.map(s => <td key={s.id} className={cn(tdCls, 'text-right tabular-nums')}>{s.count}</td>)}
                  <td className={cn(tdCls, 'text-right tabular-nums')}>{d.created.length}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="xl:col-span-2" title="Recent activity" action={<Link to="/activities" className="text-xs font-medium text-brand hover:underline">View all</Link>}>
          {d.recent.length === 0 ? (
            <EmptyState icon={CheckSquare} title="No activity yet" text="Work on a lead and the timeline will fill up here." action={<Button variant="primary" icon={UserPlus} onClick={() => navigate('/leads?new=1')}>New lead</Button>} />
          ) : (
            <ul className="divide-y divide-border">
              {d.recent.map(a => {
                const m = activityMeta(a.type)
                const lead = a.leadId ? leadById.get(a.leadId) : undefined
                return (
                  <li key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                    <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg', m.cls)}><m.icon size={14} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm">{a.text}</p>
                      <p className="text-xs text-muted">
                        {lead && <><Link to={`/leads/${lead.id}`} className="text-brand hover:underline">{lead.name}</Link> · </>}
                        {(a.userId && userById.get(a.userId)?.name) || 'System'}
                      </p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-xs text-muted">{timeAgo(a.at)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <TaskForm open={taskOpen} onClose={() => setTaskOpen(false)} />
    </div>
  )
}
