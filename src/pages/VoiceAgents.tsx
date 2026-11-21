import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, CalendarClock, Hash, MessageSquare, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { VoiceAgent } from '@/lib/types'
import { cn, friendlyDay } from '@/lib/utils'
import { Badge, Button, Card, DemoNotice, Drawer, EmptyState, Field, Input, Modal, PageHeader, Select, Tabs, Textarea, Toggle, tableCls, tableWrap, tdCls, thCls, trCls } from '@/components/ui'
import { NumbersPanel, integrationsLink, useLocalState } from '@/components/calling/shared'

type Tab = 'agents' | 'numbers' | 'scheduled'
const VOICES = ['Asha (female, warm)', 'Meera (female, crisp and professional)', 'Kavya (female, young and friendly)', 'Rohan (male, calm)', 'Vikram (male, confident)', 'Dev (male, energetic)']
const LANGUAGES = ['Hinglish', 'Hindi', 'English', 'Punjabi', 'Marathi', 'Gujarati', 'Tamil', 'Telugu', 'Bengali']
interface AfterCall { saveSummary: boolean; createTask: boolean; moveStage: boolean; stageId: string }
type Extras = Record<string, AfterCall>
const defaultAfter: AfterCall = { saveSummary: true, createTask: false, moveStage: false, stageId: '' }
type Form = Omit<VoiceAgent, 'id'>
const blank: Form = {
  name: '', direction: 'outbound', voice: VOICES[0], language: 'Hinglish', greeting: 'Namaste, main Super Packers and Movers se bol rahi hoon.',
  prompt: '', hoursStart: '09:30', hoursEnd: '19:00', dailyLimit: 100, maxCallSec: 240, recordCalls: true, active: false, number: '',
}

