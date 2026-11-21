import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { startOfDay, startOfMonth, startOfWeek, subDays } from 'date-fns'
import { CheckSquare, Clock, IndianRupee, Medal, Phone, Trophy, Users } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Call, Lead, Task, User } from '@/lib/types'
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, Tabs } from '@/components/ui'
import { cn, fmtDateTime, fmtTime, inr } from '@/lib/utils'
import { Mini, splitLeads, sum, talkTime } from '@/components/insights/shared'

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'all'
type RankBy = 'calls' | 'talk' | 'won' | 'tasks'

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' }, { id: 'week', label: 'This week' }, { id: 'month', label: 'This month' }, { id: 'all', label: 'All time' },
]
const RANKS: { id: RankBy; label: string; icon: typeof Phone }[] = [
  { id: 'calls', label: 'Calls', icon: Phone }, { id: 'talk', label: 'Talk time', icon: Clock }, { id: 'won', label: 'Won value', icon: IndianRupee }, { id: 'tasks', label: 'Tasks done', icon: CheckSquare },
]
const MEDAL = ['#d4a017', '#94a3b8', '#b45309']
const MEDAL_NAME = ['Gold', 'Silver', 'Bronze']

function range(p: Period): [number, number] {
  const now = new Date()
  const today = startOfDay(now).getTime()
  if (p === 'today') return [today, Infinity]
  if (p === 'yesterday') return [startOfDay(subDays(now, 1)).getTime(), today]
  if (p === 'week') return [startOfWeek(now, { weekStartsOn: 1 }).getTime(), Infinity]
  if (p === 'month') return [startOfMonth(now).getTime(), Infinity]
  return [-Infinity, Infinity]
}

function statsFor(u: User, calls: Call[], tasks: Task[], leads: Lead[], wonIds: Set<string>, lostIds: Set<string>, [a, b]: [number, number]) {
  const within = (iso?: string) => { if (!iso) return false; const t = new Date(iso).getTime(); return t >= a && t < b }
  const now = Date.now()
  const myCalls = calls.filter(c => c.userId === u.id && !c.byAi && within(c.at)).sort((x, y) => x.at.localeCompare(y.at))
  const connected = myCalls.filter(c => c.outcome === 'connected')
  const myTasks = tasks.filter(t => t.assigneeId === u.id)
  const pendingAll = myTasks.filter(t => t.status === 'pending' && within(t.dueAt))
  const late = pendingAll.filter(t => new Date(t.dueAt).getTime() < now)
  const done = myTasks.filter(t => t.status === 'done' && within(t.completedAt ?? t.dueAt))
  const mine = leads.filter(l => l.ownerId === u.id)
  const won = mine.filter(l => wonIds.has(l.stageId) && within(l.updatedAt))
  return {
    user: u,
    calls: myCalls.length, first: myCalls[0]?.at, last: myCalls[myCalls.length - 1]?.at,
    incoming: myCalls.filter(c => c.direction === 'incoming').length, outgoing: myCalls.filter(c => c.direction === 'outgoing').length,
    missed: myCalls.filter(c => c.outcome === 'missed').length, unanswered: myCalls.filter(c => c.outcome === 'no_answer' || c.outcome === 'busy').length,
    connected: connected.length, talk: sum(connected, c => c.durationSec),
    late: late.length, pending: pendingAll.length - late.length, done: done.length,
    assigned: mine.filter(l => within(l.createdAt)).length, won: won.length, lost: mine.filter(l => lostIds.has(l.stageId) && within(l.updatedAt)).length,
    wonValue: sum(won, l => l.value),
  }
}
type Stats = ReturnType<typeof statsFor>

const metricOf = (s: Stats, by: RankBy) => (by === 'calls' ? s.calls : by === 'talk' ? s.talk : by === 'won' ? s.wonValue : s.done)
const fmtMetric = (n: number, by: RankBy) => (by === 'talk' ? talkTime(n) : by === 'won' ? inr(n) : n.toLocaleString('en-IN'))

