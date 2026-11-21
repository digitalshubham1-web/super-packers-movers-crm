import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Bot, Copy, ListChecks, Pause, Phone, Play, Plus, SkipForward, Trash2, Users, XCircle } from 'lucide-react'
import { useStore, useCurrentUser } from '@/lib/store'
import type { Call, CallCampaign, Lead } from '@/lib/types'
import { cn, fmtDate, nowIso, timeAgo, uid } from '@/lib/utils'
import { Avatar, Badge, Button, Card, DemoNotice, EmptyState, Field, Input, Modal, PageHeader, Select, StatCard, Tabs, Textarea, tableCls, tableWrap, tdCls, thCls, trCls } from '@/components/ui'
import { integrationsLink, telHref, useLocalState } from '@/components/calling/shared'

type ListOutcome = 'connected' | 'no_answer' | 'busy' | 'not_interested' | 'dnc'
interface Result { outcome: ListOutcome; userId?: string; at: string }
type Results = Record<string, Record<string, Result>>

const OUTCOMES: { id: ListOutcome; label: string; tone: 'good' | 'warn' | 'neutral' | 'bad'; call: Call['outcome'] }[] = [
  { id: 'connected', label: 'Connected', tone: 'good', call: 'connected' },
  { id: 'no_answer', label: 'No answer', tone: 'warn', call: 'no_answer' },
  { id: 'busy', label: 'Busy', tone: 'neutral', call: 'busy' },
  { id: 'not_interested', label: 'Not interested', tone: 'bad', call: 'connected' },
  { id: 'dnc', label: 'Do not call', tone: 'bad', call: 'connected' },
]
const statusTone: Record<CallCampaign['status'], 'good' | 'warn' | 'info' | 'bad'> = { active: 'good', paused: 'warn', completed: 'info', cancelled: 'bad' }
const statusLabel: Record<CallCampaign['status'], string> = { active: 'Active', paused: 'Paused', completed: 'Completed', cancelled: 'Cancelled' }

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="min-w-28">
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
      <p className="mt-1 text-xs text-muted">{done} of {total} done ({pct}%)</p>
    </div>
  )
}

