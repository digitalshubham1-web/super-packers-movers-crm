import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Check, FileText, MessageSquare, Plus, RotateCcw, Save, Send, Trash2, XCircle } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn, uid } from '@/lib/utils'
import type { AiAgent } from '@/lib/types'
import { Badge, Button, Card, DemoNotice, EmptyState, Field, Input, PageHeader, Select, StatCard, Textarea, Toggle } from '@/components/ui'

const DEFAULT_TOOLS: Record<string, boolean> = {
  read_lead: true, update_lead: true, update_stage: false, add_note: true, create_lead: true,
  create_task: true, set_reminder: false, list_files: true, send_file: true, check_calendar: false, schedule_meeting: false,
}
const TOOL_INFO: Record<string, { group: string; title: string; text: string }> = {
  read_lead: { group: 'Leads', title: 'Read lead details', text: 'Look up the customer’s name, move route, date and stage before replying.' },
  update_lead: { group: 'Leads', title: 'Update lead details', text: 'Save the pickup city, drop city, date and home size the customer shares.' },
  update_stage: { group: 'Leads', title: 'Move lead to another stage', text: 'Change the pipeline stage, for example to “Details collected”.' },
  add_note: { group: 'Leads', title: 'Add a note', text: 'Write a short note on the lead timeline about what was discussed.' },
  create_lead: { group: 'Leads', title: 'Create a new lead', text: 'Add a lead when an unknown number sends an enquiry.' },
  create_task: { group: 'Follow-ups', title: 'Create a task', text: 'Give the team a follow-up task, such as “Send quotation”.' },
  set_reminder: { group: 'Follow-ups', title: 'Set a reminder', text: 'Set the next follow-up date on the lead.' },
  list_files: { group: 'Files', title: 'See the file list', text: 'Know which files below are available to send.' },
  send_file: { group: 'Files', title: 'Send a file', text: 'Send a file from the list below when the customer asks for it.' },
  check_calendar: { group: 'Calendar', title: 'Check the calendar', text: 'See free slots before offering a survey time.' },
  schedule_meeting: { group: 'Calendar', title: 'Book a survey or meeting', text: 'Add a calendar event for a home survey.' },
}
const GROUPS = ['Leads', 'Follow-ups', 'Files', 'Calendar', 'Other']
const humanise = (k: string) => k.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())

/** Rule-based stand-in for the AI model. Reads the instructions for the name, the details to collect and the price rule. */
function simulatedReply(agent: AiAgent, customerTexts: string[]): string {
  const ins = agent.instructions.toLowerCase()
  const last = (customerTexts[customerTexts.length - 1] ?? '').toLowerCase()
  const all = customerTexts.join(' \n ').toLowerCase()
  const persona = /you are ([a-z]+)/i.exec(agent.instructions)?.[1] ?? agent.name.split(/[\s-]/)[0]
  const parts: string[] = []
  if (customerTexts.length === 1) parts.push(`Namaste! I am ${persona} from Super Packers and Movers.`)

  if (/human|agent|person|manager|call me|talk to/.test(last) && /human|hand over|handover|team/.test(ins)) {
    parts.push('Sure, I am handing this chat over to our team. Someone will reply here shortly.')
    return parts.join(' ')
  }
  if (/price|rate|cost|charge|quot|kitna|estimate|how much/.test(last)) {
    parts.push(/never quote|not quote|no price|don.t quote/.test(ins)
      ? 'I am not able to share a price on chat. Our team prepares a written quotation once the move details are complete.'
      : 'Our team will share a written quotation once the move details are complete.')
  }
  const cities = /\b(?:from\s+)?[a-z]+(?:\s[a-z]+)?\s+to\s+[a-z]+/.test(all)
  const wants = (word: RegExp) => word.test(ins)
  const missing: string[] = []
  if (wants(/pickup|drop|city/) && !cities) missing.push('your pickup city and drop city')
  if (wants(/date/) && !/\d|tomorrow|today|next|week|month|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/.test(all)) missing.push('your shifting date')
  if (wants(/home size|bhk|size/) && !/bhk|rk\b|villa|office|bedroom|studio/.test(all)) missing.push('the home size (for example 2 BHK)')
  if (wants(/floor|lift/) && !/floor|lift|ground/.test(all)) missing.push('the floor number and whether a lift is available')
  if (missing.length) parts.push(`Could you please share ${missing[0]}?`)
  else parts.push('Thank you, I have noted all the details. Our team will check them and send your quotation shortly.')
  return parts.join(' ')
}

