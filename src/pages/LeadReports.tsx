import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { startOfDay, startOfMonth, subDays } from 'date-fns'
import { ArrowDown, ArrowUp, ArrowUpDown, Download, FileBarChart, Table2 } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Lead } from '@/lib/types'
import { Avatar, Button, Card, EmptyState, Field, PageHeader, Select, StatCard, Tabs, tableCls, tdCls, thCls, trCls } from '@/components/ui'
import { cn, downloadCsv, fmtDate, inr } from '@/lib/utils'
import { BarList, Delta, Donut, TONE, pct, splitLeads, sum } from '@/components/insights/shared'

type Period = '7' | '30' | '90' | 'month' | 'all'
type Tab = 'report' | 'explore'
type Dim = 'stage' | 'source' | 'owner' | 'city' | 'homeSize'
type Metric = 'count' | 'value' | 'won'

const PERIODS: { id: Period; label: string }[] = [
  { id: '7', label: 'Last 7 days' }, { id: '30', label: 'Last 30 days' }, { id: '90', label: 'Last 90 days' },
  { id: 'month', label: 'This month' }, { id: 'all', label: 'All time' },
]
const DIMS: { id: Dim; label: string }[] = [
  { id: 'stage', label: 'Stage' }, { id: 'source', label: 'Source' }, { id: 'owner', label: 'Owner' }, { id: 'city', label: 'City' }, { id: 'homeSize', label: 'Home size' },
]
const METRICS: { id: Metric; label: string }[] = [
  { id: 'count', label: 'Number of leads' }, { id: 'value', label: 'Total value (₹)' }, { id: 'won', label: 'Won leads' },
]

/** Current window and the equally long window just before it. `null` start = all time. */
function windows(p: Period) {
  const end = Date.now()
  if (p === 'all') return { start: null as number | null, end, prevStart: 0, hasPrev: false }
  const start = p === 'month' ? startOfMonth(new Date()).getTime() : startOfDay(subDays(new Date(), Number(p) - 1)).getTime()
  return { start, end, prevStart: start - (end - start), hasPrev: true }
}
const DAY = 864e5

