import { useMemo, useState } from 'react'
import { BellRing, Bot, FlaskConical, IndianRupee, ListChecks, Mail, MessageCircle, Pencil, Plus, Shuffle, Trash2, Workflow, Zap, type LucideIcon } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Automation, AutomationAction, Priority } from '@/lib/types'
import { nowIso } from '@/lib/utils'
import { Badge, Button, Card, DemoNotice, Drawer, EmptyState, Field, Input, Modal, PageHeader, Select, Toggle, tableCls, tableWrap, tdCls, thCls, trCls } from '@/components/ui'
import { Confirm } from '@/components/admin/shared'

type Trigger = Automation['trigger']
type Draft = Omit<Automation, 'id' | 'runs' | 'createdAt'> & { id?: string }

const TRIGGERS: Record<Trigger, string> = { new_lead: 'New lead', stage_changed: 'Stage changed', task_overdue: 'Task overdue', no_reply: 'No reply' }
const ACTIONS: Record<AutomationAction, string> = {
  assign: 'Assign owner', tag: 'Add tag', stage: 'Change stage', task: 'Create task', notify: 'Notify someone',
  email: 'Send email', whatsapp: 'Send WhatsApp message', ai_call: 'Call with AI agent',
}
const WAITS = [{ v: 0, label: 'Right away' }, { v: 5, label: '5 minutes' }, { v: 30, label: '30 minutes' }, { v: 60, label: '1 hour' }, { v: 1440, label: '1 day' }]
const TESTABLE: AutomationAction[] = ['assign', 'tag', 'stage', 'task', 'notify']
const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent']

const waitLabel = (m: number) => WAITS.find(w => w.v === m)?.label ?? (m % 1440 === 0 ? `${m / 1440} days` : m % 60 === 0 ? `${m / 60} hours` : `${m} minutes`)
/** True when the store really performs this rule in the browser-only version. */
const runsHere = (a: Pick<Automation, 'trigger' | 'action' | 'actionConfig'>) =>
  a.trigger === 'new_lead' && (a.action === 'task' || (a.action === 'assign' && a.actionConfig.mode === 'round_robin'))

interface Ctx { welcomeTpl?: string; paymentTpl?: string; emailTpl?: string; voiceAgent?: string }
interface Recipe { id: string; title: string; text: string; icon: LucideIcon; match: (a: Automation, c: Ctx) => boolean; draft: (c: Ctx) => Draft }

const isPayment = (a: Automation, c: Ctx) => /payment/i.test(a.name) || (a.action === 'whatsapp' && !!c.paymentTpl && a.actionConfig.templateId === c.paymentTpl)
const RECIPES: Recipe[] = [
  { id: 'welcome_email', title: 'Welcome email', text: 'Email every new lead a thank-you note from a saved email template.', icon: Mail,
    match: a => a.trigger === 'new_lead' && a.action === 'email',
    draft: c => ({ name: 'Welcome email', trigger: 'new_lead', delayMin: 0, action: 'email', actionConfig: { emailTemplateId: c.emailTpl ?? '' }, active: true }) },
  { id: 'wa_welcome', title: 'WhatsApp welcome message', text: 'Send an approved WhatsApp template as soon as an enquiry arrives.', icon: MessageCircle,
    match: (a, c) => a.trigger === 'new_lead' && a.action === 'whatsapp' && !isPayment(a, c),
    draft: c => ({ name: 'WhatsApp welcome message', trigger: 'new_lead', delayMin: 0, action: 'whatsapp', actionConfig: { templateId: c.welcomeTpl ?? '' }, active: true }) },
  { id: 'followup_task', title: 'Follow-up reminder task', text: 'Create a follow-up task for the owner of every new lead.', icon: ListChecks,
    match: a => a.trigger === 'new_lead' && a.action === 'task',
    draft: () => ({ name: 'Follow-up task after one day', trigger: 'new_lead', delayMin: 1440, action: 'task', actionConfig: { title: 'Follow up with new lead', priority: 'medium' }, active: true }) },
  { id: 'ai_call', title: 'Call new leads with an AI voice agent', text: 'Have a voice agent call each new enquiry and collect the move details.', icon: Bot,
    match: a => a.action === 'ai_call',
    draft: c => ({ name: 'AI call to new leads', trigger: 'new_lead', delayMin: 5, action: 'ai_call', actionConfig: { voiceAgentId: c.voiceAgent ?? '' }, active: true }) },
  { id: 'round_robin', title: 'Share leads across the team', text: 'Give each new lead to the next person in turn (round-robin).', icon: Shuffle,
    match: a => a.trigger === 'new_lead' && a.action === 'assign' && a.actionConfig.mode === 'round_robin',
    draft: () => ({ name: 'Share new leads across the team', trigger: 'new_lead', delayMin: 0, action: 'assign', actionConfig: { mode: 'round_robin' }, active: true }) },
  { id: 'payment', title: 'Payment reminders', text: 'Remind customers on WhatsApp when an invoice balance is still unpaid.', icon: IndianRupee,
    match: isPayment,
    draft: c => ({ name: 'Payment reminder on WhatsApp', trigger: 'no_reply', delayMin: 1440, action: 'whatsapp', actionConfig: { templateId: c.paymentTpl ?? '' }, active: true }) },
]