export default function AiAgentPage() {
  const agents = useStore(s => s.aiAgents)
  const users = useStore(s => s.users)
  const agent = agents[0]

  const create = () => {
    const s = useStore.getState()
    if (s.aiAgents.length) return
    s.add('aiAgents', {
      name: 'WhatsApp assistant', channel: 'whatsapp', actAsUserId: s.currentUserId, contextMessages: 20, replyDelaySec: 5, tools: DEFAULT_TOOLS, files: [],
      active: false, repliesSent: 0, failed: 0,
      instructions: 'You are the moving assistant of Super Packers and Movers. Greet the customer, collect pickup city, drop city, shifting date, home size, floor and lift details. Never quote a price; the team sends the quotation. Hand over to a human when the customer asks for one.',
    })
  }
  useEffect(() => { if (!agent) create() }, [agent])

  if (!agent) {
    return (
      <div>
        <PageHeader title="AI agent" icon={Bot} />
        <Card><EmptyState icon={Bot} title="No AI agent yet" text="Create an agent that answers WhatsApp enquiries." action={<Button variant="primary" icon={Plus} onClick={create}>Create AI agent</Button>} /></Card>
      </div>
    )
  }
  return <Editor key={agent.id} agent={agent} users={users} />
}

function Editor({ agent, users }: { agent: AiAgent; users: { id: string; name: string; active: boolean }[] }) {
  const [draft, setDraft] = useState<AiAgent>(agent)
  const [savedAt, setSavedAt] = useState(0)
  const [fileName, setFileName] = useState('')
  const set = (patch: Partial<AiAgent>) => setDraft(d => ({ ...d, ...patch }))

  const dirty = useMemo(() => {
    const pick = (a: AiAgent) => JSON.stringify([a.name, a.instructions, a.actAsUserId, a.contextMessages, a.replyDelaySec, a.tools, a.files])
    return pick(draft) !== pick(agent)
  }, [draft, agent])

  useEffect(() => {
    if (!savedAt) return
    const t = setTimeout(() => setSavedAt(0), 2500)
    return () => clearTimeout(t)
  }, [savedAt])

  const save = () => {
    const clean = {
      name: draft.name.trim() || agent.name, instructions: draft.instructions, actAsUserId: draft.actAsUserId || undefined,
      contextMessages: Math.min(50, Math.max(1, Math.round(draft.contextMessages) || 1)), replyDelaySec: Math.min(300, Math.max(0, Math.round(draft.replyDelaySec) || 0)),
      tools: draft.tools, files: draft.files,
    }
    useStore.getState().update('aiAgents', agent.id, clean)
    setDraft(d => ({ ...d, ...clean }))
    setSavedAt(Date.now())
  }
  const addFile = () => {
    const n = fileName.trim()
    if (!n) return
    set({ files: [...draft.files, { id: uid(), name: n, sent: 0 }] })
    setFileName('')
  }

  const toolKeys = Object.keys(draft.tools)
  const grouped = GROUPS.map(g => ({ g, keys: toolKeys.filter(k => (TOOL_INFO[k]?.group ?? 'Other') === g) })).filter(x => x.keys.length)

  return (
    <div>
      <PageHeader
        title={agent.name}
        subtitle="Answers WhatsApp enquiries using your instructions"
        icon={Bot}
        actions={
          <>
            <span className="flex items-center gap-2 text-xs text-muted">
              <Toggle checked={agent.active} onChange={v => useStore.getState().update('aiAgents', agent.id, { active: v })} label="Agent active" />
              {agent.active ? <Badge tone="good">Active</Badge> : <Badge>Paused</Badge>}
            </span>
            {savedAt > 0 && <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><Check size={14} /> Saved</span>}
            {dirty && savedAt === 0 && <span className="text-xs text-amber-600">Unsaved changes</span>}
            <Button variant="primary" icon={Save} disabled={!dirty} onClick={save}>Save changes</Button>
          </>
        }
      />
      <DemoNotice>
        No AI model is connected in this version. The agent’s settings are saved, but it does not reply to customers on its own. To get real replies, connect an AI model key and a WhatsApp Business API number in Integrations. The test chat below uses simple rules.
      </DemoNotice>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Replies sent" value={agent.repliesSent.toLocaleString('en-IN')} icon={MessageSquare} />
        <StatCard label="Failed" value={agent.failed.toLocaleString('en-IN')} icon={XCircle} tone={agent.failed ? 'bad' : 'default'} />
        <StatCard label="Tools switched on" value={`${Object.values(draft.tools).filter(Boolean).length}/${toolKeys.length}`} />
        <StatCard label="Files" value={draft.files.length} icon={FileText} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card title="Instructions">
            <div className="space-y-3 p-4">
              <Field label="Agent name"><Input value={draft.name} onChange={e => set({ name: e.target.value })} /></Field>
              <Field label="What should the agent do and say?">
                <Textarea rows={9} value={draft.instructions} onChange={e => set({ instructions: e.target.value })} placeholder="Describe who the agent is, what to collect and what it must never do." />
              </Field>
              <p className={cn('text-right text-xs', draft.instructions.length > 4000 ? 'text-rose-600' : 'text-muted')}>{draft.instructions.length.toLocaleString('en-IN')} / 4,000 characters</p>
            </div>
          </Card>

          <Card title="Replies">
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              <Field label="Acts as user" hint="Replies and notes are recorded under this person.">
                <Select value={draft.actAsUserId ?? ''} onChange={e => set({ actAsUserId: e.target.value || undefined })}>
                  <option value="">No one</option>
                  {users.filter(u => u.active || u.id === draft.actAsUserId).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
              </Field>
              <Field label="Messages it reads" hint="Past messages used as context (1–50).">
                <Input type="number" min={1} max={50} value={draft.contextMessages} onChange={e => set({ contextMessages: Number(e.target.value) })} />
              </Field>
              <Field label="Wait before replying (seconds)" hint="Lets the customer finish typing.">
                <Input type="number" min={0} max={300} value={draft.replyDelaySec} onChange={e => set({ replyDelaySec: Number(e.target.value) })} />
              </Field>
            </div>
          </Card>

          <Card title="Tools">
            <div className="space-y-4 p-4">
              {grouped.map(({ g, keys }) => (
                <div key={g}>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{g}</h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {keys.map(k => (
                      <div key={k} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{TOOL_INFO[k]?.title ?? humanise(k)}</p>
                          <p className="text-xs text-muted">{TOOL_INFO[k]?.text ?? 'Lets the agent use this action.'}</p>
                        </div>
                        <Toggle checked={draft.tools[k]} onChange={v => set({ tools: { ...draft.tools, [k]: v } })} label={TOOL_INFO[k]?.title ?? humanise(k)} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Files">
            <div className="space-y-3 p-4">
              <p className="text-xs text-muted">Files the agent may send to customers. Only the file name is stored in this version; nothing is uploaded.</p>
              {draft.files.length === 0 && <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted">No files yet. Add a name below, for example “Rate card.pdf”.</p>}
              {draft.files.map(f => (
                <div key={f.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                  <FileText size={16} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                  <Badge>Sent {f.sent} times</Badge>
                  <button onClick={() => set({ files: draft.files.filter(x => x.id !== f.id) })} className="cursor-pointer rounded p-1 text-muted hover:bg-surface-2 hover:text-rose-600" aria-label={`Remove ${f.name}`}><Trash2 size={15} /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input value={fileName} onChange={e => setFileName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFile() } }} placeholder="File name, e.g. Packing checklist.pdf" />
                <Button icon={Plus} disabled={!fileName.trim()} onClick={addFile}>Add file</Button>
              </div>
            </div>
          </Card>
        </div>

        <TestChat agent={draft} />
      </div>
    </div>
  )
}

function TestChat({ agent }: { agent: AiAgent }) {
  const [msgs, setMsgs] = useState<{ id: string; from: 'customer' | 'bot'; text: string }[]>([])
  const [text, setText] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight }, [msgs.length])

  const send = () => {
    const t = text.trim()
    if (!t) return
    const customer = [...msgs.filter(m => m.from === 'customer').map(m => m.text), t]
    setMsgs(m => [...m, { id: uid(), from: 'customer', text: t }, { id: uid(), from: 'bot', text: simulatedReply(agent, customer) }])
    setText('')
  }
  return (
    <Card
      className="flex h-[560px] flex-col self-start xl:sticky xl:top-0"
      title={<span className="flex items-center gap-2">Test chat <Badge tone="warn">Simulated</Badge></span>}
      action={<Button size="sm" variant="ghost" icon={RotateCcw} disabled={!msgs.length} onClick={() => setMsgs([])}>Restart</Button>}
    >
      <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-bg p-3">
        {msgs.length === 0 && (
          <p className="px-4 py-8 text-center text-xs text-muted">Type as a customer, for example “Hi, I need to shift from Delhi to Pune”. Replies here come from simple rules based on your instructions, not from an AI model.</p>
        )}
        {msgs.map(m => (
          <div key={m.id} className={cn('flex', m.from === 'customer' ? 'justify-start' : 'justify-end')}>
            <div className={cn('max-w-[85%] rounded-xl px-3 py-1.5 text-sm', m.from === 'customer' ? 'rounded-tl-none border border-border bg-surface' : 'rounded-tr-none border border-brand/30 bg-brand-soft')}>
              {m.from === 'bot' && <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">Simulated reply</div>}
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <Input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } }} placeholder="Type as a customer…" aria-label="Test message" />
          <Button variant="primary" icon={Send} disabled={!text.trim()} onClick={send}>Send</Button>
        </div>
        <p className="mt-2 text-[11px] text-muted">Real replies need an AI model key connected. Test messages are not saved or sent.</p>
      </div>
    </Card>
  )
}
