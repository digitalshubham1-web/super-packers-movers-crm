import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format, startOfDay, subDays } from 'date-fns'
import { BarChart3, IndianRupee, MessageCircle, Phone, Target, Trophy, Users } from 'lucide-react'
import { useStore } from '@/lib/store'
import { Avatar, Button, Card, EmptyState, PageHeader, StatCard, Tabs, tableCls, tdCls, thCls, trCls } from '@/components/ui'
import { inr } from '@/lib/utils'
import { BarList, Donut, Mini, TONE, axisTick, pct, splitLeads, sum, talkTime, tooltipStyle } from '@/components/insights/shared'

type Tab = 'crm' | 'whatsapp' | 'calls'

/** Count records per calendar day for the last `days` days (today included). */
function perDay(dates: string[], days: number) {
  const today = startOfDay(new Date())
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = subDays(today, days - 1 - i)
    return { key: format(d, 'yyyy-MM-dd'), label: format(d, 'd MMM'), count: 0 }
  })
  const idx = new Map(buckets.map((b, i) => [b.key, i]))
  for (const iso of dates) {
    const i = idx.get(format(new Date(iso), 'yyyy-MM-dd'))
    if (i !== undefined) buckets[i].count++
  }
  return buckets
}

const ACTIVITY_LABEL: Record<string, string> = {
  note: 'Notes', call: 'Calls', whatsapp: 'WhatsApp', email: 'Emails', stage: 'Stage changes', owner: 'Owner changes',
  task: 'Tasks', system: 'System', invoice: 'Invoices', quotation: 'Quotations',
}

function CrmTab() {
  const leads = useStore(s => s.leads)
  const stages = useStore(s => s.stages)
  const sources = useStore(s => s.sources)
  const activities = useStore(s => s.activities)

  const d = useMemo(() => {
    const { won, lost, open } = splitLeads(leads, stages)
    const ordered = [...stages].sort((a, b) => a.order - b.order)
    const byStage = ordered.map(st => {
      const rows = leads.filter(l => l.stageId === st.id)
      return { stage: st, count: rows.length, value: sum(rows, l => l.value) }
    })
    const known = new Set(sources.map(s => s.id))
    const bySource = sources.map(s => ({ name: s.label, value: leads.filter(l => l.sourceId === s.id).length, color: s.color ?? 'var(--c-muted)' }))
    const noSource = leads.filter(l => !known.has(l.sourceId)).length
    if (noSource) bySource.push({ name: 'No source', value: noSource, color: 'var(--c-border)' })
    bySource.sort((a, b) => b.value - a.value)
    const types = new Map<string, number>()
    for (const a of activities) types.set(a.type, (types.get(a.type) ?? 0) + 1)
    const byType = [...types.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count)
    const daily = perDay(leads.map(l => l.createdAt), 30)
    return {
      won, lost, open, byStage, bySource, byType, daily,
      pipelineValue: sum(open, l => l.value), wonValue: sum(won, l => l.value),
      last30: sum(daily, x => x.count),
    }
  }, [leads, stages, sources, activities])

  if (!leads.length) {
    return <Card><EmptyState icon={BarChart3} title="No leads yet" text="Charts appear here as soon as the first enquiry is added." action={<Link to="/leads"><Button variant="primary">Go to leads</Button></Link>} /></Card>
  }
  const closed = d.won.length + d.lost.length

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Pipeline value" icon={IndianRupee} value={inr(d.pipelineValue)} hint={`${d.open.length} ${d.open.length === 1 ? 'lead' : 'leads'} in play`} />
        <StatCard label="Revenue won" icon={Trophy} tone="good" value={inr(d.wonValue)} hint={`${d.won.length} won`} />
        <StatCard label="Total leads" icon={Users} value={leads.length} hint={`${pct(d.won.length, leads.length)}% converted to won`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Sales pipeline" className="lg:col-span-2">
          <div className="p-4">
            <BarList rows={d.byStage.map(r => ({
              key: r.stage.id, value: r.count, color: r.stage.color,
              label: <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-sm" style={{ background: r.stage.color }} />{r.stage.label}</span>,
              right: <><span className="font-medium text-text">{r.count}</span> {r.count === 1 ? 'lead' : 'leads'} · {inr(r.value)}</>,
            }))} />
            <p className="mt-3 text-xs text-muted">Bar length shows the number of leads in each stage. The amount is the total expected value of those leads.</p>
          </div>
        </Card>
        <Card title="Win rate">
          <div className="p-4">
            <Donut
              centre={closed ? `${pct(d.won.length, closed)}%` : '—'} centreSub={closed ? 'of closed leads' : 'none closed yet'} size={150}
              data={[
                { name: 'Won', value: d.won.length, color: TONE.good },
                { name: 'Lost', value: d.lost.length, color: TONE.bad },
                { name: 'Still open', value: d.open.length, color: 'var(--c-border)' },
              ]}
            />
            <p className="mt-3 text-xs text-muted">Win rate = won ÷ (won + lost). Open leads are not counted until they close.</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Leads created per day" action={<span className="text-xs text-muted">Last 30 days · {d.last30} leads</span>} className="lg:col-span-2">
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.daily} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="an-leads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--c-brand)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--c-brand)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--c-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--c-border)' }} interval="preserveStartEnd" minTickGap={28} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--c-muted)', strokeDasharray: '3 3' }} formatter={v => [String(v), 'New leads']} />
                <Area type="monotone" dataKey="count" stroke="var(--c-brand)" strokeWidth={2} fill="url(#an-leads)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Lead sources">
          <div className="p-4"><Donut data={d.bySource} centreSub="leads" size={150} /></div>
        </Card>
      </div>

      <Card title="Activity breakdown" action={<span className="text-xs text-muted">{activities.length} timeline entries in total</span>}>
        <div className="p-4">
          {d.byType.length ? (
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {d.byType.map(r => (
                <BarList key={r.type} max={d.byType[0].count} rows={[{ key: r.type, value: r.count, label: ACTIVITY_LABEL[r.type] ?? r.type, right: <><span className="font-medium text-text">{r.count}</span> · {pct(r.count, activities.length)}%</> }]} />
              ))}
            </div>
          ) : <p className="text-sm text-muted">Nothing has been logged on any lead yet.</p>}
        </div>
      </Card>
    </div>
  )
}