const blank = (): Draft => ({ name: '', trigger: 'new_lead', delayMin: 0, action: 'task', actionConfig: { title: 'Follow up with new lead', priority: 'medium' }, active: true })

export default function Automations() {
  const automations = useStore(s => s.automations)
  const settings = useStore(s => s.settings)
  const users = useStore(s => s.users)
  const stages = useStore(s => s.stages)
  const sources = useStore(s => s.sources)
  const templates = useStore(s => s.templates)
  const emailTemplates = useStore(s => s.emailTemplates)
  const voiceAgents = useStore(s => s.voiceAgents)
  const leads = useStore(s => s.leads)

  const [draft, setDraft] = useState<Draft | null>(null)
  const [pool, setPool] = useState<string[]>([])
  const [customWait, setCustomWait] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<Automation | null>(null)
  const [testing, setTesting] = useState<Automation | null>(null)
  const [testLead, setTestLead] = useState('')
  const [testQuery, setTestQuery] = useState('')
  const [testResult, setTestResult] = useState('')

  const ctx = useMemo<Ctx>(() => ({
    welcomeTpl: (templates.find(t => /welcome/i.test(t.name)) ?? templates[0])?.id,
    paymentTpl: templates.find(t => /payment/i.test(t.name))?.id,
    emailTpl: (emailTemplates.find(t => /welcome/i.test(t.name)) ?? emailTemplates[0])?.id,
    voiceAgent: (voiceAgents.find(v => v.direction === 'outbound') ?? voiceAgents[0])?.id,
  }), [templates, emailTemplates, voiceAgents])

  const activeUsers = useMemo(() => users.filter(u => u.active), [users])
  const livePool = useMemo(() => settings.autoAssignUserIds.filter(id => activeUsers.some(u => u.id === id)), [settings.autoAssignUserIds, activeUsers])
  const isRunning = (a: Automation) => a.active && !(a.action === 'assign' && a.actionConfig.mode === 'round_robin' && (!settings.autoAssign || !livePool.length))
  const running = automations.filter(isRunning).length
  const name = (id: string | undefined, list: { id: string; name?: string; label?: string }[]) => { const r = list.find(x => x.id === id); return r?.name ?? r?.label }

  const describe = (a: Automation) => {
    const c = a.actionConfig
    switch (a.action) {
      case 'assign': return c.mode === 'round_robin' ? 'Assign owner: next person in turn' : `Assign owner: ${name(c.userId, users) ?? 'not chosen'}`
      case 'tag': return `Add tag: ${c.tag || '—'}`
      case 'stage': return `Change stage: ${name(c.stageId, stages) ?? 'not chosen'}`
      case 'task': return `Create task: ${c.title || 'Follow up'} (${c.priority || 'medium'})`
      case 'notify': return `Notify ${name(c.userId, users) ?? 'the team'}`
      case 'email': return `Send email: ${name(c.emailTemplateId, emailTemplates) ?? 'no template'}`
      case 'whatsapp': return `Send WhatsApp: ${name(c.templateId, templates) ?? 'no template'}`
      case 'ai_call': return `AI call: ${name(c.voiceAgentId, voiceAgents) ?? 'no agent'}`
    }
  }
  const condition = (a: Automation) => [a.filterSourceId && `Source is ${name(a.filterSourceId, sources) ?? 'deleted source'}`, a.filterStageId && `Stage is ${name(a.filterStageId, stages) ?? 'deleted stage'}`].filter(Boolean).join(' and ') || 'Every lead'

  const openForm = (d: Draft) => {
    setDraft(d); setError('')
    setPool(settings.autoAssignUserIds)
    setCustomWait(!WAITS.some(w => w.v === d.delayMin))
  }
  const openRecipe = (r: Recipe) => {
    const existing = automations.find(a => r.match(a, ctx))
    openForm(existing ? { ...existing, actionConfig: { ...existing.actionConfig } } : r.draft(ctx))
  }
  const patch = (p: Partial<Draft>) => setDraft(d => (d ? { ...d, ...p } : d))
  const cfg = (p: Record<string, string>) => setDraft(d => (d ? { ...d, actionConfig: { ...d.actionConfig, ...p } } : d))
  const changeAction = (action: AutomationAction) => {
    const defaults: Record<AutomationAction, Record<string, string>> = {
      assign: { mode: 'round_robin' }, tag: { tag: '' }, stage: { stageId: stages[0]?.id ?? '' }, task: { title: 'Follow up with new lead', priority: 'medium' },
      notify: { userId: '', message: '' }, email: { emailTemplateId: ctx.emailTpl ?? '' }, whatsapp: { templateId: ctx.welcomeTpl ?? '' }, ai_call: { voiceAgentId: ctx.voiceAgent ?? '' },
    }
    patch({ action, actionConfig: defaults[action] })
  }

  const save = () => {
    if (!draft) return
    const c = draft.actionConfig
    const problem =
      !draft.name.trim() ? 'Give the rule a name.'
      : draft.action === 'assign' && c.mode !== 'round_robin' && !c.userId ? 'Choose who the lead should go to.'
      : draft.action === 'assign' && c.mode === 'round_robin' && !pool.length ? 'Tick at least one team member to share leads with.'
      : draft.action === 'tag' && !c.tag?.trim() ? 'Type the tag to add.'
      : draft.action === 'stage' && !c.stageId ? 'Choose the stage to move the lead to.'
      : draft.action === 'task' && !c.title?.trim() ? 'Type a title for the task.'
      : draft.action === 'email' && !c.emailTemplateId ? 'Choose an email template.'
      : draft.action === 'whatsapp' && !c.templateId ? 'Choose a WhatsApp template.'
      : draft.action === 'ai_call' && !c.voiceAgentId ? 'Choose a voice agent.'
      : ''
    if (problem) { setError(problem); return }
    const { add, update, setSettings } = useStore.getState()
    const clean: Record<string, string> = {}
    Object.entries(c).forEach(([k, v]) => { if (v !== '' && v !== undefined) clean[k] = typeof v === 'string' ? v.trim() : v })
    const body = {
      name: draft.name.trim(), trigger: draft.trigger, filterSourceId: draft.filterSourceId || undefined, filterStageId: draft.filterStageId || undefined,
      delayMin: Math.max(0, Math.round(draft.delayMin) || 0), action: draft.action, actionConfig: clean, active: draft.active,
    }
    if (draft.id) update('automations', draft.id, body)
    else add('automations', { ...body, runs: 0, createdAt: nowIso() })
    if (draft.action === 'assign' && c.mode === 'round_robin') setSettings({ autoAssignUserIds: pool, ...(draft.active ? { autoAssign: true } : {}) })
    setDraft(null)
  }

  const toggleRule = (a: Automation, v: boolean) => {
    const { update, setSettings } = useStore.getState()
    update('automations', a.id, { active: v })
    if (v && a.action === 'assign' && a.actionConfig.mode === 'round_robin' && !settings.autoAssign) setSettings({ autoAssign: true })
  }

  const openTest = (a: Automation) => { setTesting(a); setTestLead(''); setTestQuery(''); setTestResult('') }
  const runTest = () => {
    const a = testing
    const st = useStore.getState()
    const lead = st.leads.find(l => l.id === testLead)
    if (!a || !lead) return
    const c = a.actionConfig
    let result = ''
    if (a.action === 'assign') {
      let userId = c.userId
      if (c.mode === 'round_robin') {
        const p = st.settings.autoAssignUserIds.filter(id => st.users.some(u => u.id === id && u.active))
        if (!p.length) { setTestResult('Nothing changed: no active team member is ticked for sharing leads. Edit the rule and tick at least one person.'); return }
        userId = p[st.rrIndex % p.length]
        useStore.setState({ rrIndex: st.rrIndex + 1 })
      }
      const u = st.users.find(x => x.id === userId)
      if (!u) { setTestResult('Nothing changed: the person chosen in this rule no longer exists.'); return }
      st.setLeadOwner(lead.id, u.id)
      result = `${lead.name} is now assigned to ${u.name}.`
    } else if (a.action === 'tag') {
      const tag = (c.tag ?? '').trim()
      if (!tag) { setTestResult('Nothing changed: this rule has no tag set.'); return }
      if (lead.tags.includes(tag)) result = `${lead.name} already has the tag "${tag}", so nothing changed.`
      else { st.update('leads', lead.id, { tags: [...lead.tags, tag], updatedAt: nowIso() }); st.log('system', `Tag "${tag}" added by rule "${a.name}"`, lead.id); result = `Tag "${tag}" was added to ${lead.name}.` }
    } else if (a.action === 'stage') {
      const stage = st.stages.find(x => x.id === c.stageId)
      if (!stage) { setTestResult('Nothing changed: the stage chosen in this rule no longer exists.'); return }
      st.setLeadStage(lead.id, stage.id)
      result = `${lead.name} was moved to "${stage.label}".`
    } else if (a.action === 'task') {
      const title = c.title || 'Follow up with new lead'
      const dueAt = new Date(Date.now() + Math.max(a.delayMin, 60) * 60000).toISOString()
      st.add('tasks', { title, type: st.settings.taskTypes[0] ?? 'Follow up', leadId: lead.id, assigneeId: lead.ownerId ?? st.currentUserId, dueAt, status: 'pending', priority: (PRIORITIES.includes(c.priority as Priority) ? c.priority : 'medium') as Priority, createdBy: 'automation', createdAt: nowIso() })
      st.log('task', `Task "${title}" created by rule "${a.name}"`, lead.id)
      result = `Task "${title}" was created for ${lead.name}, due in ${waitLabel(Math.max(a.delayMin, 60)).toLowerCase()}. See it on the Tasks page.`
    } else if (a.action === 'notify') {
      const u = st.users.find(x => x.id === c.userId)
      st.notify(a.name, c.message || `Rule "${a.name}" ran for ${lead.name}`, `/leads/${lead.id}`)
      result = `A notification about ${lead.name} was added to the bell menu${u ? ` (meant for ${u.name}; this browser version has one shared notification list)` : ''}.`
    }
    st.update('automations', a.id, { runs: (st.automations.find(x => x.id === a.id)?.runs ?? a.runs) + 1 })
    setTestResult(result)
  }
  const testMatches = useMemo(() => {
    const q = testQuery.trim().toLowerCase()
    return (q ? leads.filter(l => l.name.toLowerCase().includes(q) || l.phone.includes(q)) : leads).slice(0, 50)
  }, [leads, testQuery])

  const c = draft?.actionConfig ?? {}

  return (
    <div>
      <PageHeader title="Automations" icon={Workflow} subtitle="Rules that do routine work when something happens to a lead"
        actions={<><Badge tone={running ? 'good' : 'neutral'}>{running} running</Badge><Button variant="primary" icon={Plus} onClick={() => openForm(blank())}>New rule</Button></>} />

      <DemoNotice>
        <strong>What really runs in this browser-only version:</strong> when a lead is created, the CRM straight away runs “New lead → Assign owner (next person in turn)” and “New lead → Create task”.
        Every other trigger and action (Stage changed, Task overdue, No reply, waiting periods, emails, WhatsApp messages, AI calls, tags, notifications) is saved and its run count goes up, but it needs the server version with your WhatsApp, email and telephony accounts connected before it acts on its own. Use “Test” on a rule to apply an owner, tag, stage, task or notification action to one lead right now.
      </DemoNotice>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {RECIPES.map(r => {
          const rule = automations.find(a => r.match(a, ctx))
          const on = !!rule && isRunning(rule)
          return (
            <button key={r.id} onClick={() => openRecipe(r)} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-brand cursor-pointer">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><r.icon size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{r.title}</span>
                  <Badge tone={on ? 'good' : rule ? 'warn' : 'neutral'}>{on ? 'Running' : rule ? 'Switched off' : 'Set up'}</Badge>
                </span>
                <span className="mt-1 block text-xs text-muted">{r.text}</span>
                {rule && <span className="mt-1.5 block text-xs text-muted">{rule.runs} runs so far</span>}
              </span>
            </button>
          )
        })}
      </div>

      <h2 className="mb-2 text-sm font-semibold">All rules</h2>
      {automations.length === 0 ? (
        <Card><EmptyState icon={Zap} title="No rules yet" text="Create a rule, or start from one of the ready-made ones above." action={<Button variant="primary" icon={Plus} onClick={() => openForm(blank())}>New rule</Button>} /></Card>
      ) : (
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead><tr>{['Name', 'When', 'Only if', 'Wait', 'Then', 'Runs', 'Active', ''].map(h => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>
              {automations.map(a => (
                <tr key={a.id} className={trCls}>
                  <td className={tdCls}>
                    <button className="text-left font-medium hover:text-brand cursor-pointer" onClick={() => openForm({ ...a, actionConfig: { ...a.actionConfig } })}>{a.name}</button>
                    <div className="mt-0.5"><Badge tone={runsHere(a) ? 'good' : 'neutral'}>{runsHere(a) ? 'Runs in this version' : 'Needs the server version'}</Badge></div>
                  </td>
                  <td className={tdCls + ' whitespace-nowrap'}>{TRIGGERS[a.trigger]}</td>
                  <td className={tdCls + ' text-muted'}>{condition(a)}</td>
                  <td className={tdCls + ' whitespace-nowrap'}>{waitLabel(a.delayMin)}</td>
                  <td className={tdCls}>{describe(a)}</td>
                  <td className={tdCls}>{a.runs.toLocaleString('en-IN')}</td>
                  <td className={tdCls}><Toggle checked={a.active} onChange={v => toggleRule(a, v)} label={`${a.name} active`} /></td>
                  <td className={tdCls}>
                    <div className="flex justify-end gap-1">
                      {TESTABLE.includes(a.action) && <Button size="sm" icon={FlaskConical} onClick={() => openTest(a)}>Test</Button>}
                      <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Edit ${a.name}`} onClick={() => openForm({ ...a, actionConfig: { ...a.actionConfig } })} />
                      <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete ${a.name}`} onClick={() => setDeleting(a)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit rule' : 'New rule'}
        footer={<><Button onClick={() => setDraft(null)}>Cancel</Button><Button variant="primary" onClick={save}>{draft?.id ? 'Save rule' : 'Create rule'}</Button></>}>
        {draft && (
          <div className="space-y-4">
            <Field label="Rule name"><Input value={draft.name} onChange={e => patch({ name: e.target.value })} placeholder="e.g. Follow-up task after one day" autoFocus /></Field>
            <Field label="When this happens">
              <Select value={draft.trigger} onChange={e => patch({ trigger: e.target.value as Trigger })}>
                {(Object.keys(TRIGGERS) as Trigger[]).map(t => <option key={t} value={t}>{TRIGGERS[t]}</option>)}
              </Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Only for this source (optional)">
                <Select value={draft.filterSourceId ?? ''} onChange={e => patch({ filterSourceId: e.target.value || undefined })}>
                  <option value="">Any source</option>
                  {sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              </Field>
              <Field label="Only in this stage (optional)">
                <Select value={draft.filterStageId ?? ''} onChange={e => patch({ filterStageId: e.target.value || undefined })}>
                  <option value="">Any stage</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Wait before acting">
                <Select value={customWait ? 'custom' : String(draft.delayMin)} onChange={e => { if (e.target.value === 'custom') setCustomWait(true); else { setCustomWait(false); patch({ delayMin: Number(e.target.value) }) } }}>
                  {WAITS.map(w => <option key={w.v} value={w.v}>{w.label}</option>)}
                  <option value="custom">Custom…</option>
                </Select>
              </Field>
              {customWait && <Field label="Minutes to wait"><Input type="number" min={0} value={draft.delayMin} onChange={e => patch({ delayMin: Number(e.target.value) })} /></Field>}
            </div>
            <Field label="Then do this">
              <Select value={draft.action} onChange={e => changeAction(e.target.value as AutomationAction)}>
                {(Object.keys(ACTIONS) as AutomationAction[]).map(a => <option key={a} value={a}>{ACTIONS[a]}</option>)}
              </Select>
            </Field>

            <div className="space-y-3 rounded-lg border border-border bg-surface-2/50 p-3">
              {draft.action === 'assign' && <>
                <Field label="Who gets the lead">
                  <Select value={c.mode === 'round_robin' ? 'rr' : c.userId ?? ''} onChange={e => patch({ actionConfig: e.target.value === 'rr' ? { mode: 'round_robin' } : { userId: e.target.value } })}>
                    <option value="rr">Next person in turn (round-robin)</option>
                    {c.mode !== 'round_robin' && !c.userId && <option value="">Choose a person…</option>}
                    {activeUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </Select>
                </Field>
                {c.mode === 'round_robin' && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted">Share leads between</p>
                    <div className="space-y-1.5">
                      {activeUsers.map(u => (
                        <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" className="accent-[var(--c-brand)]" checked={pool.includes(u.id)} onChange={e => setPool(p => (e.target.checked ? [...p, u.id] : p.filter(x => x !== u.id)))} />
                          {u.name} <span className="text-xs capitalize text-muted">{u.role}</span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted">Saving this rule also updates the auto-assign list used when a lead is created{settings.autoAssign ? '.' : ' and switches auto-assign on.'}</p>
                  </div>
                )}
              </>}
              {draft.action === 'tag' && <Field label="Tag to add"><Input value={c.tag ?? ''} onChange={e => cfg({ tag: e.target.value })} placeholder="e.g. urgent" /></Field>}
              {draft.action === 'stage' && (
                <Field label="Move the lead to">
                  <Select value={c.stageId ?? ''} onChange={e => cfg({ stageId: e.target.value })}>
                    <option value="">Choose a stage…</option>
                    {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </Select>
                </Field>
              )}
              {draft.action === 'task' && <>
                <Field label="Task title"><Input value={c.title ?? ''} onChange={e => cfg({ title: e.target.value })} /></Field>
                <Field label="Priority">
                  <Select value={c.priority ?? 'medium'} onChange={e => cfg({ priority: e.target.value })}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
                  </Select>
                </Field>
                <p className="text-xs text-muted">The task goes to the lead’s owner and is due after the waiting time (at least 1 hour).</p>
              </>}
              {draft.action === 'notify' && <>
                <Field label="Who to notify">
                  <Select value={c.userId ?? ''} onChange={e => cfg({ userId: e.target.value })}>
                    <option value="">Whole team</option>
                    {activeUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </Select>
                </Field>
                <Field label="Message (optional)"><Input value={c.message ?? ''} onChange={e => cfg({ message: e.target.value })} placeholder="e.g. A hot lead needs a call" /></Field>
              </>}
              {draft.action === 'email' && (
                <Field label="Email template" hint={emailTemplates.length ? undefined : 'No email templates yet. Create one on the Email page.'}>
                  <Select value={c.emailTemplateId ?? ''} onChange={e => cfg({ emailTemplateId: e.target.value })}>
                    <option value="">Choose a template…</option>
                    {emailTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </Field>
              )}
              {draft.action === 'whatsapp' && (
                <Field label="WhatsApp template" hint="Only approved templates can be sent by WhatsApp.">
                  <Select value={c.templateId ?? ''} onChange={e => cfg({ templateId: e.target.value })}>
                    <option value="">Choose a template…</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.status})</option>)}
                  </Select>
                </Field>
              )}
              {draft.action === 'ai_call' && (
                <Field label="Voice agent" hint={voiceAgents.length ? undefined : 'No voice agents yet. Create one on the Voice agents page.'}>
                  <Select value={c.voiceAgentId ?? ''} onChange={e => cfg({ voiceAgentId: e.target.value })}>
                    <option value="">Choose an agent…</option>
                    {voiceAgents.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </Select>
                </Field>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <span className="text-sm">Rule is switched on</span>
              <Toggle checked={draft.active} onChange={v => patch({ active: v })} label="Rule is switched on" />
            </div>
            <p className={'rounded-lg px-3 py-2 text-xs ' + (runsHere(draft) ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600')}>
              {runsHere(draft)
                ? 'This rule really runs here: it is applied the moment a lead is created (the waiting time only sets the task due date).'
                : 'This rule will be saved and counted, but this browser-only version does not act on it by itself. It needs the server version and the matching connected account.'}
            </p>
            {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
          </div>
        )}
      </Drawer>

      <Confirm open={!!deleting} onClose={() => setDeleting(null)} title="Delete this rule?" confirmLabel="Delete rule"
        onConfirm={() => { if (deleting) useStore.getState().remove('automations', deleting.id); setDeleting(null) }}>
        <p>“{deleting?.name}” will be removed and will stop running. Its run count of {deleting?.runs} is lost.</p>
      </Confirm>

      <Modal open={!!testing} onClose={() => setTesting(null)} title="Test rule on a lead"
        footer={<><Button onClick={() => setTesting(null)}>{testResult ? 'Close' : 'Cancel'}</Button><Button variant="primary" icon={BellRing} disabled={!testLead} onClick={runTest}>{testResult ? 'Run again' : 'Run now'}</Button></>}>
        {testing && (
          <div className="space-y-3">
            <p className="text-sm">This applies <strong>{describe(testing)}</strong> to the lead you choose, right now. It is a real change, not a preview.</p>
            <Field label="Find a lead"><Input value={testQuery} onChange={e => setTestQuery(e.target.value)} placeholder="Type a name or phone number" /></Field>
            <Field label="Lead">
              <Select value={testLead} onChange={e => { setTestLead(e.target.value); setTestResult('') }}>
                <option value="">Choose a lead…</option>
                {testMatches.map(l => <option key={l.id} value={l.id}>{l.name} · {l.phone}</option>)}
              </Select>
            </Field>
            {testResult && <p role="status" className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-600">{testResult}</p>}
          </div>
        )}
      </Modal>
    </div>
  )
}
