import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { isToday } from 'date-fns'
import { Bot, Clock, Delete, Download, Hash, History, Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, Search, Trash2, X } from 'lucide-react'
import { useStore, useCurrentUser } from '@/lib/store'
import type { Call, Lead } from '@/lib/types'
import { downloadCsv, fmtDateTime, fmtDuration, friendlyDay } from '@/lib/utils'
import { Badge, Button, Card, DemoNotice, EmptyState, Field, Input, Modal, PageHeader, Select, StatCard, Tabs, Textarea, tableCls, tableWrap, tdCls, thCls, trCls } from '@/components/ui'
import { LeadPicker, NumbersPanel, integrationsLink, outcomeLabel, outcomeTone, telHref } from '@/components/calling/shared'

type Tab = 'dialer' | 'history' | 'numbers'
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0', '⌫']

export default function Calling() {
  const [tab, setTab] = useState<Tab>('dialer')
  const calls = useStore(s => s.calls)
  return (
    <div>
      <PageHeader title="Calling" subtitle="Call from your own phone and keep a record of every call" icon={Phone} />
      <DemoNotice>
        No telephony provider is connected, so this page cannot place, receive or record calls by itself. The Call button opens your own phone's dialler (a tel: link) and you then log the result here by hand.
        Incoming and AI calls in the history are sample data. Connect Exotel, Plivo or Twilio under {integrationsLink} for click-to-call, automatic logging and recordings.
      </DemoNotice>
      <Tabs<Tab>
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[{ id: 'dialer', label: 'Dialer', icon: PhoneCall }, { id: 'history', label: 'Call history', icon: History, count: calls.length }, { id: 'numbers', label: 'Numbers', icon: Hash }]}
      />
      {tab === 'dialer' && <Dialer />}
      {tab === 'history' && <CallHistory />}
      {tab === 'numbers' && <NumbersPanel />}
    </div>
  )
}