function WhatsAppTab() {
  const conversations = useStore(s => s.conversations)
  const messages = useStore(s => s.messages)
  const campaigns = useStore(s => s.waCampaigns)
  const templates = useStore(s => s.templates)

  const d = useMemo(() => {
    const c = (st: string) => conversations.filter(x => x.status === st).length
    const m = (f: string) => messages.filter(x => x.from === f).length
    const t = (st: string) => templates.filter(x => x.status === st).length
    return {
      convs: [
        { name: 'Active', value: c('active'), color: TONE.good },
        { name: 'Customer asked for a person', value: c('requesting'), color: TONE.warn },
        { name: 'Team has taken over', value: c('intervened'), color: TONE.info },
      ],
      msgs: [
        { name: 'Customers', value: m('customer'), color: TONE.info },
        { name: 'Team members', value: m('agent'), color: 'var(--c-brand)' },
        { name: 'Bot / AI agent', value: m('bot'), color: TONE.violet },
      ],
      tpls: [
        { key: 'approved', label: 'Approved', value: t('approved'), color: TONE.good },
        { key: 'pending', label: 'Waiting for approval', value: t('pending'), color: TONE.warn },
        { key: 'rejected', label: 'Rejected', value: t('rejected'), color: TONE.bad },
        { key: 'draft', label: 'Draft', value: t('draft'), color: 'var(--c-muted)' },
      ],
      unread: sum(conversations, x => x.unread),
      recipients: sum(campaigns, x => x.recipients), sent: sum(campaigns, x => x.sent), delivered: sum(campaigns, x => x.delivered),
      read: sum(campaigns, x => x.read), replied: sum(campaigns, x => x.replied),
    }
  }, [conversations, messages, campaigns, templates])

  const steps = [
    { key: 'sent', label: 'Sent', value: d.sent, of: d.recipients, ofLabel: 'of recipients' },
    { key: 'delivered', label: 'Delivered', value: d.delivered, of: d.sent, ofLabel: 'of sent' },
    { key: 'read', label: 'Read', value: d.read, of: d.delivered, ofLabel: 'of delivered' },
    { key: 'replied', label: 'Replied', value: d.replied, of: d.read, ofLabel: 'of read' },
  ]

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">These figures count the conversations, messages, campaigns and templates saved in this CRM. Live delivery numbers need a connected WhatsApp Business account.</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Conversations" icon={MessageCircle} value={conversations.length} hint={`${d.unread} unread messages`} />
        <StatCard label="Messages" value={messages.length} hint="across all conversations" />
        <StatCard label="Campaigns" value={campaigns.length} hint={`${campaigns.filter(c => c.status === 'completed').length} completed`} />
        <StatCard label="Templates" value={templates.length} hint={`${d.tpls[0].value} approved`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Conversations by status">
          <div className="p-4">{conversations.length ? <Donut data={d.convs} centreSub="conversations" /> : <EmptyState icon={MessageCircle} title="No conversations yet" action={<Link to="/whatsapp/chat"><Button>Open WhatsApp chat</Button></Link>} />}</div>
        </Card>
        <Card title="Messages by sender">
          <div className="p-4">{messages.length ? <Donut data={d.msgs} centreSub="messages" /> : <EmptyState icon={MessageCircle} title="No messages yet" action={<Link to="/whatsapp/chat"><Button>Open WhatsApp chat</Button></Link>} />}</div>
        </Card>
        <Card title="Campaign totals" action={<span className="text-xs text-muted">{campaigns.length} campaigns · {d.recipients} recipients</span>}>
          <div className="p-4">
            {campaigns.length ? (
              <BarList max={Math.max(1, d.recipients, d.sent)} rows={steps.map(s => ({
                key: s.key, label: s.label, value: s.value,
                right: <><span className="font-medium text-text">{s.value.toLocaleString('en-IN')}</span>{s.of > 0 ? ` · ${pct(s.value, s.of)}% ${s.ofLabel}` : ''}</>,
              }))} />
            ) : <EmptyState title="No campaigns yet" action={<Link to="/whatsapp/campaigns"><Button>Create a campaign</Button></Link>} />}
          </div>
        </Card>
        <Card title="Templates by status">
          <div className="p-4">
            {templates.length ? (
              <BarList rows={d.tpls.map(t => ({ key: t.key, label: t.label, value: t.value, color: t.color, right: <span className="font-medium text-text">{t.value}</span> }))} />
            ) : <EmptyState title="No templates yet" action={<Link to="/whatsapp/templates"><Button>Create a template</Button></Link>} />}
          </div>
        </Card>
      </div>
    </div>
  )
}