export default function VoiceAgents() {
  const agents = useStore(s => s.voiceAgents)
  const stages = useStore(s => s.stages)
  const [tab, setTab] = useState<Tab>('agents')
  const [extras, setExtras] = useLocalState<Extras>('spm-voice-agent-extras', {})
  const [editing, setEditing] = useState<VoiceAgent | 'new' | null>(null)
  const [form, setForm] = useState<Form>(blank)
  const [after, setAfter] = useState<AfterCall>(defaultAfter)
  const [testing, setTesting] = useState<VoiceAgent | null>(null)
  const [del, setDel] = useState<VoiceAgent | null>(null)
  const { add, update, remove } = useStore.getState()

  const openNew = () => { setForm(blank); setAfter(defaultAfter); setEditing('new') }
  const openEdit = (a: VoiceAgent) => {
    const { id: _id, ...rest } = a
    void _id
    setForm({ ...blank, ...rest, number: a.number ?? '' }); setAfter(extras[a.id] ?? defaultAfter); setEditing(a)
  }
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }))
  const save = () => {
    const data: Form = { ...form, name: form.name.trim(), number: form.number?.trim() || undefined, dailyLimit: Math.max(1, form.dailyLimit || 1), maxCallSec: Math.max(30, form.maxCallSec || 30) }
    let id: string
    if (editing === 'new') id = add('voiceAgents', data).id
    else if (editing) { id = editing.id; update('voiceAgents', id, data) } else return
    setExtras(e => ({ ...e, [id]: after }))
    setEditing(null)
  }

  return (
    <div>
      <PageHeader title="Voice agents" subtitle="AI callers for new enquiries and follow-ups" icon={Bot} actions={tab === 'agents' ? <Button variant="primary" icon={Plus} onClick={openNew}>New voice agent</Button> : undefined} />
      <DemoNotice>
        Voice AI is not connected in this version. You can set up agents and save their settings, but no agent will speak to a customer, place or answer a call, or record anything.
        “Test” uses fixed rule-based sample lines, not a real AI model, and “Scheduled calls” is only a preview. Real calling needs a telephony account (Exotel, Plivo or Twilio) connected under {integrationsLink} and a voice AI service.
      </DemoNotice>
      <Tabs<Tab> className="mb-4" value={tab} onChange={setTab} tabs={[{ id: 'agents', label: 'Agents', icon: Bot, count: agents.length }, { id: 'numbers', label: 'Numbers', icon: Hash }, { id: 'scheduled', label: 'Scheduled calls', icon: CalendarClock }]} />

      {tab === 'agents' && (agents.length === 0 ? (
        <Card><EmptyState icon={Bot} title="No voice agents yet" text="Describe how the agent should greet and what it should ask. You can test the script right away." action={<Button variant="primary" icon={Plus} onClick={openNew}>New voice agent</Button>} /></Card>
      ) : (
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead><tr>{['Agent', 'Direction', 'Voice', 'Language', 'Calling hours', 'Number', 'Active', ''].map(h => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>
              {agents.map(a => (
                <tr key={a.id} className={trCls}>
                  <td className={tdCls}>
                    <button type="button" onClick={() => openEdit(a)} className="cursor-pointer whitespace-nowrap font-medium text-brand hover:underline">{a.name}</button>
                    <p className="max-w-56 truncate text-xs text-muted">{a.greeting}</p>
                  </td>
                  <td className={tdCls}><Badge tone={a.direction === 'outbound' ? 'brand' : 'info'}>{a.direction === 'outbound' ? 'Outbound' : 'Inbound'}</Badge></td>
                  <td className={tdCls + ' whitespace-nowrap'}>{a.voice}</td>
                  <td className={tdCls}>{a.language}</td>
                  <td className={tdCls + ' whitespace-nowrap text-xs text-muted'}>{a.hoursStart}–{a.hoursEnd} · max {a.dailyLimit}/day</td>
                  <td className={tdCls + ' whitespace-nowrap text-xs'}>{a.number || <span className="text-muted">Not set</span>}</td>
                  <td className={tdCls}><Toggle checked={a.active} onChange={v => update('voiceAgents', a.id, { active: v })} label={`${a.name} active`} /></td>
                  <td className={tdCls}>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" icon={MessageSquare} onClick={() => setTesting(a)}>Test</Button>
                      <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEdit(a)} aria-label="Edit" />
                      <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDel(a)} aria-label="Delete" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {tab === 'numbers' && <NumbersPanel />}
      {tab === 'scheduled' && <Scheduled />}

      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'New voice agent' : 'Edit voice agent'} width={520} footer={<><Button onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" disabled={!form.name.trim() || !form.prompt.trim()} onClick={save}>Save agent</Button></>}>
        <div className="space-y-3">
          <Field label="Agent name"><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="New lead caller" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Direction"><Select value={form.direction} onChange={e => set('direction', e.target.value as VoiceAgent['direction'])}><option value="outbound">Outbound (calls leads)</option><option value="inbound">Inbound (answers calls)</option></Select></Field>
            <Field label="Language"><Select value={form.language} onChange={e => set('language', e.target.value)}>{[...new Set([...LANGUAGES, form.language])].map(l => <option key={l}>{l}</option>)}</Select></Field>
          </div>
          <Field label="Voice"><Select value={form.voice} onChange={e => set('voice', e.target.value)}>{[...new Set([...VOICES, form.voice])].map(v => <option key={v}>{v}</option>)}</Select></Field>
          <Field label="Greeting" hint="The first line the agent says."><Input value={form.greeting} onChange={e => set('greeting', e.target.value)} /></Field>
          <Field label="Instructions (prompt)" hint="What to ask, what to tell, and when to hand over to your team. One instruction per sentence works best.">
            <Textarea className="min-h-32" value={form.prompt} onChange={e => set('prompt', e.target.value)} placeholder="Confirm pickup and drop cities. Ask the shifting date. Ask the home size. Say a team member will share the quotation." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Calling hours start"><Input type="time" value={form.hoursStart} onChange={e => set('hoursStart', e.target.value)} /></Field>
            <Field label="Calling hours end"><Input type="time" value={form.hoursEnd} onChange={e => set('hoursEnd', e.target.value)} /></Field>
            <Field label="Daily call limit"><Input type="number" min={1} value={form.dailyLimit} onChange={e => set('dailyLimit', parseInt(e.target.value) || 0)} /></Field>
            <Field label="Max call length (seconds)"><Input type="number" min={30} step={30} value={form.maxCallSec} onChange={e => set('maxCallSec', parseInt(e.target.value) || 0)} /></Field>
          </div>
          <Field label="Caller ID number (optional)" hint="Use a number from your telephony account once it is connected."><Input value={form.number ?? ''} onChange={e => set('number', e.target.value)} placeholder="+91 …" inputMode="tel" /></Field>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <span className="text-sm">Record calls<span className="block text-xs text-muted">Customers must be told the call is recorded.</span></span>
            <Toggle checked={form.recordCalls} onChange={v => set('recordCalls', v)} label="Record calls" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <span className="text-sm">Active<span className="block text-xs text-muted">Has no effect until telephony is connected.</span></span>
            <Toggle checked={form.active} onChange={v => set('active', v)} label="Active" />
          </div>
          <fieldset className="rounded-lg border border-border p-3">
            <legend className="px-1 text-xs font-medium text-muted">After each call</legend>
            {([['saveSummary', 'Save the call summary as a note on the lead'], ['createTask', 'Create a follow-up task for the lead owner'], ['moveStage', 'Move the lead to a stage when the call connects']] as const).map(([k, label]) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                <input type="checkbox" className="accent-[var(--c-brand)]" checked={after[k]} onChange={e => setAfter(a => ({ ...a, [k]: e.target.checked }))} />{label}
              </label>
            ))}
            {after.moveStage && <Select className="mt-2" value={after.stageId} onChange={e => setAfter(a => ({ ...a, stageId: e.target.value }))}><option value="">Choose a stage</option>{stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</Select>}
          </fieldset>
        </div>
      </Drawer>

      {testing && <TestChat agent={testing} onClose={() => setTesting(null)} />}
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete voice agent?" footer={<><Button onClick={() => setDel(null)}>Keep</Button><Button variant="danger" onClick={() => { if (del) { remove('voiceAgents', del.id); setExtras(e => { const n = { ...e }; delete n[del.id]; return n }) } setDel(null) }}>Delete</Button></>}>
        <p className="text-sm text-muted">“{del?.name}” and its settings will be removed. Call lists that use it will show “No agent”.</p>
      </Modal>
    </div>
  )
}

interface Line { from: 'agent' | 'customer'; text: string }

/** Rule-based stand-in for the agent: keyword replies first, then the next instruction sentence from the prompt. */
function reply(agent: VoiceAgent, text: string, step: number): { text: string; step: number } {
  const t = text.toLowerCase()
  const points = agent.prompt.split(/[.\n,]| then | and then /i).map(s => s.trim()).filter(s => s.length > 8)
  if (/\b(bye|not interested|nahi chahiye|no thanks|don't call|mat karo)\b/.test(t)) return { text: 'Theek hai, no problem. Thank you for your time. Have a good day!', step }
  if (/(price|rate|cost|charge|kitna|quotation|quote|paisa|₹)/.test(t)) return { text: 'The exact price depends on the item list, floors and distance. Our team member will share a written quotation after noting your details.', step }
  if (/(who|kaun|which company|kahan se)/.test(t)) return { text: agent.greeting, step }
  if (/(human|person|manager|baat karwa|someone else)/.test(t)) return { text: 'Sure, I will ask a team member to call you back shortly.', step }
  if (step < points.length) return { text: `Noted. Next — ${points[step].replace(/^[a-z]/, c => c.toUpperCase())}?`, step: step + 1 }
  return { text: 'Thank you, I have noted everything. A team member will contact you with the next steps.', step }
}

function TestChat({ agent, onClose }: { agent: VoiceAgent; onClose: () => void }) {
  const [lines, setLines] = useState<Line[]>([{ from: 'agent', text: agent.greeting || 'Hello.' }])
  const [step, setStep] = useState(0)
  const [text, setText] = useState('')
  const send = () => {
    const msg = text.trim()
    if (!msg) return
    const r = reply(agent, msg, step)
    setLines(l => [...l, { from: 'customer', text: msg }, { from: 'agent', text: r.text }])
    setStep(r.step); setText('')
  }
  return (
    <Modal open onClose={onClose} title={`Test — ${agent.name}`} footer={<Button onClick={() => { setLines([{ from: 'agent', text: agent.greeting || 'Hello.' }]); setStep(0) }}>Restart</Button>}>
      <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
        Simulated text preview. Replies are picked by simple rules from this agent's greeting and instructions — not by an AI model, and there is no voice. You type as the customer.
      </p>
      <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg bg-surface-2 p-3">
        {lines.map((l, i) => (
          <div key={i} className={cn('flex', l.from === 'customer' && 'justify-end')}>
            <div className={cn('max-w-[85%] rounded-lg px-3 py-2 text-sm', l.from === 'customer' ? 'bg-brand text-brand-fg' : 'border border-border bg-surface')}>
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide opacity-70">{l.from === 'customer' ? 'You (as customer)' : `${agent.voice.split(' ')[0]} · simulated`}</span>
              {l.text}
            </div>
          </div>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); send() }}>
        <Input value={text} onChange={e => setText(e.target.value)} placeholder="Reply as the customer, e.g. “How much will it cost?”" autoFocus />
        <Button type="submit" variant="primary" icon={Send} disabled={!text.trim()}>Send</Button>
      </form>
    </Modal>
  )
}

function Scheduled() {
  const leads = useStore(s => s.leads)
  const agents = useStore(s => s.voiceAgents)
  const [skip, setSkip] = useLocalState<string[]>('spm-voice-skip', [])
  const agent = agents.find(a => a.active && a.direction === 'outbound')
  const rows = useMemo(() => {
    const now = Date.now()
    return leads.filter(l => l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() > now && !l.doNotCall).sort((a, b) => (a.nextFollowUpAt ?? '').localeCompare(b.nextFollowUpAt ?? ''))
  }, [leads])
  const inHours = (iso: string) => {
    if (!agent) return false
    const d = new Date(iso)
    const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    return hm >= agent.hoursStart && hm <= agent.hoursEnd
  }
  const planned = rows.filter(l => !skip.includes(l.id)).length
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm font-medium">{agent ? `“${agent.name}” would call ${planned} lead${planned === 1 ? '' : 's'}` : 'No active outbound agent'}</p>
        <p className="mt-1 text-sm text-muted">
          {agent
            ? `Preview only — these calls will not be placed until telephony is connected. Leads are taken from their next follow-up time; “Do not call” leads are left out. Calling hours ${agent.hoursStart}–${agent.hoursEnd}, up to ${agent.dailyLimit} calls a day.`
            : 'Switch on an outbound agent in the Agents tab to see which leads it would call. The list below shows every lead with an upcoming follow-up.'}
        </p>
      </Card>
      {rows.length === 0 ? (
        <Card><EmptyState icon={CalendarClock} title="No upcoming follow-ups" text="Leads with a next follow-up time in the future appear here." action={<Link to="/leads"><Button variant="primary">Open leads</Button></Link>} /></Card>
      ) : (
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead><tr>{['Lead', 'Phone', 'Follow-up time', 'Agent', 'Status', 'Skip'].map(h => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(l => {
                const skipped = skip.includes(l.id)
                const at = l.nextFollowUpAt as string
                return (
                  <tr key={l.id} className={cn(trCls, skipped && 'opacity-60')}>
                    <td className={tdCls + ' whitespace-nowrap'}><Link to={`/leads/${l.id}`} className="font-medium text-brand hover:underline">{l.name}</Link></td>
                    <td className={tdCls + ' whitespace-nowrap'}>{l.phone}</td>
                    <td className={tdCls + ' whitespace-nowrap'}>{friendlyDay(at)}</td>
                    <td className={tdCls + ' whitespace-nowrap text-xs'}>{agent?.name ?? <span className="text-muted">None active</span>}</td>
                    <td className={tdCls}>
                      {skipped ? <Badge>Skipped</Badge> : !agent ? <Badge tone="warn">No agent</Badge> : inHours(at) ? <Badge tone="info">Would call (preview)</Badge> : <Badge tone="warn">Outside calling hours</Badge>}
                    </td>
                    <td className={tdCls}><Toggle checked={skipped} onChange={v => setSkip(s => (v ? [...s, l.id] : s.filter(x => x !== l.id)))} label={`Skip ${l.name}`} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
