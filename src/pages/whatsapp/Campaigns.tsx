import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, CalendarClock, Check, Eye, Megaphone, Plus, Send, Trash2, Undo2, Users } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn, fmtDate, fmtDateTime, friendlyDay, nowIso, toLocalInput } from '@/lib/utils'
import type { Lead, WaCampaign } from '@/lib/types'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Tabs, tableCls, tableWrap, tdCls, thCls, trCls } from '@/components/ui'
import { OPT_OUT_NUMBERS_KEY, PhonePreview, digits, fillTemplate, readLocal, sampleFor, templateVars } from '@/components/whatsapp/helpers'

type TabId = 'all' | 'live' | 'scheduled' | 'draft' | 'completed' | 'failed'
type AudienceKind = 'all' | 'stage' | 'source' | 'tag'
const statusTone = { draft: 'neutral', scheduled: 'info', live: 'warn', completed: 'good', failed: 'bad' } as const
const statusLabel = { draft: 'Draft', scheduled: 'Scheduled', live: 'Sending', completed: 'Completed', failed: 'Failed' } as const
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

/** Fills the result numbers with plausible made-up values. Nothing is delivered. */
function finishSimulated(id: string) {
  const s = useStore.getState()
  const c = s.waCampaigns.find(x => x.id === id)
  if (!c || c.status === 'completed') return
  const r = (lo: number, hi: number) => lo + Math.random() * (hi - lo)
  const sent = c.recipients
  const delivered = Math.round(sent * r(0.92, 0.98))
  const read = Math.round(delivered * r(0.6, 0.8))
  const replied = Math.round(read * r(0.08, 0.18))
  s.update('waCampaigns', id, { status: 'completed', sent, delivered, read, replied })
  s.update('templates', c.templateId, { lastUsedAt: nowIso() })
  s.notify('Campaign finished (simulated)', `${c.name}: ${sent} messages marked as sent`, '/whatsapp/campaigns')
}
function sendNow(id: string) {
  const s = useStore.getState()
  const c = s.waCampaigns.find(x => x.id === id)
  if (!c) return
  if (c.recipients === 0) { s.update('waCampaigns', id, { status: 'failed', scheduledAt: undefined }); return }
  s.update('waCampaigns', id, { status: 'live', scheduledAt: undefined, sent: 0, delivered: 0, read: 0, replied: 0 })
  setTimeout(() => finishSimulated(id), 2000)
}

