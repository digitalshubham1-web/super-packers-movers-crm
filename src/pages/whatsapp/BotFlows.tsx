import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Bot, ChevronDown, ChevronUp, CircleHelp, Clock, Copy, FileText, GitBranch, Globe, Hand, Image, LayoutGrid, List, MapPin, MessageSquare,
  MousePointerClick, Pencil, Play, Plus, RotateCcw, Save, Sparkles, Tag, Trash2, UserCheck, UserPlus, Variable, Workflow, XOctagon, type LucideIcon,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn, nowIso, timeAgo, uid } from '@/lib/utils'
import type { BotFlow, FlowStep } from '@/lib/types'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Tabs, Textarea, Toggle } from '@/components/ui'

const TRIGGERS: { id: string; hint: string }[] = [
  { id: 'Keyword Match', hint: 'Starts when a message contains one of your keywords.' },
  { id: 'First Message', hint: 'Starts when a number messages you for the first time.' },
  { id: 'Default Fallback', hint: 'Starts when no other flow matches the message.' },
  { id: 'Button Reply', hint: 'Starts when the customer taps a button on one of your messages.' },
  { id: 'Template Not Replied', hint: 'Starts when a template message gets no reply.' },
  { id: 'AI Agent Not Replied', hint: 'Starts when the AI agent could not answer.' },
  { id: 'New Lead', hint: 'Starts when a new lead is added to the CRM.' },
  { id: 'Scheduled', hint: 'Starts at a set time for the chosen customers.' },
]
const normTrigger = (t: string) => TRIGGERS.find(x => x.id.toLowerCase() === t.toLowerCase())?.id ?? t

interface KindInfo {
  icon: LucideIcon; about: string
  text?: { label: string; placeholder?: string; multiline?: boolean; pick?: 'template' | 'user' }
  options?: { label: string; hint: string }
}
const KINDS: Record<string, KindInfo> = {
  'Text Message': { icon: MessageSquare, about: 'Send a plain message.', text: { label: 'Message', multiline: true, placeholder: 'Thank you for contacting us.' } },
  'Text + Buttons': { icon: MousePointerClick, about: 'Send a message with up to 3 reply buttons.', text: { label: 'Message', multiline: true, placeholder: 'What do you need help with?' }, options: { label: 'Buttons', hint: 'One button per line, up to 3.' } },
  'Ask a question': { icon: CircleHelp, about: 'Ask something and wait for the answer.', text: { label: 'Question', multiline: true, placeholder: 'Which city are you moving from?' } },
  'Ask Address': { icon: MapPin, about: 'Ask the customer to type or share an address.', text: { label: 'Question', multiline: true, placeholder: 'Please share your pickup address.' } },
  'Ask Media': { icon: Image, about: 'Ask for photos or a video, such as the items to move.', text: { label: 'Request', multiline: true, placeholder: 'Please send photos of the items to be shifted.' } },
  Template: { icon: FileText, about: 'Send an approved template.', text: { label: 'Template', pick: 'template' } },
  'AI message': { icon: Sparkles, about: 'Let the AI agent write this reply.', text: { label: 'What should the AI say?', multiline: true, placeholder: 'Summarise the move details and confirm them with the customer.' } },
  Condition: { icon: GitBranch, about: 'Continue only when a rule is true.', text: { label: 'Rule', placeholder: 'Drop city is outside Delhi NCR' }, options: { label: 'Outcomes', hint: 'One per line, e.g. “Yes: continue” and “No: hand over to team”.' } },
  'Time Delay': { icon: Clock, about: 'Wait before the next step.', text: { label: 'Wait for', placeholder: '10 minutes' } },
  'Set Attribute': { icon: Variable, about: 'Save a value on the contact.', text: { label: 'Attribute and value', placeholder: 'service = Home shifting' } },
  'Add Tag': { icon: Tag, about: 'Add a tag to the lead.', text: { label: 'Tag', placeholder: 'urgent' } },
  'Create Lead': { icon: UserPlus, about: 'Save the contact as a lead in the CRM.', text: { label: 'Note for the lead (optional)', placeholder: 'Created by the enquiry bot' } },
  'Assign Agent': { icon: UserCheck, about: 'Give the chat to a team member.', text: { label: 'Assign to', pick: 'user' } },
  'Request Intervention': { icon: Hand, about: 'Pause the bot and alert the team.', text: { label: 'Note for the team (optional)', placeholder: 'Customer asked for a quotation' } },
  'API Request': { icon: Globe, about: 'Call another system.', text: { label: 'Web address', placeholder: 'https://example.com/webhook' }, options: { label: 'Method and fields', hint: 'First line is the method (GET or POST); other lines are fields to send.' } },
  'Opt-out': { icon: XOctagon, about: 'Stop sending messages to this number.', text: { label: 'Confirmation message', multiline: true, placeholder: 'You will not receive more messages from us.' } },
}
const KIND_NAMES = Object.keys(KINDS)
const kindInfo = (k: string): KindInfo => KINDS[k] ?? { icon: Workflow, about: 'Custom step.', text: { label: 'Text', multiline: true } }