export default function CallCampaigns() {
  const campaigns = useStore(s => s.callCampaigns)
  const users = useStore(s => s.users)
  const voiceAgents = useStore(s => s.voiceAgents)
  const [tab, setTab] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [results, setResults] = useLocalState<Results>('spm-call-campaign-results', {})

  const open = campaigns.find(c => c.id === openId)
  const shown = useMemo(() => campaigns.filter(c => (tab === 'all' ? true : tab === 'active' ? c.status === 'active' || c.status === 'paused' : c.status === tab)), [campaigns, tab])
  const count = (f: (c: CallCampaign) => boolean) => campaigns.filter(f).length

  const notice = (
    <DemoNotice>
      Call lists are worked by your team from their own phones: the Call button opens the phone's dialler and the caller records the outcome here. Nothing is dialled automatically.
      AI voice agent lists cannot place real calls in this version; their “Simulate run” fills in made-up outcomes for demonstration only. Connect Exotel, Plivo or Twilio under {integrationsLink} for real auto-dialling.
    </DemoNotice>
  )

  if (open) {
    return (
      <div>
        <PageHeader title={open.name} subtitle={`${open.kind === 'ai' ? 'AI voice agent list' : 'Team call list'} · created ${fmtDate(open.createdAt)}`} icon={ListChecks} actions={<Button icon={ArrowLeft} onClick={() => setOpenId(null)}>All call lists</Button>} />
        {notice}
        <Detail campaign={open} results={results} setResults={setResults} onOpen={setOpenId} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Call lists" subtitle="Lists of leads your team calls one by one" icon={ListChecks} actions={<Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>New call list</Button>} />
      {notice}
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'all', label: 'All', count: campaigns.length },
          { id: 'active', label: 'Active', count: count(c => c.status === 'active' || c.status === 'paused') },
          { id: 'completed', label: 'Completed', count: count(c => c.status === 'completed') },
          { id: 'cancelled', label: 'Cancelled', count: count(c => c.status === 'cancelled') },
        ]}
      />
      {shown.length === 0 ? (
        <Card><EmptyState icon={ListChecks} title={campaigns.length ? 'No call lists in this tab' : 'No call lists yet'} text="Pick a set of leads, choose who calls them, and work through the list one lead at a time." action={<Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>New call list</Button>} /></Card>
      ) : (
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead><tr>{['Call list', 'Type', 'Status', 'Progress', 'Callers', 'Created'].map(h => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>
              {shown.map(c => (
                <tr key={c.id} className={trCls + ' cursor-pointer'} onClick={() => setOpenId(c.id)}>
                  <td className={tdCls + ' whitespace-nowrap font-medium text-brand'}>{c.name}</td>
                  <td className={tdCls}><Badge tone={c.kind === 'ai' ? 'info' : 'neutral'}>{c.kind === 'ai' ? <Bot size={12} /> : <Users size={12} />}{c.kind === 'ai' ? 'AI voice agent' : 'Team calls'}</Badge></td>
                  <td className={tdCls}><Badge tone={statusTone[c.status]}>{statusLabel[c.status]}</Badge></td>
                  <td className={tdCls}><Progress done={c.doneLeadIds.length} total={c.leadIds.length} /></td>
                  <td className={tdCls}>
                    {c.kind === 'ai' ? (
                      <span className="whitespace-nowrap text-xs text-muted">{voiceAgents.find(v => v.id === c.voiceAgentId)?.name ?? 'No agent'}</span>
                    ) : (
                      <span className="flex -space-x-1.5">
                        {c.callerIds.map(id => users.find(u => u.id === id)).filter(u => !!u).map(u => <span key={u.id} title={u.name}><Avatar name={u.name} color={u.color} size={26} /></span>)}
                      </span>
                    )}
                  </td>
                  <td className={tdCls + ' whitespace-nowrap text-xs text-muted'}>{timeAgo(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <CreateWizard onClose={() => setCreating(false)} onCreated={id => { setCreating(false); setOpenId(id) }} />}
    </div>
  )
}

function CreateWizard({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const leads = useStore(s => s.leads)
  const stages = useStore(s => s.stages)
  const sources = useStore(s => s.sources)
  const users = useStore(s => s.users)
  const voiceAgents = useStore(s => s.voiceAgents)
  const me = useCurrentUser()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'team' | 'ai'>('team')
  const [stageId, setStageId] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [callerIds, setCallerIds] = useState<string[]>([me.id])
  const [agentId, setAgentId] = useState(voiceAgents[0]?.id ?? '')

  const matched = useMemo(() => leads.filter(l =>
    (!stageId || l.stageId === stageId) && (!sourceId || l.sourceId === sourceId) && (!ownerId || (ownerId === 'none' ? !l.ownerId : l.ownerId === ownerId))), [leads, stageId, sourceId, ownerId])
  const callable = useMemo(() => matched.filter(l => !l.doNotCall), [matched])
  const activeUsers = users.filter(u => u.active)
  const step2ok = kind === 'team' ? callerIds.length > 0 : !!agentId
  const steps = ['Details', 'Leads', kind === 'team' ? 'Callers' : 'Voice agent']

  const create = () => {
    const rec = useStore.getState().add('callCampaigns', {
      name: name.trim(), kind, callerIds: kind === 'team' ? callerIds : [], voiceAgentId: kind === 'ai' ? agentId : undefined,
      leadIds: callable.map(l => l.id), doneLeadIds: [], status: 'active', createdAt: nowIso(),
    })
    onCreated(rec.id)
  }

  return (
    <Modal open onClose={onClose} title="New call list" footer={<>
      {step > 0 ? <Button onClick={() => setStep(step - 1)}>Back</Button> : <Button onClick={onClose}>Cancel</Button>}
      {step < 2
        ? <Button variant="primary" disabled={step === 0 ? !name.trim() : callable.length === 0} onClick={() => setStep(step + 1)}>Next</Button>
        : <Button variant="primary" disabled={!step2ok} onClick={create}>Create list with {callable.length} leads</Button>}
    </>}>
      <ol className="mb-4 flex gap-2 text-xs">
        {steps.map((s, i) => <li key={s} className={cn('flex-1 rounded-md px-2 py-1.5 text-center font-medium', i === step ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-muted')}>{i + 1}. {s}</li>)}
      </ol>
      {step === 0 && (
        <div className="space-y-3">
          <Field label="List name"><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Quotation follow-ups — this week" autoFocus /></Field>
          <Field label="Who makes the calls?">
            <div className="grid gap-2 sm:grid-cols-2">
              {([['team', 'Team calls', 'Your team calls each lead from their own phone and records the outcome.', Users], ['ai', 'AI voice agent', 'Simulated in this version. Needs a telephony account to place real calls.', Bot]] as const).map(([id, label, text, Icon]) => (
                <button key={id} type="button" onClick={() => setKind(id)} className={cn('cursor-pointer rounded-lg border p-3 text-left', kind === id ? 'border-brand bg-brand-soft' : 'border-border hover:bg-surface-2')}>
                  <span className="flex items-center gap-2 text-sm font-medium"><Icon size={16} />{label}</span>
                  <span className="mt-1 block text-xs text-muted">{text}</span>
                </button>
              ))}
            </div>
          </Field>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Stage"><Select value={stageId} onChange={e => setStageId(e.target.value)}><option value="">Any stage</option>{stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
            <Field label="Source"><Select value={sourceId} onChange={e => setSourceId(e.target.value)}><option value="">Any source</option>{sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
            <Field label="Lead owner"><Select value={ownerId} onChange={e => setOwnerId(e.target.value)}><option value="">Anyone</option><option value="none">Unassigned</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
          </div>
          <div className="rounded-lg bg-surface-2 p-3 text-sm">
            <span className="text-lg font-semibold">{callable.length}</span> leads will be added
            {matched.length > callable.length && <span className="text-xs text-muted"> · {matched.length - callable.length} marked “Do not call” left out</span>}
            {callable.length > 0 && <p className="mt-1 truncate text-xs text-muted">{callable.slice(0, 4).map(l => l.name).join(', ')}{callable.length > 4 ? ` and ${callable.length - 4} more` : ''}</p>}
          </div>
        </div>
      )}
      {step === 2 && kind === 'team' && (
        <div className="space-y-2">
          <p className="text-xs text-muted">Leads are split evenly between the callers you pick.</p>
          {activeUsers.map(u => {
            const on = callerIds.includes(u.id)
            return (
              <label key={u.id} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border p-2.5', on ? 'border-brand bg-brand-soft' : 'border-border')}>
                <input type="checkbox" className="accent-[var(--c-brand)]" checked={on} onChange={() => setCallerIds(on ? callerIds.filter(x => x !== u.id) : [...callerIds, u.id])} />
                <Avatar name={u.name} color={u.color} />
                <span className="text-sm font-medium">{u.name}</span>
                <span className="ml-auto text-xs capitalize text-muted">{u.role}</span>
              </label>
            )
          })}
          {callerIds.length > 0 && <p className="text-xs text-muted">About {Math.ceil(callable.length / callerIds.length)} leads per caller.</p>}
        </div>
      )}
      {step === 2 && kind === 'ai' && (
        voiceAgents.length === 0 ? (
          <EmptyState icon={Bot} title="No voice agent yet" text="Create one first on the Voice agents page." action={<Link to="/voice-agents"><Button variant="primary">Open Voice agents</Button></Link>} />
        ) : (
          <Field label="Voice agent" hint="No real calls are placed. On the list page you can run a clearly labelled simulation.">
            <Select value={agentId} onChange={e => setAgentId(e.target.value)}>{voiceAgents.map(v => <option key={v.id} value={v.id}>{v.name} ({v.language}, {v.direction})</option>)}</Select>
          </Field>
        )
      )}
    </Modal>
  )
}

function Detail({ campaign: c, results, setResults, onOpen }: { campaign: CallCampaign; results: Results; setResults: (v: Results | ((p: Results) => Results)) => void; onOpen: (id: string | null) => void }) {
  const leads = useStore(s => s.leads)
  const users = useStore(s => s.users)
  const activities = useStore(s => s.activities)
  const voiceAgents = useStore(s => s.voiceAgents)
  const me = useCurrentUser()
  const [working, setWorking] = useState(false)
  const [skipped, setSkipped] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [called, setCalled] = useState(false)
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | 'simulate' | null>(null)

  const res = results[c.id] ?? {}
  const leadById = useMemo(() => new Map(leads.map(l => [l.id, l])), [leads])
  const callers = c.callerIds.map(id => users.find(u => u.id === id)).filter(u => !!u)
  const agent = voiceAgents.find(v => v.id === c.voiceAgentId)
  /** Even split: lead i goes to caller i mod n. */
  const assignee = (leadId: string) => (c.kind === 'team' && c.callerIds.length ? c.callerIds[c.leadIds.indexOf(leadId) % c.callerIds.length] : undefined)
  const done = new Set(c.doneLeadIds)
  const existing = c.leadIds.filter(id => leadById.has(id))
  const myQueue = existing.filter(id => !done.has(id) && assignee(id) === me.id)
  const ordered = [...myQueue.filter(id => !skipped.includes(id)), ...myQueue.filter(id => skipped.includes(id))]
  const current: Lead | undefined = ordered.length ? leadById.get(ordered[0]) : undefined
  const lastActivity = current ? activities.find(a => a.leadId === current.id) : undefined
  const isCaller = c.callerIds.includes(me.id)
  const runnable = c.status === 'active'
  const retryIds = existing.filter(id => { const o = res[id]?.outcome; return !o || o === 'no_answer' || o === 'busy' }).filter(id => !leadById.get(id)?.doNotCall)

  const { update, add, log, remove } = useStore.getState()

  const markDone = (lead: Lead, outcome: ListOutcome) => {
    const o = OUTCOMES.find(x => x.id === outcome)!
    const text = [`Call list “${c.name}”: ${o.label}`, note.trim()].filter(Boolean).join('. ')
    add('calls', { leadId: lead.id, name: lead.name, phone: lead.phone, userId: me.id, direction: 'outgoing', outcome: o.call, durationSec: 0, at: nowIso(), summary: text })
    log('call', text, lead.id)
    if (outcome === 'dnc') update('leads', lead.id, { doNotCall: true })
    const doneLeadIds = [...c.doneLeadIds, lead.id]
    const finished = existing.every(id => doneLeadIds.includes(id))
    update('callCampaigns', c.id, { doneLeadIds, status: finished ? 'completed' : c.status })
    setResults(r => ({ ...r, [c.id]: { ...(r[c.id] ?? {}), [lead.id]: { outcome, userId: me.id, at: nowIso() } } }))
    setNote(''); setCalled(false)
  }
  const skip = (lead: Lead) => { setSkipped(s => [...s.filter(x => x !== lead.id), lead.id]); setNote(''); setCalled(false) }

  const simulate = () => {
    const todo = existing.filter(id => !done.has(id))
    const now = nowIso()
    const pool: ListOutcome[] = ['connected', 'connected', 'connected', 'no_answer', 'no_answer', 'busy', 'not_interested']
    const newRes: Record<string, Result> = {}
    const newCalls: Call[] = []
    const acts = todo.map((id, i) => {
      const lead = leadById.get(id)!
      const outcome = pool[(i * 7 + lead.no) % pool.length]
      const o = OUTCOMES.find(x => x.id === outcome)!
      const text = `SIMULATED AI call (no real call was placed) — call list “${c.name}”: ${o.label}`
      newRes[id] = { outcome, at: now }
      newCalls.push({ id: uid(), leadId: id, name: lead.name, phone: lead.phone, byAi: true, direction: 'outgoing', outcome: o.call, durationSec: outcome === 'connected' ? 45 + ((lead.no * 13) % 120) : 0, at: now, summary: text })
      return { id: uid(), type: 'call' as const, text, leadId: id, at: now }
    })
    useStore.setState(s => ({
      calls: [...newCalls, ...s.calls], activities: [...acts, ...s.activities],
      callCampaigns: s.callCampaigns.map(x => (x.id === c.id ? { ...x, doneLeadIds: [...x.doneLeadIds, ...todo], status: 'completed' as const } : x)),
    }))
    setResults(r => ({ ...r, [c.id]: { ...(r[c.id] ?? {}), ...newRes } }))
    setConfirm(null)
  }

  const runAgain = () => {
    const rec = add('callCampaigns', { name: `${c.name} (retry)`, kind: c.kind, callerIds: c.callerIds, voiceAgentId: c.voiceAgentId, leadIds: retryIds, doneLeadIds: [], status: 'active', createdAt: nowIso() })
    onOpen(rec.id)
  }

  const outcomeCounts = OUTCOMES.map(o => ({ ...o, n: existing.filter(id => res[id]?.outcome === o.id).length }))
  const untracked = existing.filter(id => done.has(id) && !res[id]).length
  const doneCount = existing.filter(id => done.has(id)).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={statusTone[c.status]}>{statusLabel[c.status]}</Badge>
        <div className="mr-auto"><Progress done={doneCount} total={existing.length} /></div>
        {c.status === 'active' && <Button size="sm" icon={Pause} onClick={() => { update('callCampaigns', c.id, { status: 'paused' }); setWorking(false) }}>Pause</Button>}
        {c.status === 'paused' && <Button size="sm" icon={Play} onClick={() => update('callCampaigns', c.id, { status: 'active' })}>Resume</Button>}
        {(c.status === 'active' || c.status === 'paused') && <Button size="sm" icon={XCircle} onClick={() => setConfirm('cancel')}>Cancel list</Button>}
        <Button size="sm" icon={Copy} disabled={retryIds.length === 0} onClick={runAgain} title="New list with leads that were not reached">Run again ({retryIds.length} not connected)</Button>
        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setConfirm('delete')}>Delete</Button>
      </div>

      {c.kind === 'team' && !working && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{isCaller ? `You have ${myQueue.length} lead${myQueue.length === 1 ? '' : 's'} left to call` : 'You are not a caller on this list'}</p>
              <p className="text-xs text-muted">{isCaller ? 'Work the list shows one lead at a time: call, record the outcome, move to the next.' : 'Add yourself to take an even share of the leads.'}</p>
            </div>
            {isCaller
              ? <Button variant="primary" icon={Phone} disabled={!runnable || myQueue.length === 0} onClick={() => { setWorking(true); setSkipped([]) }}>{runnable ? 'Work the list' : `List is ${statusLabel[c.status].toLowerCase()}`}</Button>
              : <Button icon={Plus} disabled={c.status === 'cancelled' || c.status === 'completed'} onClick={() => update('callCampaigns', c.id, { callerIds: [...c.callerIds, me.id] })}>Add me as a caller</Button>}
          </div>
        </Card>
      )}

      {c.kind === 'team' && working && (
        <Card title={`Work the list — ${myQueue.length} left for you`} action={<Button size="sm" onClick={() => setWorking(false)}>Stop</Button>}>
          {!runnable ? (
            <EmptyState icon={Pause} title={`This list is ${statusLabel[c.status].toLowerCase()}`} text={c.status === 'completed' ? 'Every lead has been called.' : undefined} />
          ) : !current ? (
            <EmptyState icon={ListChecks} title="Your share is done" text="You have recorded an outcome for every lead assigned to you." />
          ) : (
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/leads/${current.id}`} className="text-lg font-semibold text-brand hover:underline">{current.name}</Link>
                  <p className="text-sm">{current.phone}{current.altPhone ? ` · alt ${current.altPhone}` : ''}</p>
                  <p className="mt-1 text-xs text-muted">Route: {[current.moveFrom, current.moveTo].filter(Boolean).join(' → ') || 'not recorded'}{current.moveDate ? ` · moving ${fmtDate(current.moveDate)}` : ''}{current.homeSize ? ` · ${current.homeSize}` : ''}</p>
                  <p className="mt-1 text-xs text-muted">Last activity: {lastActivity ? `${lastActivity.text} (${timeAgo(lastActivity.at)})` : 'none yet'}</p>
                </div>
                <a href={telHref(current.phone)} onClick={() => setCalled(true)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-brand-fg hover:opacity-90"><Phone size={16} />Call</a>
              </div>
              <Field label="Note (optional)"><Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Anything worth remembering from this call" /></Field>
              <div>
                <p className="mb-2 text-xs font-medium text-muted">{called ? 'How did the call go?' : 'After the call, record the outcome'}</p>
                <div className="flex flex-wrap gap-2">
                  {OUTCOMES.map(o => <Button key={o.id} variant={o.id === 'connected' ? 'primary' : o.id === 'dnc' ? 'danger' : 'secondary'} onClick={() => markDone(current, o.id)}>{o.label}</Button>)}
                  <Button variant="ghost" icon={SkipForward} disabled={ordered.length < 2} onClick={() => skip(current)}>Skip for now</Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {c.kind === 'ai' && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Voice agent: {agent?.name ?? 'none selected'}</p>
              <p className="text-xs text-muted">This agent cannot place real calls yet. A simulated run marks the remaining {existing.length - doneCount} leads as done with made-up outcomes and labels each record “SIMULATED”.</p>
            </div>
            <Button variant="primary" icon={Bot} disabled={!runnable || existing.length === doneCount} onClick={() => setConfirm('simulate')}>Simulate run (demo only)</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {outcomeCounts.map(o => <StatCard key={o.id} label={o.label} value={o.n} tone={o.tone === 'good' ? 'good' : o.tone === 'bad' ? 'bad' : o.tone === 'warn' ? 'warn' : 'default'} />)}
      </div>
      {untracked > 0 && <p className="text-xs text-muted">{untracked} lead(s) were marked done before outcome tracking was saved on this device.</p>}

      {c.kind === 'team' && (
        <Card title="Callers">
          {callers.length === 0 ? <EmptyState icon={Users} title="No callers on this list" /> : (
            <ul>
              {callers.map(u => {
                const mine = existing.filter(id => assignee(id) === u.id)
                const d = mine.filter(id => done.has(id)).length
                return (
                  <li key={u.id} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
                    <Avatar name={u.name} color={u.color} />
                    <span className="min-w-28 text-sm font-medium">{u.name}{u.id === me.id && <span className="text-xs text-muted"> (you)</span>}</span>
                    <div className="ml-auto w-48"><Progress done={d} total={mine.length} /></div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      )}

      <div className={tableWrap}>
        <table className={tableCls}>
          <thead><tr>{['Lead', 'Phone', 'Route', c.kind === 'team' ? 'Caller' : 'By', 'Result'].map(h => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody>
            {existing.map(id => {
              const l = leadById.get(id)!
              const r = res[id]
              const o = OUTCOMES.find(x => x.id === r?.outcome)
              const u = users.find(x => x.id === assignee(id))
              return (
                <tr key={id} className={trCls}>
                  <td className={tdCls + ' whitespace-nowrap'}><Link to={`/leads/${id}`} className="font-medium text-brand hover:underline">{l.name}</Link></td>
                  <td className={tdCls + ' whitespace-nowrap'}>{l.phone}</td>
                  <td className={tdCls + ' whitespace-nowrap text-xs text-muted'}>{[l.moveFrom, l.moveTo].filter(Boolean).join(' → ') || '—'}</td>
                  <td className={tdCls + ' whitespace-nowrap text-xs'}>{c.kind === 'ai' ? 'AI agent (simulated)' : u?.name ?? '—'}</td>
                  <td className={tdCls}>{o ? <Badge tone={o.tone}>{o.label}</Badge> : done.has(id) ? <Badge>Done</Badge> : <Badge tone="info">Pending</Badge>}</td>
                </tr>
              )
            })}
            {existing.length === 0 && <tr><td className={tdCls + ' text-center text-muted'} colSpan={5}>This list has no leads.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={confirm === 'cancel'} onClose={() => setConfirm(null)} title="Cancel this call list?" footer={<><Button onClick={() => setConfirm(null)}>Keep list</Button><Button variant="danger" onClick={() => { update('callCampaigns', c.id, { status: 'cancelled' }); setWorking(false); setConfirm(null) }}>Cancel list</Button></>}>
        <p className="text-sm text-muted">Callers will no longer be able to work this list. Outcomes already recorded are kept.</p>
      </Modal>
      <Modal open={confirm === 'delete'} onClose={() => setConfirm(null)} title="Delete this call list?" footer={<><Button onClick={() => setConfirm(null)}>Keep</Button><Button variant="danger" onClick={() => { remove('callCampaigns', c.id); setResults(r => { const n = { ...r }; delete n[c.id]; return n }); onOpen(null) }}>Delete</Button></>}>
        <p className="text-sm text-muted">The list and its report are removed. Call records and lead timelines stay.</p>
      </Modal>
      <Modal open={confirm === 'simulate'} onClose={() => setConfirm(null)} title="Run a simulated AI calling round?" footer={<><Button onClick={() => setConfirm(null)}>Not now</Button><Button variant="primary" onClick={simulate}>Simulate {existing.length - doneCount} calls</Button></>}>
        <p className="text-sm text-muted">No customer will be called. {existing.length - doneCount} call records with invented outcomes are added to Call history and each lead's timeline, all marked “SIMULATED AI call”. Use this only to see how the report looks.</p>
      </Modal>
    </div>
  )
}