function Dialer() {
  const me = useCurrentUser()
  const calls = useStore(s => s.calls)
  const [number, setNumber] = useState('')
  const [lead, setLead] = useState<Lead | null>(null)
  const [logging, setLogging] = useState<{ phone: string; lead: Lead | null; at: string } | null>(null)
  const [outcome, setOutcome] = useState<Call['outcome']>('connected')
  const [min, setMin] = useState('0')
  const [sec, setSec] = useState('0')
  const [notes, setNotes] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [saved, setSaved] = useState('')

  const today = useMemo(() => {
    const mine = calls.filter(c => c.userId === me.id && !c.byAi && isToday(new Date(c.at)))
    return { total: mine.length, connected: mine.filter(c => c.outcome === 'connected').length, talk: mine.reduce((s, c) => s + c.durationSec, 0), recent: mine.slice(0, 5) }
  }, [calls, me.id])

  const press = (k: string) => {
    setSaved('')
    if (k === '⌫') setNumber(n => n.slice(0, -1))
    else setNumber(n => n + k)
    setLead(null)
  }
  const pickLead = (l: Lead) => { setLead(l); setNumber(l.phone); setSaved('') }
  const canCall = number.replace(/\D/g, '').length >= 5

  const startCall = () => {
    setLogging({ phone: number, lead, at: new Date().toISOString() })
    setOutcome('connected'); setMin('0'); setSec('0'); setNotes(''); setFollowUp(''); setSaved('')
  }
  const saveLog = () => {
    if (!logging) return
    const { add, update, log } = useStore.getState()
    const durationSec = outcome === 'connected' ? Math.max(0, (parseInt(min) || 0) * 60 + (parseInt(sec) || 0)) : 0
    const name = logging.lead?.name ?? 'Unknown number'
    add('calls', { leadId: logging.lead?.id, name, phone: logging.phone, userId: me.id, direction: 'outgoing', outcome, durationSec, at: logging.at, summary: notes.trim() || undefined })
    log('call', `Outgoing call to ${name} — ${outcomeLabel[outcome]}${durationSec ? ` (${fmtDuration(durationSec)})` : ''}${notes.trim() ? `. ${notes.trim()}` : ''}`, logging.lead?.id)
    if (followUp) {
      const dueAt = new Date(followUp).toISOString()
      add('tasks', { title: `Follow up with ${name}`, description: notes.trim() || undefined, type: 'Follow up', leadId: logging.lead?.id, assigneeId: me.id, dueAt, status: 'pending', priority: 'medium', createdBy: 'user', createdAt: new Date().toISOString() })
      if (logging.lead) update('leads', logging.lead.id, { nextFollowUpAt: dueAt })
    }
    setSaved(`Call to ${name} logged${followUp ? ' and follow-up task created' : ''}.`)
    setLogging(null); setNumber(''); setLead(null)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="My calls today" value={today.total} icon={Phone} />
        <StatCard label="Connected" value={today.connected} icon={PhoneCall} tone="good" hint={today.total ? `${Math.round((today.connected / today.total) * 100)}% of calls` : undefined} />
        <StatCard label="Talk time" value={fmtDuration(today.talk)} icon={Clock} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="p-4">
          <Field label="Number to call">
            <Input value={number} onChange={e => { setNumber(e.target.value); setLead(null); setSaved('') }} placeholder="+91 98XXX XXXXX" inputMode="tel" className="h-11 text-center text-lg font-semibold tracking-wider" />
          </Field>
          {lead && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand">
              <Link to={`/leads/${lead.id}`} className="truncate font-medium hover:underline">{lead.name} · Lead #{lead.no}</Link>
              <button type="button" onClick={() => setLead(null)} aria-label="Unlink lead" className="cursor-pointer"><X size={14} /></button>
            </div>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {KEYS.map(k => (
              <button key={k} type="button" onClick={() => press(k)} aria-label={k === '⌫' ? 'Delete last digit' : k} className="grid h-12 cursor-pointer place-items-center rounded-lg border border-border bg-surface text-lg font-medium hover:bg-surface-2">
                {k === '⌫' ? <Delete size={18} /> : k}
              </button>
            ))}
          </div>
          {canCall ? (
            <a href={telHref(number)} onClick={startCall} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-brand-fg hover:opacity-90">
              <Phone size={16} /> Call {lead ? lead.name : number}
            </a>
          ) : (
            <Button variant="primary" icon={Phone} disabled className="mt-3 h-11 w-full">Call</Button>
          )}
          <p className="mt-2 text-center text-xs text-muted">Opens your phone's dialler. On a computer this needs a calling app.</p>
          {lead?.doNotCall && <p className="mt-2 rounded-lg bg-rose-500/15 px-3 py-2 text-xs text-rose-600">This lead is marked “Do not call”.</p>}
        </Card>

        <div className="space-y-4">
          <Card title="Find a lead" className="overflow-visible">
            <div className="p-4"><LeadPicker onPick={pickLead} /></div>
          </Card>

          {logging ? (
            <Card title={`Log this call — ${logging.lead?.name ?? logging.phone}`} action={<Button size="sm" variant="ghost" onClick={() => setLogging(null)}>Discard</Button>}>
              <div className="space-y-3 p-4">
                <Field label="What happened?">
                  <div className="flex flex-wrap gap-2">
                    {(['connected', 'no_answer', 'busy', 'missed'] as const).map(o => (
                      <Button key={o} size="sm" variant={outcome === o ? 'primary' : 'secondary'} onClick={() => setOutcome(o)}>{outcomeLabel[o]}</Button>
                    ))}
                  </div>
                </Field>
                {outcome === 'connected' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Duration — minutes"><Input type="number" min={0} value={min} onChange={e => setMin(e.target.value)} /></Field>
                    <Field label="Seconds"><Input type="number" min={0} max={59} value={sec} onChange={e => setSec(e.target.value)} /></Field>
                  </div>
                )}
                <Field label="Notes"><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="What was discussed, what the customer wants next" /></Field>
                <Field label="Follow-up task due (optional)" hint="Creates a task for you. Leave empty for no follow-up.">
                  <Input type="datetime-local" value={followUp} onChange={e => setFollowUp(e.target.value)} />
                </Field>
                <div className="flex justify-end"><Button variant="primary" onClick={saveLog}>Save call log</Button></div>
              </div>
            </Card>
          ) : (
            <Card title="My calls today">
              {saved && <p className="border-b border-border bg-emerald-500/15 px-4 py-2 text-xs text-emerald-600">{saved}</p>}
              {today.recent.length === 0 ? (
                <EmptyState icon={PhoneCall} title="No calls logged today" text="Enter a number or pick a lead, press Call, then log the result." />
              ) : (
                <ul>
                  {today.recent.map(c => (
                    <li key={c.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-sm last:border-b-0">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.name}</span>
                        <span className="text-xs text-muted">{c.phone} · {friendlyDay(c.at)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {c.durationSec > 0 && <span className="text-xs text-muted">{fmtDuration(c.durationSec)}</span>}
                        <Badge tone={outcomeTone[c.outcome]}>{outcomeLabel[c.outcome]}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function CallHistory() {
  const calls = useStore(s => s.calls)
  const users = useStore(s => s.users)
  const [q, setQ] = useState('')
  const [direction, setDirection] = useState('')
  const [outcome, setOutcome] = useState('')
  const [by, setBy] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [detail, setDetail] = useState<Call | null>(null)
  const [del, setDel] = useState<Call | null>(null)

  const userName = (c: Call) => (c.byAi ? 'AI agent' : users.find(u => u.id === c.userId)?.name ?? '—')
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    const fromT = from ? new Date(from + 'T00:00:00').getTime() : -Infinity
    const toT = to ? new Date(to + 'T23:59:59').getTime() : Infinity
    return calls
      .filter(c => {
        const at = new Date(c.at).getTime()
        if (direction && c.direction !== direction) return false
        if (outcome && c.outcome !== outcome) return false
        if (by === 'ai' ? !c.byAi : by ? c.byAi || c.userId !== by : false) return false
        if (at < fromT || at > toT) return false
        if (t && !(c.name.toLowerCase().includes(t) || c.phone.includes(t) || (c.summary ?? '').toLowerCase().includes(t))) return false
        return true
      })
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [calls, q, direction, outcome, by, from, to])
  const filtered = !!(q || direction || outcome || by || from || to)
  const clear = () => { setQ(''); setDirection(''); setOutcome(''); setBy(''); setFrom(''); setTo('') }
  const exportCsv = () =>
    downloadCsv('call-history.csv', rows.map(c => ({
      Time: fmtDateTime(c.at), Name: c.name, Phone: c.phone, Direction: c.direction, Outcome: outcomeLabel[c.outcome], 'Duration (sec)': c.durationSec, By: userName(c), Summary: c.summary ?? '',
    })))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        <div className="relative col-span-2 xl:col-span-2">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, phone or summary" className="pl-8" />
        </div>
        <Select value={direction} onChange={e => setDirection(e.target.value)} aria-label="Direction">
          <option value="">All directions</option><option value="incoming">Incoming</option><option value="outgoing">Outgoing</option>
        </Select>
        <Select value={outcome} onChange={e => setOutcome(e.target.value)} aria-label="Outcome">
          <option value="">All outcomes</option>
          {(Object.keys(outcomeLabel) as Call['outcome'][]).map(o => <option key={o} value={o}>{outcomeLabel[o]}</option>)}
        </Select>
        <Select value={by} onChange={e => setBy(e.target.value)} aria-label="Called by">
          <option value="">Everyone</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          <option value="ai">AI agent</option>
        </Select>
        <Input type="date" value={from} onChange={e => setFrom(e.target.value)} aria-label="From date" />
        <Input type="date" value={to} onChange={e => setTo(e.target.value)} aria-label="To date" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">{rows.length} of {calls.length} calls{filtered && <button type="button" onClick={clear} className="ml-2 cursor-pointer text-brand hover:underline">Clear filters</button>}</p>
        <Button size="sm" icon={Download} disabled={!rows.length} onClick={exportCsv}>Export CSV</Button>
      </div>
      {rows.length === 0 ? (
        <Card><EmptyState icon={History} title={filtered ? 'No calls match these filters' : 'No calls yet'} text={filtered ? undefined : 'Calls you log from the Dialer appear here.'} action={filtered ? <Button onClick={clear}>Clear filters</Button> : undefined} /></Card>
      ) : (
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead>
              <tr>{['Time', 'Name', 'Phone', 'Direction', 'Outcome', 'Duration', 'By', 'Summary', ''].map(h => <th key={h} className={thCls}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(c => (
                <tr key={c.id} className={trCls + ' cursor-pointer'} onClick={() => setDetail(c)}>
                  <td className={tdCls + ' whitespace-nowrap text-xs text-muted'}>{friendlyDay(c.at)}</td>
                  <td className={tdCls + ' whitespace-nowrap font-medium'}>
                    {c.leadId ? <Link to={`/leads/${c.leadId}`} onClick={e => e.stopPropagation()} className="text-brand hover:underline">{c.name}</Link> : c.name}
                  </td>
                  <td className={tdCls + ' whitespace-nowrap'}>{c.phone}</td>
                  <td className={tdCls}><Badge tone={c.direction === 'incoming' ? 'info' : 'brand'}>{c.direction === 'incoming' ? <PhoneIncoming size={12} /> : <PhoneOutgoing size={12} />}{c.direction === 'incoming' ? 'Incoming' : 'Outgoing'}</Badge></td>
                  <td className={tdCls}><Badge tone={outcomeTone[c.outcome]}>{outcomeLabel[c.outcome]}</Badge></td>
                  <td className={tdCls + ' whitespace-nowrap'}>{c.durationSec ? fmtDuration(c.durationSec) : '—'}</td>
                  <td className={tdCls + ' whitespace-nowrap'}>{c.byAi ? <span className="inline-flex items-center gap-1 text-muted"><Bot size={14} />AI agent</span> : userName(c)}</td>
                  <td className={tdCls + ' max-w-64 truncate text-xs text-muted'}>{c.summary ?? '—'}</td>
                  <td className={tdCls}>
                    <button type="button" aria-label="Delete call" onClick={e => { e.stopPropagation(); setDel(c) }} className="cursor-pointer rounded p-1 text-muted hover:bg-rose-500/15 hover:text-rose-600"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Call details" footer={detail && <>
        {detail.leadId && <Link to={`/leads/${detail.leadId}`}><Button>Open lead</Button></Link>}
        <a href={telHref(detail.phone)}><Button variant="primary" icon={Phone}>Call back</Button></a>
      </>}>
        {detail && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold">{detail.name}</span>
              <Badge tone={detail.direction === 'incoming' ? 'info' : 'brand'}>{detail.direction === 'incoming' ? 'Incoming' : 'Outgoing'}</Badge>
              <Badge tone={outcomeTone[detail.outcome]}>{outcomeLabel[detail.outcome]}</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <div><dt className="text-xs text-muted">Phone</dt><dd>{detail.phone}</dd></div>
              <div><dt className="text-xs text-muted">Time</dt><dd>{fmtDateTime(detail.at)}</dd></div>
              <div><dt className="text-xs text-muted">Duration</dt><dd>{detail.durationSec ? fmtDuration(detail.durationSec) : '—'}</dd></div>
              <div><dt className="text-xs text-muted">By</dt><dd>{userName(detail)}</dd></div>
            </dl>
            <div>
              <p className="text-xs text-muted">Summary / notes</p>
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-surface-2 p-3">{detail.summary || 'No notes were saved for this call.'}</p>
            </div>
            <p className="text-xs text-muted">Recordings are not available: no telephony provider is connected.</p>
          </div>
        )}
      </Modal>
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete this call record?" footer={<><Button onClick={() => setDel(null)}>Keep</Button><Button variant="danger" onClick={() => { if (del) useStore.getState().remove('calls', del.id); setDel(null) }}>Delete</Button></>}>
        <p className="text-sm text-muted">The call with {del?.name} on {fmtDateTime(del?.at)} will be removed from the history. The note on the lead's timeline stays.</p>
      </Modal>
    </div>
  )
}