const blank = (): BotFlow => ({ id: '', name: '', trigger: 'Keyword Match', keywords: [], steps: [], active: false, runs: 0, updatedAt: nowIso() })

export default function BotFlows() {
  const flows = useStore(s => s.botFlows)
  const [tab, setTab] = useState<'all' | 'active' | 'inactive'>('all')
  const [view, setView] = useState<'cards' | 'list'>('cards')
  const [editing, setEditing] = useState<BotFlow | null>(null)
  const [deleting, setDeleting] = useState<BotFlow | null>(null)

  const rows = useMemo(() => flows.filter(f => tab === 'all' || (tab === 'active') === f.active), [flows, tab])
  const activeCount = flows.filter(f => f.active).length
  const { update, add, remove } = useStore.getState()

  if (editing) return <FlowEditor key={editing.id || 'new'} flow={editing} onClose={() => setEditing(null)} />

  const duplicate = (f: BotFlow) => add('botFlows', { ...f, id: undefined, name: `${f.name} (copy)`, active: false, runs: 0, updatedAt: nowIso(), steps: f.steps.map(s => ({ ...s, id: uid() })) })
  const rowActions = (f: BotFlow) => (
    <div className="flex items-center gap-1">
      <Button size="sm" icon={Pencil} onClick={() => setEditing(f)}>Edit</Button>
      <Button size="sm" variant="ghost" icon={Copy} onClick={() => duplicate(f)} aria-label={`Duplicate ${f.name}`} title="Duplicate" />
      <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDeleting(f)} aria-label={`Delete ${f.name}`} title="Delete" />
    </div>
  )
  const triggerText = (f: BotFlow) => normTrigger(f.trigger) + (f.keywords?.length ? `: ${f.keywords.join(', ')}` : '')

  return (
    <div>
      <PageHeader
        title="Bot flows"
        subtitle="Step-by-step automatic replies for common enquiries"
        icon={Workflow}
        actions={<Button variant="primary" icon={Plus} onClick={() => setEditing(blank())}>New flow</Button>}
      />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[{ id: 'all', label: 'All', count: flows.length }, { id: 'active', label: 'Active', count: activeCount }, { id: 'inactive', label: 'Inactive', count: flows.length - activeCount }]}
        />
        <div className="inline-flex rounded-lg border border-border bg-surface p-1">
          {([['cards', LayoutGrid, 'Card view'], ['list', List, 'List view']] as const).map(([id, Icon, label]) => (
            <button key={id} onClick={() => setView(id)} aria-label={label} title={label} className={cn('cursor-pointer rounded-md p-1.5', view === id ? 'bg-brand-soft text-brand' : 'text-muted hover:text-text')}><Icon size={15} /></button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Workflow}
            title={flows.length ? `No ${tab} flows` : 'No bot flows yet'}
            text="A flow answers a customer step by step, for example collecting the pickup city, drop city and date."
            action={<Button variant="primary" icon={Plus} onClick={() => setEditing(blank())}>New flow</Button>}
          />
        </Card>
      ) : view === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(f => (
            <Card key={f.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <button onClick={() => setEditing(f)} className="min-w-0 cursor-pointer text-left text-sm font-semibold hover:text-brand">{f.name}</button>
                <Toggle checked={f.active} onChange={v => update('botFlows', f.id, { active: v })} label={`${f.name} active`} />
              </div>
              <p className="mt-1 text-xs text-muted">Starts on: {triggerText(f)}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone={f.active ? 'good' : 'neutral'}>{f.active ? 'Active' : 'Inactive'}</Badge>
                <Badge>{f.steps.length} {f.steps.length === 1 ? 'step' : 'steps'}</Badge>
                <Badge>{f.runs.toLocaleString('en-IN')} runs</Badge>
              </div>
              <div className="mt-3 flex-1 space-y-1">
                {f.steps.slice(0, 4).map((s, i) => {
                  const Icon = kindInfo(s.kind).icon
                  return <p key={s.id} className="flex items-center gap-1.5 truncate text-xs text-muted"><Icon size={12} className="shrink-0" /> {i + 1}. {s.label || s.kind}</p>
                })}
                {f.steps.length > 4 && <p className="text-xs text-muted">+ {f.steps.length - 4} more</p>}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-[11px] text-muted">Updated {timeAgo(f.updatedAt)}</span>
                {rowActions(f)}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="divide-y divide-border">
          {rows.map(f => (
            <div key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Toggle checked={f.active} onChange={v => update('botFlows', f.id, { active: v })} label={`${f.name} active`} />
              <div className="min-w-40 flex-1">
                <button onClick={() => setEditing(f)} className="cursor-pointer text-left text-sm font-medium hover:text-brand">{f.name}</button>
                <p className="text-xs text-muted">{triggerText(f)}</p>
              </div>
              <Badge>{f.steps.length} steps</Badge>
              <Badge>{f.runs.toLocaleString('en-IN')} runs</Badge>
              {rowActions(f)}
            </div>
          ))}
        </Card>
      )}

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete flow?"
        footer={<><Button onClick={() => setDeleting(null)}>Keep it</Button><Button variant="danger" icon={Trash2} onClick={() => { if (deleting) remove('botFlows', deleting.id); setDeleting(null) }}>Delete</Button></>}
      >
        <p className="text-sm">“{deleting?.name}” and its {deleting?.steps.length} steps will be removed.</p>
      </Modal>
    </div>
  )
}