function CallsTab() {
  const calls = useStore(s => s.calls)
  const users = useStore(s => s.users)

  const d = useMemo(() => {
    const connected = calls.filter(c => c.outcome === 'connected')
    const o = (k: string) => calls.filter(c => c.outcome === k).length
    const row = (key: string, name: string, color: string | undefined, rows: typeof calls) => {
      const conn = rows.filter(c => c.outcome === 'connected')
      const dur = sum(conn, c => c.durationSec)
      return {
        key, name, color, all: rows.length, incoming: rows.filter(c => c.direction === 'incoming').length, outgoing: rows.filter(c => c.direction === 'outgoing').length,
        connected: conn.length, notConnected: rows.length - conn.length, dur, avg: conn.length ? dur / conn.length : 0,
      }
    }
    const human = calls.filter(c => !c.byAi)
    const perUser = users.map(u => row(u.id, u.name, u.color, human.filter(c => c.userId === u.id))).filter(r => r.all > 0)
    const ai = calls.filter(c => c.byAi)
    if (ai.length) perUser.push(row('_ai', 'AI voice agent', undefined, ai))
    const orphan = human.filter(c => !c.userId || !users.some(u => u.id === c.userId))
    if (orphan.length) perUser.push(row('_none', 'No team member', undefined, orphan))
    perUser.sort((a, b) => b.all - a.all)
    const daily = perDay(calls.map(c => c.at), 14)
    return {
      daily, perUser, connected: connected.length, last14: sum(daily, x => x.count),
      talk: sum(connected, c => c.durationSec),
      outcomes: [
        { name: 'Connected', value: o('connected'), color: TONE.good },
        { name: 'No answer', value: o('no_answer'), color: TONE.warn },
        { name: 'Missed', value: o('missed'), color: TONE.bad },
        { name: 'Busy', value: o('busy'), color: 'var(--c-muted)' },
      ],
    }
  }, [calls, users])

  if (!calls.length) {
    return <Card><EmptyState icon={Phone} title="No calls logged yet" text="Calls logged from the Calling page appear here." action={<Link to="/calling"><Button variant="primary">Go to calling</Button></Link>} /></Card>
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">Based on call records saved in this CRM. Automatic call logging needs a connected telephony account.</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Total calls" icon={Phone} value={calls.length} hint={`${d.last14} in the last 14 days`} />
        <StatCard label="Connected" tone="good" value={d.connected} hint={`${pct(d.connected, calls.length)}% of all calls`} />
        <StatCard label="Average duration" value={d.connected ? talkTime(Math.round(d.talk / d.connected)) : '—'} hint="per connected call" />
        <StatCard label="Total talk time" value={talkTime(d.talk)} hint="connected calls only" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Calls per day" action={<span className="text-xs text-muted">Last 14 days</span>} className="lg:col-span-2">
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.daily} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--c-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--c-border)' }} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--c-surface-2)' }} formatter={v => [String(v), 'Calls']} />
                <Bar dataKey="count" fill="var(--c-brand)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Outcome split">
          <div className="p-4"><Donut data={d.outcomes} centreSub="calls" size={150} /></div>
        </Card>
      </div>
      <Card title="Calls by team member">
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead><tr>{['Team member', 'Calls', 'Incoming', 'Outgoing', 'Connected', 'Not connected', 'Talk time', 'Avg duration'].map(h => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>
              {d.perUser.map(r => (
                <tr key={r.key} className={trCls}>
                  <td className={tdCls}><span className="flex items-center gap-2 whitespace-nowrap"><Avatar name={r.name} color={r.color} size={24} />{r.name}</span></td>
                  <td className={tdCls + ' font-medium tabular-nums'}>{r.all}</td>
                  <td className={tdCls + ' tabular-nums'}>{r.incoming}</td>
                  <td className={tdCls + ' tabular-nums'}>{r.outgoing}</td>
                  <td className={tdCls + ' tabular-nums'}>{r.connected} <span className="text-xs text-muted">({pct(r.connected, r.all)}%)</span></td>
                  <td className={tdCls + ' tabular-nums'}>{r.notConnected}</td>
                  <td className={tdCls + ' whitespace-nowrap tabular-nums'}>{talkTime(r.dur)}</td>
                  <td className={tdCls + ' whitespace-nowrap tabular-nums'}>{r.connected ? talkTime(Math.round(r.avg)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export default function Analytics() {
  const [tab, setTab] = useState<Tab>('crm')
  return (
    <div>
      <PageHeader title="Analytics" subtitle="Live numbers from your leads, WhatsApp and calls" icon={BarChart3} actions={<Link to="/reports/leads"><Button icon={Target}>Lead reports</Button></Link>} />
      <Tabs<Tab> className="mb-4" value={tab} onChange={setTab} tabs={[{ id: 'crm', label: 'CRM', icon: Users }, { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle }, { id: 'calls', label: 'Calls', icon: Phone }]} />
      {tab === 'crm' && <CrmTab />}
      {tab === 'whatsapp' && <WhatsAppTab />}
      {tab === 'calls' && <CallsTab />}
    </div>
  )
}
