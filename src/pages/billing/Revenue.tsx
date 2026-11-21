import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { eachDayOfInterval, eachMonthOfInterval, endOfDay, endOfMonth, format, startOfDay, startOfMonth, startOfYear, subDays, subMonths } from 'date-fns'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Clock, IndianRupee, TrendingUp, Wallet } from 'lucide-react'
import { useStore } from '@/lib/store'
import { inr } from '@/lib/utils'
import { Card, EmptyState, PageHeader, Select, StatCard } from '@/components/ui'
import { PAY_MODES, daysOverdue, invoiceMoney, isBilled, isOpen } from '@/components/billing/shared'

type Period = 'this_month' | 'last_month' | 'last_90' | 'this_year'
const PERIODS: { id: Period; label: string }[] = [{ id: 'this_month', label: 'This month' }, { id: 'last_month', label: 'Last month' }, { id: 'last_90', label: 'Last 90 days' }, { id: 'this_year', label: 'This year' }]
function rangeOf(p: Period): [Date, Date] {
  const now = new Date()
  if (p === 'this_month') return [startOfMonth(now), endOfDay(now)]
  if (p === 'last_month') { const m = subMonths(now, 1); return [startOfMonth(m), endOfMonth(m)] }
  if (p === 'last_90') return [startOfDay(subDays(now, 89)), endOfDay(now)]
  return [startOfYear(now), endOfDay(now)]
}
const short = (v: number) => (v >= 10000000 ? `${+(v / 10000000).toFixed(1)}Cr` : v >= 100000 ? `${+(v / 100000).toFixed(1)}L` : v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v))
const tip = { contentStyle: { background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 12, color: 'var(--c-text)' }, labelStyle: { color: 'var(--c-text)', fontWeight: 600 }, itemStyle: { color: 'var(--c-text)' }, cursor: { fill: 'var(--c-surface-2)' } }
const axis = { tick: { fontSize: 11, fill: 'var(--c-muted)' }, axisLine: { stroke: 'var(--c-border)' }, tickLine: false as const }
const AGE = [
  { id: 'not_due', label: 'Not due yet', color: '#10b981' }, { id: 'd7', label: '1–7 days overdue', color: '#f59e0b' },
  { id: 'd30', label: '8–30 days overdue', color: '#f97316' }, { id: 'd30p', label: '30+ days overdue', color: '#e11d48' },
] as const