function FlowEditor({ flow, onClose }: { flow: BotFlow; onClose: () => void }) {
  const isNew = !flow.id
  const [name, setName] = useState(flow.name)
  const [trigger, setTrigger] = useState(normTrigger(flow.trigger))
  const [keywords, setKeywords] = useState((flow.keywords ?? []).join(', '))
  const [steps, setSteps] = useState<FlowStep[]>(flow.steps)
  const [active, setActive] = useState(flow.active)
  const [stepEdit, setStepEdit] = useState<{ step: FlowStep; index: number; isNew: boolean } | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [dirty, setDirty] = useState(false)
  const touch = () => setDirty(true)

  const kw = keywords.split(',').map(k => k.trim()).filter(Boolean)
  const error = !name.trim() ? 'Give the flow a name.' : trigger === 'Keyword Match' && kw.length === 0 ? 'Add at least one keyword.' : ''

  const save = () => {
    if (error) return
    const data = { name: name.trim(), trigger, keywords: trigger === 'Keyword Match' ? kw : undefined, steps, active, updatedAt: nowIso() }
    const s = useStore.getState()
    if (isNew) s.add('botFlows', { ...data, runs: 0 })
    else s.update('botFlows', flow.id, data)
    onClose()
  }
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= steps.length) return
    const next = [...steps]
    ;[next[i], next[j]] = [next[j], next[i]]
    setSteps(next); touch()
  }
  const saveStep = (st: FlowStep) => {
    if (!stepEdit) return
    const next = [...steps]
    if (stepEdit.isNew) next.splice(stepEdit.index, 0, st)
    else next[stepEdit.index] = st
    setSteps(next); touch(); setStepEdit(null)
  }
  const newStep = (index: number) => setStepEdit({ step: { id: uid(), kind: 'Text Message', label: '' }, index, isNew: true })
  const leave = () => (dirty ? setConfirmLeave(true) : onClose())
  const trigInfo = TRIGGERS.find(t => t.id === trigger)

  return (
    <div>
      <PageHeader
        title={isNew ? 'New bot flow' : name || 'Edit bot flow'}
        subtitle={dirty ? 'You have unsaved changes' : 'Build the steps the bot follows'}
        icon={Workflow}
        actions={
          <>
            <Button icon={ArrowLeft} onClick={leave}>Back to flows</Button>
            <Button variant="primary" icon={Save} disabled={!!error} onClick={save}>Save flow</Button>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card title="Flow details" action={<span className="flex items-center gap-2 text-xs text-muted">Active <Toggle checked={active} onChange={v => { setActive(v); touch() }} label="Flow active" /></span>}>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Field label="Flow name"><Input value={name} onChange={e => { setName(e.target.value); touch() }} placeholder="Main enquiry bot" autoFocus={isNew} /></Field>
              <Field label="Starts when" hint={trigInfo?.hint}>
                <Select value={trigger} onChange={e => { setTrigger(e.target.value); touch() }}>
                  {!trigInfo && <option>{trigger}</option>}
                  {TRIGGERS.map(t => <option key={t.id}>{t.id}</option>)}
                </Select>
              </Field>
              {trigger === 'Keyword Match' && (
                <Field label="Keywords" hint="Separate with commas. Matching ignores capital letters." className="sm:col-span-2">
                  <Input value={keywords} onChange={e => { setKeywords(e.target.value); touch() }} placeholder="quote, price, rate" />
                  {kw.length > 0 && <span className="mt-1.5 flex flex-wrap gap-1">{kw.map(k => <Badge key={k} tone="brand">{k}</Badge>)}</span>}
                </Field>
              )}
              {error && <p className="text-xs text-rose-600 sm:col-span-2">{error}</p>}
            </div>
          </Card>

          <Card title={`Steps (${steps.length})`} action={<Button size="sm" icon={Plus} onClick={() => newStep(steps.length)}>Add step</Button>}>
            <div className="p-4">
              <div className="mx-auto max-w-xl">
                <div className="rounded-lg border border-dashed border-brand/50 bg-brand-soft px-3 py-2 text-center text-xs font-medium text-brand">
                  Start: {trigger}{trigger === 'Keyword Match' && kw.length ? ` (${kw.join(', ')})` : ''}
                </div>
                {steps.length === 0 && (
                  <>
                    <Connector onAdd={() => newStep(0)} />
                    <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted">No steps yet. Add the first thing the bot should do.</div>
                  </>
                )}
                {steps.map((s, i) => {
                  const info = kindInfo(s.kind)
                  return (
                    <div key={s.id}>
                      <Connector onAdd={() => newStep(i)} />
                      <div className="rounded-lg border border-border bg-surface p-3 shadow-sm">
                        <div className="flex items-start gap-2.5">
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><info.icon size={16} /></span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Step {i + 1} · {s.kind}</p>
                            <p className="truncate text-sm font-medium">{s.label || s.kind}</p>
                          </div>
                          <div className="flex shrink-0 items-center">
                            <IconBtn icon={ChevronUp} label="Move up" disabled={i === 0} onClick={() => move(i, -1)} />
                            <IconBtn icon={ChevronDown} label="Move down" disabled={i === steps.length - 1} onClick={() => move(i, 1)} />
                            <IconBtn icon={Pencil} label="Edit step" onClick={() => setStepEdit({ step: s, index: i, isNew: false })} />
                            <IconBtn icon={Trash2} label="Delete step" danger onClick={() => { setSteps(steps.filter(x => x.id !== s.id)); touch() }} />
                          </div>
                        </div>
                        {s.text && <p className="mt-2 rounded-md bg-surface-2 px-2.5 py-1.5 text-xs whitespace-pre-wrap break-words">{s.text}</p>}
                        {!!s.options?.length && <div className="mt-2 flex flex-wrap gap-1">{s.options.map((o, k) => <Badge key={k} tone="info">{o}</Badge>)}</div>}
                      </div>
                    </div>
                  )
                })}
                {steps.length > 0 && (
                  <>
                    <Connector onAdd={() => newStep(steps.length)} />
                    <div className="rounded-lg border border-dashed border-border px-3 py-2 text-center text-xs text-muted">End of flow</div>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>

        <PreviewRun steps={steps} />
      </div>

      {stepEdit && <StepForm key={stepEdit.step.id} step={stepEdit.step} isNew={stepEdit.isNew} onClose={() => setStepEdit(null)} onSave={saveStep} />}

      <Modal
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Leave without saving?"
        footer={<><Button onClick={() => setConfirmLeave(false)}>Keep editing</Button><Button variant="danger" onClick={onClose}>Discard changes</Button></>}
      >
        <p className="text-sm">Your changes to this flow have not been saved.</p>
      </Modal>
    </div>
  )
}

function IconBtn({ icon: Icon, label, onClick, disabled, danger }: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label} className={cn('cursor-pointer rounded p-1.5 text-muted hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-30', danger ? 'hover:text-rose-600' : 'hover:text-text')}>
      <Icon size={15} />
    </button>
  )
}
function Connector({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center">
      <span className="h-3 w-px bg-border" />
      <button onClick={onAdd} aria-label="Add a step here" title="Add a step here" className="grid size-5 cursor-pointer place-items-center rounded-full border border-border bg-surface text-muted hover:border-brand hover:text-brand"><Plus size={12} /></button>
      <span className="h-3 w-px bg-border" />
    </div>
  )
}