function Row({ label, value, tone }: { label: string; value: ReactNode; tone?: 'good' | 'bad' | 'warn' }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className={cn('font-medium tabular-nums', tone === 'good' && 'text-emerald-600', tone === 'bad' && 'text-rose-600', tone === 'warn' && 'text-amber-600')}>{value}</span>
    </div>
  )
}

export default function Leaderboard() {
  const users = useStore(s => s.users)
  const calls = useStore(s => s.calls)
  const tasks = useStore(s => s.tasks)
  const leads = useStore(s => s.leads)
  const stages = useStore(s => s.stages)
  const currentUserId = useStore(s => s.currentUserId)

  const [period, setPeriod] = useState<Period>('week')
  const [rankBy, setRankBy] = useState<RankBy>('calls')
  const [picked, setPicked] = useState<string | null>(null)

  const board = useMemo(() => {
    const { wonIds, lostIds } = splitLeads(leads, stages)
    const r = range(period)
    const rows = users.filter(u => u.active).map(u => statsFor(u, calls, tasks, leads, wonIds, lostIds, r))
    rows.sort((x, y) => metricOf(y, rankBy) - metricOf(x, rankBy) || x.user.name.localeCompare(y.user.name))
    // Equal numbers share a rank, so nobody gets a medal on a tie-break by name.
    let rank = 0
    const ranked = rows.map((s, i) => {
      if (i === 0 || metricOf(s, rankBy) !== metricOf(rows[i - 1], rankBy)) rank = i
      return { ...s, rank }
    })
    return {
      ranked, max: Math.max(0, ...rows.map(s => metricOf(s, rankBy))),
      totals: { calls: sum(rows, s => s.calls), talk: sum(rows, s => s.talk), won: sum(rows, s => s.wonValue), wonCount: sum(rows, s => s.won), tasks: sum(rows, s => s.done) },
    }
  }, [users, calls, tasks, leads, stages, period, rankBy])

  const sel = board.ranked.find(s => s.user.id === picked) ?? board.ranked.find(s => s.user.id === currentUserId) ?? board.ranked[0]
  const rankLabel = RANKS.find(x => x.id === rankBy)!.label
  const periodLabel = PERIODS.find(p => p.id === period)!.label.toLowerCase()

  return (
    <div>
      <PageHeader title="Leaderboard" subtitle="How each active team member is doing" icon={Trophy} actions={<Tabs<Period> value={period} onChange={setPeriod} tabs={PERIODS} />} />

      {!board.ranked.length ? (
        <Card><EmptyState icon={Users} title="No active team members" text="Activate or add a user to see the leaderboard." action={<Link to="/team"><Button variant="primary">Go to team</Button></Link>} /></Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <Card title="Ranking" action={<Tabs<RankBy> value={rankBy} onChange={setRankBy} tabs={RANKS} />}>
              <ul className="p-2">
                {board.ranked.map(s => {
                  const v = metricOf(s, rankBy)
                  const medal = v > 0 && s.rank < 3
                  const active = sel?.user.id === s.user.id
                  return (
                    <li key={s.user.id}>
                      <button onClick={() => setPicked(s.user.id)} aria-pressed={active} className={cn('flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 text-left', active ? 'bg-brand-soft' : 'hover:bg-surface-2')}>
                        <span className="grid w-7 shrink-0 place-items-center">
                          {medal ? <Medal size={20} style={{ color: MEDAL[s.rank] }} aria-label={`${MEDAL_NAME[s.rank]} medal`} /> : <span className="text-sm font-medium text-muted">{s.rank + 1}</span>}
                        </span>
                        <Avatar name={s.user.name} color={s.user.color} size={34} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="min-w-0 truncate text-sm font-medium">
                              {s.user.name}{s.user.id === currentUserId && <span className="ml-1 font-semibold text-brand">(you)</span>}
                            </span>
                            <span className="shrink-0 text-sm font-semibold tabular-nums">{fmtMetric(v, rankBy)}</span>
                          </span>
                          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                            <span className="block h-full rounded-full bg-brand" style={{ width: `${board.max > 0 ? (v / board.max) * 100 : 0}%` }} />
                          </span>
                          <span className="mt-1.5 block truncate text-xs text-muted">
                            {s.calls} {s.calls === 1 ? 'call' : 'calls'} · {talkTime(s.talk)} talk · {s.won} won ({inr(s.wonValue)}) · {s.done} {s.done === 1 ? 'task' : 'tasks'} done
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {board.max === 0 && <p className="border-t border-border px-4 py-3 text-xs text-muted">Nobody has any {rankLabel.toLowerCase()} for {periodLabel} yet, so no medals are shown.</p>}
            </Card>

            <Card title={`Team totals · ${PERIODS.find(p => p.id === period)!.label}`}>
              <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
                <Mini label="Calls" value={board.totals.calls} />
                <Mini label="Talk time" value={talkTime(board.totals.talk)} />
                <Mini label="Won value" value={inr(board.totals.won)} sub={`${board.totals.wonCount} won`} />
                <Mini label="Tasks done" value={board.totals.tasks} />
              </div>
            </Card>
          </div>

          {sel && (
            <Card className="lg:col-span-2">
              <div className="flex items-center gap-3 border-b border-border p-4">
                <Avatar name={sel.user.name} color={sel.user.color} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{sel.user.name}{sel.user.id === currentUserId && <span className="ml-1 text-brand">(you)</span>}</p>
                  <p className="text-xs text-muted">Rank {sel.rank + 1} of {board.ranked.length} by {rankLabel.toLowerCase()} · {periodLabel}</p>
                </div>
                <Badge tone={sel.user.available ? 'good' : 'warn'}>{sel.user.available ? 'Working' : 'Away'}</Badge>
              </div>
              <div className="divide-y divide-border">
                <section className="p-4">
                  <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><Phone size={13} />Calls</h4>
                  <Row label="First call" value={sel.first ? (period === 'today' || period === 'yesterday' ? fmtTime(sel.first) : fmtDateTime(sel.first)) : '—'} />
                  <Row label="Last call" value={sel.last ? (period === 'today' || period === 'yesterday' ? fmtTime(sel.last) : fmtDateTime(sel.last)) : '—'} />
                  <Row label="All calls" value={sel.calls} />
                  <Row label="Incoming" value={sel.incoming} />
                  <Row label="Outgoing" value={sel.outgoing} />
                  <Row label="Connected" value={sel.connected} tone="good" />
                  <Row label="Missed" value={sel.missed} tone={sel.missed ? 'bad' : undefined} />
                  <Row label="No answer or busy" value={sel.unanswered} />
                  <Row label="Total duration" value={talkTime(sel.talk)} />
                </section>
                <section className="p-4">
                  <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><CheckSquare size={13} />Tasks</h4>
                  <Row label="Late" value={sel.late} tone={sel.late ? 'bad' : undefined} />
                  <Row label="Pending" value={sel.pending} tone={sel.pending ? 'warn' : undefined} />
                  <Row label="Done" value={sel.done} tone="good" />
                </section>
                <section className="p-4">
                  <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><Users size={13} />Leads</h4>
                  <Row label="Assigned" value={sel.assigned} />
                  <Row label="Won" value={sel.won} tone="good" />
                  <Row label="Lost" value={sel.lost} tone={sel.lost ? 'bad' : undefined} />
                  <Row label="Won value" value={inr(sel.wonValue)} />
                </section>
              </div>
              <p className="border-t border-border px-4 py-3 text-xs text-muted">
                Calls count by call time (AI agent calls are left out). Late and pending tasks count by due date, done tasks by completion date (or due date when no completion time was saved). Assigned leads count by the date the lead was created; won and lost by the lead's last update.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