export default function Revenue() {
  const invoices = useStore(s => s.invoices)
  const payments = useStore(s => s.payments)
  const [period, setPeriod] = useState<Period>('this_month')

  const data = useMemo(() => {
    const [start, end] = rangeOf(period)
    const within = (iso: string) => { const d = new Date(iso); return d >= start && d <= end }
    const cancelled = new Set(invoices.filter(i => i.status === 'cancelled').map(i => i.id))
    const billed = invoices.filter(i => isBilled(i) && within(i.issueDate)).map(i => ({ inv: i, ...invoiceMoney(i, payments) }))
    const received = payments.filter(p => !cancelled.has(p.invoiceId) && within(p.at))
    const invoiced = billed.reduce((s, r) => s + r.total, 0)
    const collected = received.reduce((s, p) => s + p.amount, 0)
    const pending = billed.reduce((s, r) => s + r.balance, 0)

    const byMonth = period === 'this_year'
    const keyOf = (iso: string) => format(new Date(iso), byMonth ? 'yyyy-MM' : 'yyyy-MM-dd')
    const buckets = (byMonth ? eachMonthOfInterval({ start, end }) : eachDayOfInterval({ start, end })).map(d => ({ key: format(d, byMonth ? 'yyyy-MM' : 'yyyy-MM-dd'), label: format(d, byMonth ? 'MMM' : 'd MMM'), Invoiced: 0, Collected: 0 }))
    const idx = new Map(buckets.map(b => [b.key, b]))
    billed.forEach(r => { const b = idx.get(keyOf(r.inv.issueDate)); if (b) b.Invoiced += Math.round(r.total) })
    received.forEach(p => { const b = idx.get(keyOf(p.at)); if (b) b.Collected += Math.round(p.amount) })

    const modes = PAY_MODES.map(m => ({ name: m.label, color: m.color, value: received.filter(p => p.mode === m.id).reduce((s, p) => s + p.amount, 0) })).filter(m => m.value > 0)

    const top = new Map<string, { name: string; leadId?: string; billed: number; paid: number; count: number }>()
    billed.forEach(r => {
      const k = r.inv.leadId ?? r.inv.customerName.toLowerCase()
      const t = top.get(k) ?? { name: r.inv.customerName, leadId: r.inv.leadId, billed: 0, paid: 0, count: 0 }
      t.billed += r.total; t.paid += r.paid; t.count++; top.set(k, t)
    })
    const customers = [...top.values()].sort((a, b) => b.billed - a.billed).slice(0, 6)

    // Money owed is as of today, whatever period is chosen.
    const ageing = AGE.map(a => ({ ...a, amount: 0, count: 0 }))
    invoices.filter(isOpen).forEach(i => {
      const bal = invoiceMoney(i, payments).balance
      if (bal <= 0) return
      const d = daysOverdue(i)
      const b = ageing[d <= 0 ? 0 : d <= 7 ? 1 : d <= 30 ? 2 : 3]
      b.amount += bal; b.count++
    })
    return { invoiced, collected, pending, count: billed.length, payCount: received.length, buckets, byMonth, modes, customers, ageing, owed: ageing.reduce((s, a) => s + a.amount, 0) }
  }, [invoices, payments, period])

  const label = PERIODS.find(p => p.id === period)!.label.toLowerCase()
  const hasTrend = data.buckets.some(b => b.Invoiced || b.Collected)
  const maxBilled = data.customers[0]?.billed || 1

  return (
    <div>
      <PageHeader title="Revenue" icon={TrendingUp} subtitle="What you billed, what came in and what is still owed" actions={
        <Select className="w-auto" value={period} onChange={e => setPeriod(e.target.value as Period)} aria-label="Period">{PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</Select>
      } />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Invoiced" value={inr(data.invoiced)} icon={IndianRupee} hint={`${data.count} invoice${data.count === 1 ? '' : 's'} issued ${label}`} />
        <StatCard label="Collected" value={inr(data.collected)} tone="good" icon={Wallet} hint={`${data.payCount} payment${data.payCount === 1 ? '' : 's'} received ${label}`} />
        <StatCard label="Pending" value={inr(data.pending)} tone={data.pending ? 'warn' : 'default'} icon={Clock} hint="Unpaid balance on the invoices issued in this period" />
      </div>

      <Card title={`Invoiced and collected by ${data.byMonth ? 'month' : 'day'}`} className="mb-4">
        {hasTrend ? (
          <div className="h-72 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={1}>
                <CartesianGrid stroke="var(--c-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" {...axis} minTickGap={16} />
                <YAxis {...axis} width={48} tickFormatter={short} />
                <Tooltip {...tip} formatter={v => inr(Number(v))} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Invoiced" fill="var(--c-muted)" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Collected" fill="var(--c-brand)" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyState icon={TrendingUp} title="Nothing billed or collected in this period" text="Pick a longer period, or issue an invoice." action={<Link to="/billing/invoices/new" className="text-sm font-medium text-brand hover:underline">Create an invoice</Link>} />}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="How customers paid">
          {data.modes.length ? (
            <div className="grid items-center gap-2 p-4 sm:grid-cols-2">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.modes} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="var(--c-surface)">
                      {data.modes.map(m => <Cell key={m.name} fill={m.color} />)}
                    </Pie>
                    <Tooltip {...tip} cursor={false} formatter={v => inr(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-2 text-sm">
                {data.modes.map(m => (
                  <li key={m.name} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: m.color }} />{m.name}</span>
                    <span className="font-medium">{inr(m.value)} <span className="text-xs font-normal text-muted">{Math.round((m.value / data.collected) * 100)}%</span></span>
                  </li>
                ))}
              </ul>
            </div>
          ) : <EmptyState icon={Wallet} title="No payments in this period" />}
        </Card>

        <Card title="Money owed" action={<span className="text-xs text-muted">As of today · {inr(data.owed)}</span>}>
          {data.owed > 0 ? (
            <div className="p-4">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.ageing} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--c-border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" {...axis} interval={0} tickFormatter={(v: string) => v.replace(' overdue', '').replace(' yet', '')} />
                    <YAxis {...axis} width={48} tickFormatter={short} />
                    <Tooltip {...tip} formatter={v => [inr(Number(v)), 'Owed']} />
                    <Bar dataKey="amount" radius={[3, 3, 0, 0]} maxBarSize={56}>{data.ageing.map(a => <Cell key={a.id} fill={a.color} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {data.ageing.map(a => (
                  <li key={a.id} className="rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted"><span className="size-2 rounded-full" style={{ background: a.color }} />{a.label}</div>
                    <div className="font-semibold">{inr(a.amount)}</div>
                    <div className="text-xs text-muted">{a.count} invoice{a.count === 1 ? '' : 's'}</div>
                  </li>
                ))}
              </ul>
            </div>
          ) : <EmptyState icon={Clock} title="Nothing is owed" text="Every issued invoice is fully paid." />}
        </Card>

        <Card title={`Top customers by billed amount · ${label}`} className="lg:col-span-2">
          {data.customers.length ? (
            <ul className="space-y-3 p-4">
              {data.customers.map((c, i) => (
                <li key={i}>
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                    {c.leadId ? <Link to={`/leads/${c.leadId}`} className="font-medium hover:text-brand">{c.name}</Link> : <span className="font-medium">{c.name}</span>}
                    <span><span className="font-semibold">{inr(c.billed)}</span> <span className="text-xs text-muted">· {c.count} invoice{c.count === 1 ? '' : 's'} · {inr(c.paid)} received</span></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2" title={`${inr(c.paid)} received of ${inr(c.billed)}`}>
                    <div className="h-full rounded-full bg-brand/30" style={{ width: `${(c.billed / maxBilled) * 100}%` }}>
                      <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, c.billed ? (c.paid / c.billed) * 100 : 0)}%` }} />
                    </div>
                  </div>
                </li>
              ))}
              <li className="flex gap-4 pt-1 text-xs text-muted"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand" />Received</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand/30" />Billed, not yet received</span></li>
            </ul>
          ) : <EmptyState icon={IndianRupee} title="No invoices issued in this period" />}
        </Card>
      </div>
    </div>
  )
}