function StepForm({ step, isNew, onClose, onSave }: { step: FlowStep; isNew: boolean; onClose: () => void; onSave: (s: FlowStep) => void }) {
  const templates = useStore(s => s.templates)
  const users = useStore(s => s.users)
  const [kind, setKind] = useState(step.kind)
  const [label, setLabel] = useState(step.label)
  const [text, setText] = useState(step.text ?? '')
  const [options, setOptions] = useState((step.options ?? []).join('\n'))
  const info = kindInfo(kind)
  const approved = templates.filter(t => t.status === 'approved')
  const opts = options.split('\n').map(o => o.trim()).filter(Boolean)
  const tooMany = kind === 'Text + Buttons' && opts.length > 3
  const needsText = ['Text Message', 'Text + Buttons', 'Ask a question', 'Ask Address', 'Ask Media', 'Template', 'Condition', 'Time Delay', 'Set Attribute', 'Add Tag', 'API Request'].includes(kind)
  const error = needsText && !text.trim() ? `Fill in “${info.text?.label ?? 'Text'}”.` : kind === 'Text + Buttons' && opts.length === 0 ? 'Add at least one button.' : tooMany ? 'WhatsApp allows up to 3 buttons.' : ''

  const changeKind = (k: string) => {
    setKind(k)
    const pick = kindInfo(k).text?.pick
    if (pick === 'template') setText(approved[0]?.name ?? '')
    else if (pick === 'user') setText('Round robin (next available)')
    else if (kindInfo(kind).text?.pick) setText('')
  }
  const save = () => {
    if (error) return
    onSave({ id: step.id, kind, label: label.trim() || kind, text: info.text && text.trim() ? text.trim() : undefined, options: info.options && opts.length ? opts : undefined })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Add step' : 'Edit step'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!error} onClick={save}>{isNew ? 'Add step' : 'Save step'}</Button></>}
    >
      <div className="space-y-3">
        <Field label="Step type" hint={info.about}>
          <Select value={kind} onChange={e => changeKind(e.target.value)}>
            {!KINDS[kind] && <option>{kind}</option>}
            {KIND_NAMES.map(k => <option key={k}>{k}</option>)}
          </Select>
        </Field>
        <Field label="Label" hint="A short name for this step, shown in the flow.">
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder={kind} />
        </Field>
        {info.text && (
          <Field label={info.text.label}>
            {info.text.pick === 'template' ? (
              <Select value={text} onChange={e => setText(e.target.value)}>
                <option value="">Choose an approved template</option>
                {text && !approved.some(t => t.name === text) && <option>{text}</option>}
                {approved.map(t => <option key={t.id}>{t.name}</option>)}
              </Select>
            ) : info.text.pick === 'user' ? (
              <Select value={text} onChange={e => setText(e.target.value)}>
                <option>Round robin (next available)</option>
                <option>Lead owner</option>
                {users.filter(u => u.active).map(u => <option key={u.id}>{u.name}</option>)}
              </Select>
            ) : info.text.multiline ? (
              <Textarea rows={4} value={text} onChange={e => setText(e.target.value)} placeholder={info.text.placeholder} />
            ) : (
              <Input value={text} onChange={e => setText(e.target.value)} placeholder={info.text.placeholder} />
            )}
          </Field>
        )}
        {info.options && (
          <Field label={info.options.label} hint={info.options.hint}>
            <Textarea rows={3} value={options} onChange={e => setOptions(e.target.value)} placeholder={kind === 'API Request' ? 'POST\nname\nphone' : 'Home shifting\nOffice shifting'} />
          </Field>
        )}
        {kind === 'API Request' && <p className="text-xs text-amber-600">In this version the request is saved but never sent. The preview only shows that the step would run.</p>}
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    </Modal>
  )
}