export default function LeadReports() {
  const leads = useStore(s => s.leads)
  const stages = useStore(s => s.stages)
  const sources = useStore(s => s.sources)
  const lostReasons = useStore(s => s.lostReasons)
  const users = useStore(s => s.users)
  const tasks = useStore(s => s.tasks)

  const [period, setPeriod] = useState<Period>('30')
  const [tab, setTab] = useState<Tab>('report')
  const [dim, setDim] = useState<Dim>('source')
  const [metric, setMetric] = useState<Metric>('count')
  const [sort, setSort] = useState<{ by: 'label' | 'value'; dir: 1 | -1 }>({ by: 'value', dir: -1 })

  const r = useMemo(() => {
    const w = windows(period)
    const inRange = (l: Lead, a: number | null, b: number) => { const t = new Date(l.createdAt).getTime(); return (a === null || t >= a) && t < b }
    const cur = leads.filter(l => inRange(l, w.start, w.end + 1))
    const prev = w.hasPrev && w.start !== null ? leads.filter(l => inRange(l, w.prevStart, w.start as number)) : []
    const now = Date.now()

    const kpi = (rows: Lead[]) => {
      const { won, lost, open } = splitLeads(rows, stages)
      const days = won.map(l => Math.max(0, (new Date(l.updatedAt).getTime() - new Date(l.createdAt).getTime()) / DAY))
      return {
        total: rows.length, won: won.length, lost: lost.length, open: open.length,
        conv: rows.length ? (won.length / rows.length) * 100 : 0,
        wonValue: sum(won, l => l.value),
        avgDays: days.length ? sum(days, d => d) / days.length : 0,
        overdue: open.filter(l => l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() < now).length,
      }
    }
    const { won, lost, wonIds, lostIds } = splitLeads(cur, stages)

    // Funnel: lost leads carry no record of the stage they dropped at, so they only count in the first step.
    const path = [...stages].filter(s => !s.isLost).sort((a, b) => a.order - b.order)
    const orderOf = new Map(stages.map(s => [s.id, s.order]))
    const alive = cur.filter(l => !lostIds.has(l.stageId))
    const funnel = path.map((st, i) => ({
      stage: st,
      count: i === 0 ? cur.length : alive.filter(l => (orderOf.get(l.stageId) ?? -1) >= st.order).length,
    }))

    const known = new Set(sources.map(s => s.id))
    const bySource = sources.map(s => {
      const rows = cur.filter(l => l.sourceId === s.id)
      return { id: s.id, name: s.label, color: s.color ?? 'var(--c-muted)', value: rows.length, won: rows.filter(l => wonIds.has(l.stageId)).length, wonValue: sum(rows.filter(l => wonIds.has(l.stageId)), l => l.value) }
    })
    const orphan = cur.filter(l => !known.has(l.sourceId))
    if (orphan.length) bySource.push({ id: '_none', name: 'No source', color: 'var(--c-border)', value: orphan.length, won: orphan.filter(l => wonIds.has(l.stageId)).length, wonValue: sum(orphan.filter(l => wonIds.has(l.stageId)), l => l.value) })
    bySource.sort((a, b) => b.value - a.value)

    const reasonIds = new Set(lostReasons.map(x => x.id))
    const whyLost = lostReasons.map(x => ({ key: x.id, label: x.label, value: lost.filter(l => l.lostReasonId === x.id).length }))
    whyLost.push({ key: '_none', label: 'No reason recorded', value: lost.filter(l => !l.lostReasonId || !reasonIds.has(l.lostReasonId)).length })
    whyLost.sort((a, b) => b.value - a.value)

    const repRow = (id: string, name: string, color: string | undefined, rows: Lead[], openTasks: number) => {
      const w2 = rows.filter(l => wonIds.has(l.stageId)), l2 = rows.filter(l => lostIds.has(l.stageId))
      return { id, name, color, leads: rows.length, won: w2.length, lost: l2.length, closed: w2.length + l2.length, wonValue: sum(w2, l => l.value), openTasks }
    }
    const userIds = new Set(users.map(u => u.id))
    const reps = users
      .map(u => repRow(u.id, u.name, u.color, cur.filter(l => l.ownerId === u.id), tasks.filter(t => t.assigneeId === u.id && t.status === 'pending').length))
      .filter((x, i) => x.leads > 0 || x.openTasks > 0 || users[i].active)
    const unowned = cur.filter(l => !l.ownerId || !userIds.has(l.ownerId))
    if (unowned.length) reps.push(repRow('_none', 'Unassigned', undefined, unowned, 0))
    reps.sort((a, b) => b.wonValue - a.wonValue || b.leads - a.leads)

    return { w, cur, now: kpi(cur), prev: kpi(prev), won, lost, funnel, bySource, whyLost, reps, wonIds }
  }, [leads, stages, sources, lostReasons, users, tasks, period])

  const pivot = useMemo(() => {
    const groups = new Map<string, { label: string; color?: string; rows: Lead[] }>()
    const stageOf = new Map(stages.map(s => [s.id, s])), sourceOf = new Map(sources.map(s => [s.id, s])), userOf = new Map(users.map(u => [u.id, u]))
    for (const l of r.cur) {
      let key = '', label = '', color: string | undefined
      if (dim === 'stage') { const s = stageOf.get(l.stageId); key = s?.id ?? '_'; label = s?.label ?? 'No stage'; color = s?.color }
      else if (dim === 'source') { const s = sourceOf.get(l.sourceId); key = s?.id ?? '_'; label = s?.label ?? 'No source'; color = s?.color }
      else if (dim === 'owner') { const u = l.ownerId ? userOf.get(l.ownerId) : undefined; key = u?.id ?? '_'; label = u?.name ?? 'Unassigned'; color = u?.color }
      else if (dim === 'city') { label = l.city?.trim() || 'City not filled'; key = label.toLowerCase() }
      else { label = l.homeSize?.trim() || 'Home size not filled'; key = label.toLowerCase() }
      const g = groups.get(key) ?? { label, color, rows: [] }
      g.rows.push(l); groups.set(key, g)
    }
    const rows = [...groups.entries()].map(([key, g]) => ({
      key, label: g.label, color: g.color,
      value: metric === 'count' ? g.rows.length : metric === 'value' ? sum(g.rows, l => l.value) : g.rows.filter(l => r.wonIds.has(l.stageId)).length,
    }))
    rows.sort((a, b) => (sort.by === 'label' ? a.label.localeCompare(b.label) : a.value - b.value) * sort.dir || a.label.localeCompare(b.label))
    return { rows, total: sum(rows, x => x.value), max: Math.max(1, ...rows.map(x => x.value)) }
  }, [r.cur, r.wonIds, dim, metric, sort, stages, sources, users])

  const periodLabel = PERIODS.find(p => p.id === period)!.label
  const dimLabel = DIMS.find(d => d.id === dim)!.label
  const metricLabel = METRICS.find(m => m.id === metric)!.label
  const fmtMetric = (n: number) => (metric === 'value' ? inr(n) : n.toLocaleString('en-IN'))
  const slug = periodLabel.toLowerCase().replace(/\s+/g, '-')
  const hasPrev = r.w.hasPrev

  const csv = {
    reps: () => downloadCsv(`rep-performance-${slug}.csv`, r.reps.map(x => ({ 'Team member': x.name, Leads: x.leads, Won: x.won, Lost: x.lost, 'Win rate %': x.closed ? pct(x.won, x.closed) : '', 'Won value (INR)': x.wonValue, 'Open tasks': x.openTasks }))),
    sources: () => downloadCsv(`lead-sources-${slug}.csv`, r.bySource.map(x => ({ Source: x.name, Leads: x.value, 'Share %': pct(x.value, r.cur.length), Won: x.won, 'Won value (INR)': x.wonValue }))),
    funnel: () => downloadCsv(`conversion-funnel-${slug}.csv`, r.funnel.map(x => ({ Stage: x.stage.label, 'Leads at or beyond': x.count, '% of first stage': pct(x.count, r.funnel[0]?.count ?? 0) }))),
    explore: () => downloadCsv(`leads-by-${dim}-${slug}.csv`, pivot.rows.map(x => ({ [dimLabel]: x.label, [metricLabel]: x.value, 'Share %': pct(x.value, pivot.total) }))),
  }
  const dl = (fn: () => void, disabled: boolean) => <Button size="sm" variant="ghost" icon={Download} onClick={fn} disabled={disabled}>CSV</Button>

  const SortTh = ({ by, children, right }: { by: 'label' | 'value'; children: string; right?: boolean }) => {
    const Icon = sort.by !== by ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown
    return (
      <th className={cn(thCls, right && 'text-right')} aria-sort={sort.by === by ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
        <button className={cn('inline-flex cursor-pointer items-center gap-1 uppercase hover:text-text', sort.by === by && 'text-text')} onClick={() => setSort(s => ({ by, dir: s.by === by ? (s.dir === 1 ? -1 : 1) : by === 'label' ? 1 : -1 }))}>
          {children}<Icon size={12} />
        </button>
      </th>
    )
  }

  return (
    <div>
      <PageHeader
        title="Lead reports" icon={FileBarChart}
        subtitle={<>Leads created {r.w.start === null ? 'at any time' : `${fmtDate(new Date(r.w.start).toISOString())} – today`}{hasPrev && <> · compared with {fmtDate(new Date(r.w.prevStart).toISOString())} – {fmtDate(new Date((r.w.start as number) - 1).toISOString())}</>}</>}
        actions={<>
          <Select aria-label="Period" value={period} onChange={e => setPeriod(e.target.value as Period)} className="w-40">
            {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
          <Button icon={Download} onClick={tab === 'explore' ? csv.explore : csv.reps} disabled={tab === 'explore' ? !pivot.rows.length : !r.reps.length}>
            {tab === 'explore' ? 'Download table' : 'Download rep performance'}
          </Button>
        </>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="New leads" value={r.now.total} hint={<Delta now={r.now.total} prev={r.prev.total} hasPrev={hasPrev} />} />
        <StatCard label="Won" value={r.now.won} tone="good" hint={<Delta now={r.now.won} prev={r.prev.won} hasPrev={hasPrev} />} />
        <StatCard label="Conversion rate" value={`${r.now.conv.toFixed(1)}%`} hint={<Delta now={r.now.conv} prev={r.prev.conv} hasPrev={hasPrev} format={n => `${n.toFixed(1)} pts`} formatPrev={n => `${n.toFixed(1)}%`} />} />
        <StatCard label="Won value" value={inr(r.now.wonValue)} hint={<Delta now={r.now.wonValue} prev={r.prev.wonValue} hasPrev={hasPrev} format={inr} />} />
        <StatCard label="Avg days to win" value={r.now.won ? r.now.avgDays.toFixed(1) : '—'} hint={r.now.won && r.prev.won ? <Delta now={r.now.avgDays} prev={r.prev.avgDays} hasPrev={hasPrev} lowerIsBetter format={n => `${n.toFixed(1)} days`} /> : r.now.won ? 'No wins in the previous period' : 'No won leads in this period'} />
        <StatCard label="Overdue follow-ups" value={r.now.overdue} tone={r.now.overdue ? 'warn' : 'default'} hint={<Delta now={r.now.overdue} prev={r.prev.overdue} hasPrev={hasPrev} lowerIsBetter />} />
      </div>
      <p className="-mt-2 mb-4 text-xs text-muted">
        Every figure follows the leads created in the chosen period. Avg days to win runs from the day a lead was created to its last update. Overdue follow-ups are open leads whose follow-up date has passed.
      </p>

      <Tabs<Tab> className="mb-4" value={tab} onChange={setTab} tabs={[{ id: 'report', label: 'Report', icon: FileBarChart }, { id: 'explore', label: 'Explore', icon: Table2 }]} />

      {!r.cur.length ? (
        <Card><EmptyState icon={FileBarChart} title={`No leads were created in: ${periodLabel.toLowerCase()}`} text="Pick a longer period, or add a lead." action={<div className="flex gap-2"><Button onClick={() => setPeriod('all')}>Show all time</Button><Link to="/leads"><Button variant="primary">Go to leads</Button></Link></div>} /></Card>
      ) : tab === 'report' ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Conversion funnel" action={dl(csv.funnel, !r.funnel.length)}>
              <div className="p-4">
                <BarList max={r.funnel[0]?.count || 1} rows={r.funnel.map(f => ({
                  key: f.stage.id, value: f.count, color: f.stage.color, label: f.stage.label,
                  right: <><span className="font-medium text-text">{f.count}</span> · {pct(f.count, r.funnel[0].count)}%</>,
                }))} />
                <p className="mt-3 text-xs text-muted">
                  Each bar counts leads that are in that stage or further along; % is of the first stage.{' '}
                  <span className="font-medium text-rose-600">{r.lost.length} lost</span>
                  {r.lost.length > 0 && ' — counted in the first stage only, because the stage a lead was lost at is not recorded.'}
                </p>
              </div>
            </Card>
            <Card title="Why we lost" action={<span className="text-xs text-muted">{r.lost.length} lost {r.lost.length === 1 ? 'lead' : 'leads'}</span>}>
              <div className="p-4">
                {r.lost.length ? (
                  <BarList rows={r.whyLost.map(x => ({ key: x.key, label: x.label, value: x.value, color: x.key === '_none' ? TONE.muted : TONE.bad, right: <><span className="font-medium text-text">{x.value}</span> · {pct(x.value, r.lost.length)}%</> }))} />
                ) : <p className="py-8 text-center text-sm text-muted">No leads from this period have been lost.</p>}
              </div>
            </Card>
          </div>

          <Card title="Lead sources" action={dl(csv.sources, !r.bySource.length)}>
            <div className="grid gap-4 p-4 lg:grid-cols-2">
              <Donut data={r.bySource.map(s => ({ name: s.name, value: s.value, color: s.color }))} centreSub="leads" />
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className={tableCls}>
                  <thead><tr><th className={thCls}>Source</th><th className={thCls + ' text-right'}>Leads</th><th className={thCls + ' text-right'}>Share</th><th className={thCls + ' text-right'}>Won</th><th className={thCls + ' text-right'}>Won value</th></tr></thead>
                  <tbody>
                    {r.bySource.map(s => (
                      <tr key={s.id} className={trCls}>
                        <td className={tdCls}><span className="inline-flex items-center gap-2 whitespace-nowrap"><span className="size-2.5 rounded-sm" style={{ background: s.color }} />{s.name}</span></td>
                        <td className={tdCls + ' text-right font-medium tabular-nums'}>{s.value}</td>
                        <td className={tdCls + ' text-right tabular-nums'}>{pct(s.value, r.cur.length)}%</td>
                        <td className={tdCls + ' text-right tabular-nums'}>{s.won}</td>
                        <td className={tdCls + ' text-right tabular-nums'}>{inr(s.wonValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          <Card title="Rep performance" action={dl(csv.reps, !r.reps.length)}>
            <div className="overflow-x-auto">
              <table className={tableCls}>
                <thead><tr><th className={thCls}>Team member</th>{['Leads', 'Won', 'Lost', 'Win rate', 'Won value', 'Open tasks'].map(h => <th key={h} className={thCls + ' text-right'}>{h}</th>)}</tr></thead>
                <tbody>
                  {r.reps.map(x => (
                    <tr key={x.id} className={trCls}>
                      <td className={tdCls}><span className="flex items-center gap-2 whitespace-nowrap"><Avatar name={x.name} color={x.color} size={24} />{x.name}</span></td>
                      <td className={tdCls + ' text-right font-medium tabular-nums'}>{x.leads}</td>
                      <td className={tdCls + ' text-right tabular-nums text-emerald-600'}>{x.won}</td>
                      <td className={tdCls + ' text-right tabular-nums text-rose-600'}>{x.lost}</td>
                      <td className={tdCls + ' text-right tabular-nums'}>{x.closed ? `${pct(x.won, x.closed)}%` : '—'}</td>
                      <td className={tdCls + ' text-right tabular-nums'}>{inr(x.wonValue)}</td>
                      <td className={tdCls + ' text-right tabular-nums'}>{x.openTasks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-3 text-xs text-muted">Win rate = won ÷ (won + lost). Open tasks are all pending tasks assigned to the person today, whatever the period.</p>
          </Card>
        </div>
      ) : (
        <Card title={`${metricLabel} by ${dimLabel.toLowerCase()}`} action={dl(csv.explore, !pivot.rows.length)}>
          <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:max-w-xl">
            <Field label="Rows (group leads by)"><Select value={dim} onChange={e => setDim(e.target.value as Dim)}>{DIMS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</Select></Field>
            <Field label="Value to show"><Select value={metric} onChange={e => setMetric(e.target.value as Metric)}>{METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</Select></Field>
          </div>
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead><tr><SortTh by="label">{dimLabel}</SortTh><SortTh by="value" right>{metricLabel}</SortTh><th className={thCls + ' text-right'}>Share</th><th className={thCls + ' w-1/3 min-w-32'} aria-hidden /></tr></thead>
              <tbody>
                {pivot.rows.map(x => (
                  <tr key={x.key} className={trCls}>
                    <td className={tdCls}><span className="inline-flex items-center gap-2 whitespace-nowrap">{x.color && <span className="size-2.5 rounded-sm" style={{ background: x.color }} />}{x.label}</span></td>
                    <td className={tdCls + ' text-right font-medium tabular-nums'}>{fmtMetric(x.value)}</td>
                    <td className={tdCls + ' text-right tabular-nums text-muted'}>{pct(x.value, pivot.total)}%</td>
                    <td className={tdCls}><div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${(x.value / pivot.max) * 100}%`, background: x.color ?? 'var(--c-brand)' }} /></div></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td className="px-3 py-2.5 font-semibold">Total · {pivot.rows.length} {pivot.rows.length === 1 ? 'row' : 'rows'}</td><td className="px-3 py-2.5 text-right font-semibold tabular-nums">{fmtMetric(pivot.total)}</td><td className="px-3 py-2.5 text-right text-muted">100%</td><td /></tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