export default function Campaigns() {
  const campaigns = useStore(s => s.waCampaigns)
  const templates = useStore(s => s.templates)
  const [tab, setTab] = useState<TabId>('all')
  const [wizard, setWizard] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<WaCampaign | null>(null)

  const counts = useMemo(() => {
    const c: Record<TabId, number> = { all: campaigns.length, live: 0, scheduled: 0, draft: 0, completed: 0, failed: 0 }
    campaigns.forEach(x => { c[x.status]++ })
    return c
  }, [campaigns])
  const rows = useMemo(() => campaigns.filter(c => tab === 'all' || c.status === tab).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [campaigns, tab])
  const detail = campaigns.find(c => c.id === detailId)
  const tplName = (id: string) => templates.find(t => t.id === id)?.name ?? 'Deleted template'
  const { update, remove } = useStore.getState()

  return (
    <div>
      <PageHeader
        title="Campaigns"
        subtitle="Send one approved template to many leads at once"
        icon={Megaphone}
        actions={<Button variant="primary" icon={Plus} onClick={() => setWizard(true)}>New campaign</Button>}
      />
      <Tabs<TabId>
        className="mb-3"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'all', label: 'All', count: counts.all }, { id: 'live', label: 'Live', count: counts.live }, { id: 'scheduled', label: 'Scheduled', count: counts.scheduled },
          { id: 'draft', label: 'Drafts', count: counts.draft }, { id: 'completed', label: 'Completed', count: counts.completed }, { id: 'failed', label: 'Failed', count: counts.failed },
        ]}
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Megaphone}
            title={campaigns.length ? 'No campaigns in this tab' : 'No campaigns yet'}
            text="Pick a template and an audience, then send now or schedule it."
            action={<Button variant="primary" icon={Plus} onClick={() => setWizard(true)}>New campaign</Button>}
          />
        </Card>
      ) : (
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead>
              <tr>{['Campaign', 'Template', 'Audience', 'Recipients', 'Delivered', 'Read', 'Replied', 'Status', ''].map(h => <th key={h} className={thCls}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(c => (
                <tr key={c.id} className={trCls}>
                  <td className={tdCls}>
                    <button onClick={() => setDetailId(c.id)} className="cursor-pointer text-left font-medium hover:text-brand">{c.name}</button>
                    <div className="whitespace-nowrap text-xs text-muted">{c.status === 'scheduled' && c.scheduledAt ? `Sends ${friendlyDay(c.scheduledAt)}` : `Created ${fmtDate(c.createdAt)}`}</div>
                  </td>
                  <td className={cn(tdCls, 'font-mono text-xs')}>{tplName(c.templateId)}</td>
                  <td className={cn(tdCls, 'whitespace-nowrap')}>{c.audience}</td>
                  <td className={tdCls}>{c.recipients.toLocaleString('en-IN')}</td>
                  <td className={tdCls}>{c.sent ? `${c.delivered} (${pct(c.delivered, c.sent)}%)` : '—'}</td>
                  <td className={tdCls}>{c.sent ? `${c.read} (${pct(c.read, c.sent)}%)` : '—'}</td>
                  <td className={tdCls}>{c.sent ? `${c.replied} (${pct(c.replied, c.sent)}%)` : '—'}</td>
                  <td className={tdCls}><Badge tone={statusTone[c.status]}>{statusLabel[c.status]}</Badge></td>
                  <td className={tdCls}>
                    <div className="flex items-center justify-end gap-1">
                      {(c.status === 'draft' || c.status === 'scheduled' || c.status === 'failed') && <Button size="sm" icon={Send} disabled={c.recipients === 0} onClick={() => sendNow(c.id)}>Send now</Button>}
                      {c.status === 'scheduled' && <Button size="sm" variant="ghost" icon={Undo2} onClick={() => update('waCampaigns', c.id, { status: 'draft', scheduledAt: undefined })}>Cancel schedule</Button>}
                      {c.status === 'live' && <Button size="sm" icon={Check} onClick={() => finishSimulated(c.id)}>Finish now (simulated)</Button>}
                      <Button size="sm" variant="ghost" icon={Eye} onClick={() => setDetailId(c.id)} aria-label={`View ${c.name}`} title="View details" />
                      <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDeleting(c)} aria-label={`Delete ${c.name}`} title="Delete" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">Delivered, read and replied figures are simulated. Real figures appear once a WhatsApp Business API number is connected.</p>

      {wizard && <Wizard onClose={() => setWizard(false)} onCreated={c => { setWizard(false); setTab('all'); setDetailId(c.id) }} />}
      {detail && <Detail c={detail} templateName={tplName(detail.templateId)} templateBody={templates.find(t => t.id === detail.templateId)?.body} onClose={() => setDetailId(null)} onDelete={() => { setDetailId(null); setDeleting(detail) }} />}

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete campaign?"
        footer={<><Button onClick={() => setDeleting(null)}>Keep it</Button><Button variant="danger" icon={Trash2} onClick={() => { if (deleting) remove('waCampaigns', deleting.id); setDeleting(null) }}>Delete</Button></>}
      >
        <p className="text-sm">“{deleting?.name}” and its results will be removed.{deleting?.status === 'scheduled' ? ' It will not be sent.' : ''}</p>
      </Modal>
    </div>
  )
}

function Detail({ c, templateName, templateBody, onClose, onDelete }: { c: WaCampaign; templateName: string; templateBody?: string; onClose: () => void; onDelete: () => void }) {
  const hasResults = c.status === 'completed'
  const funnel = [
    { label: 'Recipients', value: c.recipients, of: c.recipients },
    { label: 'Sent', value: c.sent, of: c.recipients },
    { label: 'Delivered', value: c.delivered, of: c.recipients },
    { label: 'Read', value: c.read, of: c.recipients },
    { label: 'Replied', value: c.replied, of: c.recipients },
  ]
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={c.name}
      footer={
        <>
          <Button variant="ghost" icon={Trash2} onClick={onDelete}>Delete</Button>
          {c.status === 'scheduled' && <Button icon={Undo2} onClick={() => useStore.getState().update('waCampaigns', c.id, { status: 'draft', scheduledAt: undefined })}>Cancel schedule</Button>}
          {(c.status === 'draft' || c.status === 'scheduled' || c.status === 'failed') && <Button variant="primary" icon={Send} disabled={c.recipients === 0} onClick={() => sendNow(c.id)}>Send now</Button>}
          {c.status === 'live' && <Button variant="primary" icon={Check} onClick={() => finishSimulated(c.id)}>Finish now (simulated)</Button>}
          {hasResults && <Button onClick={onClose}>Close</Button>}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <Badge tone={statusTone[c.status]}>{statusLabel[c.status]}</Badge>
          <span>Template <span className="font-mono text-text">{templateName}</span></span>
          <span>· Audience <span className="text-text">{c.audience}</span></span>
          <span>· Created {fmtDateTime(c.createdAt)}</span>
          {c.scheduledAt && c.status === 'scheduled' && <span>· Sends {fmtDateTime(c.scheduledAt)}</span>}
        </div>
        {c.status === 'live' && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">Sending is being simulated. Results appear in a couple of seconds.</p>}
        {c.status === 'failed' && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600">This campaign did not go out{c.recipients === 0 ? ' because the audience had no recipients' : ''}.</p>}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {funnel.map(f => (
            <div key={f.label} className="rounded-lg border border-border p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{f.label}</p>
              <p className="text-xl font-semibold">{f.value.toLocaleString('en-IN')}</p>
              <p className="text-[11px] text-muted">{f.label === 'Recipients' ? 'in audience' : `${pct(f.value, f.of)}% of audience`}</p>
            </div>
          ))}
        </div>

        <div>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted"><BarChart3 size={14} /> Funnel {hasResults && <Badge tone="warn">Simulated numbers</Badge>}</h4>
          <div className="space-y-2">
            {funnel.map(f => (
              <div key={f.label} className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-2 text-xs">
                <span className="text-muted">{f.label}</span>
                <span className="h-4 overflow-hidden rounded bg-surface-2"><span className="block h-full rounded bg-brand transition-all" style={{ width: `${pct(f.value, f.of)}%` }} /></span>
                <span className="text-right font-medium tabular-nums">{f.value.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
          {!hasResults && c.status !== 'live' && <p className="mt-2 text-xs text-muted">Results fill in after the campaign is sent.</p>}
        </div>

        {templateBody && (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Message</h4>
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm whitespace-pre-wrap">{templateBody}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}

function Wizard({ onClose, onCreated }: { onClose: () => void; onCreated: (c: WaCampaign) => void }) {
  const templates = useStore(s => s.templates)
  const leads = useStore(s => s.leads)
  const stages = useStore(s => s.stages)
  const sources = useStore(s => s.sources)
  const approved = useMemo(() => templates.filter(t => t.status === 'approved'), [templates])
  const tags = useMemo(() => [...new Set(leads.flatMap(l => l.tags))].sort(), [leads])
  const optedOut = useMemo(() => new Set(readLocal<string[]>(OPT_OUT_NUMBERS_KEY, []).map(digits)), [])

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [templateId, setTemplateId] = useState(approved[0]?.id ?? '')
  const [kind, setKind] = useState<AudienceKind>('all')
  const [stageId, setStageId] = useState(stages[0]?.id ?? '')
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? '')
  const [tag, setTag] = useState(tags[0] ?? '')
  const [when, setWhen] = useState<'now' | 'later'>('now')
  const [at, setAt] = useState(toLocalInput(new Date(Date.now() + 86400000).toISOString()))

  const tpl = approved.find(t => t.id === templateId)
  const matched = useMemo(() => {
    const match = (l: Lead) => (kind === 'all' ? true : kind === 'stage' ? l.stageId === stageId : kind === 'source' ? l.sourceId === sourceId : l.tags.includes(tag))
    return leads.filter(match)
  }, [leads, kind, stageId, sourceId, tag])
  const recipients = useMemo(() => matched.filter(l => !optedOut.has(digits(l.phone))), [matched, optedOut])
  const skipped = matched.length - recipients.length
  const audience =
    kind === 'all' ? 'All leads'
    : kind === 'stage' ? `Stage: ${stages.find(s => s.id === stageId)?.label ?? '—'}`
    : kind === 'source' ? `Source: ${sources.find(s => s.id === sourceId)?.label ?? '—'}`
    : `Tag: ${tag || '—'}`
  const atOk = when === 'now' || (!!at && new Date(at).getTime() > Date.now())

  const stepOk = [name.trim().length > 0, !!tpl, recipients.length > 0, atOk][step]
  const titles = ['Name', 'Template', 'Audience', 'Send time']

  const create = (mode: 'send' | 'draft') => {
    if (!tpl) return
    const s = useStore.getState()
    const c = s.add('waCampaigns', {
      name: name.trim(), templateId: tpl.id, audience, recipients: recipients.length, sent: 0, delivered: 0, read: 0, replied: 0,
      status: mode === 'draft' ? 'draft' : when === 'later' ? 'scheduled' : 'draft',
      scheduledAt: mode === 'send' && when === 'later' ? new Date(at).toISOString() : undefined, createdAt: nowIso(),
    })
    if (mode === 'send' && when === 'now') sendNow(c.id)
    onCreated(c)
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`New campaign · Step ${step + 1} of 4: ${titles[step]}`}
      footer={
        <>
          {step === 3 && <Button className="mr-auto" variant="ghost" disabled={!tpl || !name.trim()} onClick={() => create('draft')}>Save as draft</Button>}
          {step === 0 ? <Button onClick={onClose}>Cancel</Button> : <Button onClick={() => setStep(step - 1)}>Back</Button>}
          {step < 3
            ? <Button variant="primary" disabled={!stepOk} onClick={() => setStep(step + 1)}>Next</Button>
            : <Button variant="primary" icon={when === 'now' ? Send : CalendarClock} disabled={!stepOk || !tpl || recipients.length === 0} onClick={() => create('send')}>{when === 'now' ? `Send to ${recipients.length} leads` : 'Schedule campaign'}</Button>}
        </>
      }
    >
      <ol className="mb-5 flex gap-1.5">
        {titles.map((t, i) => (
          <li key={t} className="flex-1">
            <span className={cn('block h-1 rounded-full', i <= step ? 'bg-brand' : 'bg-surface-2')} />
            <span className={cn('mt-1 block text-[11px]', i === step ? 'font-semibold text-text' : 'text-muted')}>{t}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Field label="Campaign name" hint="Only your team sees this name.">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Year-end shifting offer" autoFocus onKeyDown={e => { if (e.key === 'Enter' && name.trim()) setStep(1) }} />
        </Field>
      )}

      {step === 1 && (approved.length === 0 ? (
        <EmptyState icon={Megaphone} title="No approved templates" text="A campaign can only send an approved template." action={<Link to="/whatsapp/templates"><Button size="sm">Open templates</Button></Link>} />
      ) : (
        <div className="grid gap-5 md:grid-cols-[1fr_260px]">
          <div className="space-y-2">
            {approved.map(t => (
              <button key={t.id} onClick={() => setTemplateId(t.id)} className={cn('block w-full cursor-pointer rounded-lg border p-3 text-left', templateId === t.id ? 'border-brand bg-brand-soft' : 'border-border hover:bg-surface-2')}>
                <span className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-semibold">{t.name}</span><Badge>{t.category.toLowerCase()}</Badge><Badge>{t.language}</Badge></span>
                <span className="mt-1 line-clamp-2 block text-xs text-muted">{t.body}</span>
              </button>
            ))}
          </div>
          {tpl && (
            <div>
              <span className="mb-2 block text-center text-xs font-medium text-muted">Preview with sample values</span>
              <PhonePreview text={fillTemplate(tpl.body, Object.fromEntries(templateVars(tpl.body).map(n => [n, sampleFor(n)])))} />
              <p className="mt-2 text-center text-[11px] text-muted">{'{{1}}'} is filled with each lead’s first name.</p>
            </div>
          )}
        </div>
      ))}

      {step === 2 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([['all', 'All leads'], ['stage', 'By stage'], ['source', 'By source'], ['tag', 'By tag']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setKind(id)} className={cn('cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium', kind === id ? 'border-brand bg-brand-soft text-brand' : 'border-border text-muted hover:text-text')}>{label}</button>
            ))}
          </div>
          {kind === 'stage' && <Field label="Stage"><Select value={stageId} onChange={e => setStageId(e.target.value)}>{stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>}
          {kind === 'source' && <Field label="Source"><Select value={sourceId} onChange={e => setSourceId(e.target.value)}>{sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>}
          {kind === 'tag' && (tags.length
            ? <Field label="Tag"><Select value={tag} onChange={e => setTag(e.target.value)}>{tags.map(t => <option key={t}>{t}</option>)}</Select></Field>
            : <p className="text-xs text-muted">No lead has a tag yet.</p>)}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 p-4">
            <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand"><Users size={18} /></span>
            <div>
              <p className="text-2xl font-semibold leading-tight">{recipients.length.toLocaleString('en-IN')}</p>
              <p className="text-xs text-muted">{recipients.length === 1 ? 'lead' : 'leads'} will receive this · {audience}{skipped > 0 ? ` · ${skipped} skipped (opted out)` : ''}</p>
            </div>
          </div>
          {recipients.length === 0 && <p className="text-xs text-rose-600">This audience is empty. Choose another one.</p>}
          {recipients.length > 0 && <p className="truncate text-xs text-muted">Includes: {recipients.slice(0, 5).map(l => l.name).join(', ')}{recipients.length > 5 ? ` and ${recipients.length - 5} more` : ''}</p>}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {([['now', 'Send now', 'Starts as soon as you confirm.', Send], ['later', 'Schedule', 'Pick a date and time.', CalendarClock]] as const).map(([id, label, text, Icon]) => (
              <button key={id} onClick={() => setWhen(id)} className={cn('flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-left', when === id ? 'border-brand bg-brand-soft' : 'border-border hover:bg-surface-2')}>
                <Icon size={16} className="mt-0.5 text-brand" />
                <span><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted">{text}</span></span>
              </button>
            ))}
          </div>
          {when === 'later' && (
            <Field label="Send at" hint={!atOk ? 'Choose a time in the future.' : 'In this version a scheduled campaign waits until you press “Send now”.'}>
              <Input type="datetime-local" value={at} min={toLocalInput(nowIso())} onChange={e => setAt(e.target.value)} />
            </Field>
          )}
          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Summary</p>
            <p><span className="text-muted">Name:</span> {name}</p>
            <p><span className="text-muted">Template:</span> <span className="font-mono text-xs">{tpl?.name}</span></p>
            <p><span className="text-muted">Audience:</span> {audience} ({recipients.length} leads)</p>
          </div>
          <p className="text-xs text-amber-600">Sending is simulated: no customer receives a message, and the delivered, read and replied numbers are made up.</p>
        </div>
      )}
    </Modal>
  )
}