interface Line { who: 'bot' | 'customer' | 'system'; text: string; buttons?: string[] }

function sampleAnswer(s: FlowStep): string {
  const t = `${s.label} ${s.text ?? ''}`.toLowerCase()
  if (s.kind === 'Ask Address') return 'Flat 402, Palm Residency, Sector 56, Gurugram'
  if (s.kind === 'Ask Media') return '📷 Photo: living room items'
  if (/from|pickup/.test(t)) return 'Gurugram'
  if (/drop|moving to|destination/.test(t)) return 'Pune'
  if (/date|when/.test(t)) return '28 November'
  if (/size|bhk/.test(t)) return '2 BHK'
  if (/floor|lift/.test(t)) return '3rd floor, lift available'
  if (/name/.test(t)) return 'Rahul Sharma'
  return 'Okay'
}
function linesFor(s: FlowStep, choice: string | undefined, templateBody: (name: string) => string | undefined): Line[] {
  switch (s.kind) {
    case 'Text Message': return [{ who: 'bot', text: s.text ?? '' }]
    case 'Text + Buttons': return [{ who: 'bot', text: s.text ?? '', buttons: s.options }, ...(choice ? [{ who: 'customer' as const, text: choice }] : [])]
    case 'Ask a question': case 'Ask Address': case 'Ask Media': return [{ who: 'bot', text: s.text ?? '' }, { who: 'customer', text: sampleAnswer(s) }]
    case 'Template': return [{ who: 'bot', text: templateBody(s.text ?? '') ?? `Template: ${s.text ?? 'not chosen'}` }]
    case 'AI message': return [{ who: 'system', text: `AI agent would write a reply here${s.text ? `: “${s.text}”` : ''}` }]
    case 'Condition': return [{ who: 'system', text: `Check: ${s.text ?? 'rule'}${s.options?.length ? ` → preview follows “${s.options[0]}”` : ''}` }]
    case 'Time Delay': return [{ who: 'system', text: `Wait ${s.text ?? ''} (skipped in preview)` }]
    case 'Set Attribute': return [{ who: 'system', text: `Save ${s.text ?? 'attribute'}` }]
    case 'Add Tag': return [{ who: 'system', text: `Add tag “${s.text ?? ''}” to the lead` }]
    case 'Create Lead': return [{ who: 'system', text: 'Create a lead in the CRM with the collected answers' }]
    case 'Assign Agent': return [{ who: 'system', text: `Assign the chat to ${s.text ?? 'the team'}` }]
    case 'Request Intervention': return [{ who: 'system', text: `Pause the bot and mark the chat “Needs attention”${s.text ? `: ${s.text}` : ''}` }]
    case 'API Request': return [{ who: 'system', text: `${s.options?.[0] ?? 'POST'} ${s.text ?? ''} (not sent in this version)` }]
    case 'Opt-out': return [...(s.text ? [{ who: 'bot' as const, text: s.text }] : []), { who: 'system', text: 'Number added to the opt-out list' }]
    default: return [{ who: 'system', text: s.text ? `${s.kind}: ${s.text}` : s.kind }]
  }
}

function PreviewRun({ steps }: { steps: FlowStep[] }) {
  const templates = useStore(s => s.templates)
  const [n, setN] = useState(0)
  const [choices, setChoices] = useState<Record<string, string>>({})
  const scroller = useRef<HTMLDivElement>(null)
  const shown = Math.min(n, steps.length)
  const current = shown > 0 ? steps[shown - 1] : undefined
  const waiting = current?.kind === 'Text + Buttons' && !!current.options?.length && !choices[current.id]
  const done = shown >= steps.length && !waiting

  const lines = useMemo(() => {
    const body = (name: string) => templates.find(t => t.name === name)?.body
    return steps.slice(0, shown).flatMap(s => linesFor(s, choices[s.id], body).map((l, i) => ({ ...l, key: `${s.id}-${i}`, stepId: s.id })))
  }, [steps, shown, choices, templates])
  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight }, [lines.length])

  const choose = (stepId: string, o: string) => setChoices(c => ({ ...c, [stepId]: o }))
  const next = () => {
    if (waiting && current) { choose(current.id, current.options![0]); return }
    setN(shown + 1)
  }
  const runAll = () => {
    const c = { ...choices }
    steps.forEach(s => { if (s.kind === 'Text + Buttons' && s.options?.length && !c[s.id]) c[s.id] = s.options[0] })
    setChoices(c); setN(steps.length)
  }
  const restart = () => { setN(0); setChoices({}) }

  return (
    <Card
      className="flex h-[560px] flex-col self-start xl:sticky xl:top-0"
      title={<span className="flex items-center gap-2">Preview run <Badge tone="warn">Simulated chat</Badge></span>}
      action={<Button size="sm" variant="ghost" icon={RotateCcw} disabled={n === 0} onClick={restart}>Restart</Button>}
    >
      <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-bg p-3">
        {steps.length === 0 && <p className="px-4 py-8 text-center text-xs text-muted">Add steps to preview the conversation.</p>}
        {steps.length > 0 && shown === 0 && <p className="px-4 py-8 text-center text-xs text-muted">Press “Next step” to walk through the flow as a customer would see it. Customer answers are sample values.</p>}
        {lines.map(l =>
          l.who === 'system' ? (
            <div key={l.key} className="flex justify-center"><span className="max-w-full rounded-full border border-border bg-surface px-2.5 py-0.5 text-center text-[11px] text-muted">{l.text}</span></div>
          ) : (
            <div key={l.key} className={cn('flex', l.who === 'customer' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[85%] rounded-xl px-3 py-1.5 text-sm', l.who === 'customer' ? 'rounded-tr-none bg-brand text-brand-fg' : 'rounded-tl-none border border-border bg-surface')}>
                {l.who === 'bot' && <div className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-brand"><Bot size={11} /> Bot</div>}
                <p className="whitespace-pre-wrap break-words">{l.text || <span className="text-muted">(empty message)</span>}</p>
                {l.buttons && l.buttons.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {l.buttons.map(o => (
                      <button key={o} disabled={!!choices[l.stepId]} onClick={() => choose(l.stepId, o)} className={cn('block w-full rounded-md border border-border px-2 py-1 text-center text-xs font-medium text-brand', choices[l.stepId] ? 'opacity-60' : 'cursor-pointer hover:bg-brand-soft', choices[l.stepId] === o && 'bg-brand-soft opacity-100')}>{o}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        {waiting && <p className="text-center text-[11px] text-muted">Tap a button above to answer as the customer.</p>}
        {done && steps.length > 0 && <p className="pt-1 text-center text-[11px] font-medium text-emerald-600">Flow finished</p>}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border p-3">
        <span className="text-xs text-muted">Step {shown} of {steps.length}</span>
        <span className="flex gap-2">
          <Button size="sm" disabled={done || steps.length === 0} onClick={runAll}>Run all</Button>
          <Button size="sm" variant="primary" icon={Play} disabled={done || steps.length === 0} onClick={next}>{waiting ? 'Pick first button' : 'Next step'}</Button>
        </span>
      </div>
    </Card>
  )
}
