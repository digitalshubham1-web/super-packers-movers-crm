import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, ArrowLeft, FileText, Inbox, Link2, Mail, MailOpen, Megaphone, Pencil, PenSquare, Plus, Reply, Search, Send, Trash2, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Email, EmailTemplate, Lead } from '@/lib/types'
import { cn, fmtDateTime, friendlyDay, nowIso, uid } from '@/lib/utils'
import { Badge, Button, Card, DemoNotice, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea, tableCls, tableWrap, tdCls, thCls, trCls } from '@/components/ui'
import { LeadPicker, integrationsLink, useLocalState } from '@/components/calling/shared'

type Folder = Email['folder']
type View = Folder | 'templates' | 'campaigns'
const FOLDERS: { id: Folder; label: string; icon: LucideIcon }[] = [
  { id: 'inbox', label: 'Inbox', icon: Inbox }, { id: 'sent', label: 'Sent', icon: Send }, { id: 'drafts', label: 'Drafts', icon: FileText }, { id: 'archive', label: 'Archive', icon: Archive },
]
interface Draft { id?: string; to: string; subject: string; body: string; leadId?: string }
interface EmailCampaign { id: string; name: string; templateName: string; audience: string; recipients: number; leftOut: number; at: string }
const CAP = 200
const fill = (text: string, name?: string) => text.replace(/\{\{\s*name\s*\}\}/gi, name?.trim() || 'there')

export default function EmailPage() {
  const emails = useStore(s => s.emails)
  const leads = useStore(s => s.leads)
  const businessEmail = useStore(s => s.settings.businessEmail)
  const [view, setView] = useState<View>('inbox')
  const [selId, setSelId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [compose, setCompose] = useState<Draft | null>(null)
  const [del, setDel] = useState<Email | null>(null)
  const [linking, setLinking] = useState(false)
  const { update, remove } = useStore.getState()

  const isFolder = view !== 'templates' && view !== 'campaigns'
  const counts = useMemo(() => Object.fromEntries(FOLDERS.map(f => [f.id, emails.filter(e => e.folder === f.id && (f.id === 'drafts' || !e.read)).length])) as Record<Folder, number>, [emails])
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return emails
      .filter(e => e.folder === view && (!t || [e.from, e.to, e.subject, e.body].some(x => x.toLowerCase().includes(t))))
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [emails, view, q])
  const sel = isFolder ? emails.find(e => e.id === selId && e.folder === view) : undefined
  const selLead = sel?.leadId ? leads.find(l => l.id === sel.leadId) : undefined

  const go = (v: View) => { setView(v); setSelId(null); setQ(''); setLinking(false) }
  const openMail = (e: Email) => {
    if (e.folder === 'drafts') { setCompose({ id: e.id, to: e.to, subject: e.subject, body: e.body, leadId: e.leadId }); return }
    setSelId(e.id); setLinking(false)
    if (!e.read) update('emails', e.id, { read: true })
  }
  const replyTo = (e: Email) => {
    const other = e.folder === 'sent' ? e.to : e.from
    setCompose({ to: other, subject: /^re:/i.test(e.subject) ? e.subject : `Re: ${e.subject}`, body: `\n\n--- On ${fmtDateTime(e.at)}, ${e.from} wrote ---\n${e.body}`, leadId: e.leadId })
  }

  return (
    <div>
      <PageHeader title="Email" subtitle={`Mail for ${businessEmail}`} icon={Mail} actions={<Button variant="primary" icon={PenSquare} onClick={() => setCompose({ to: '', subject: '', body: '' })}>Compose</Button>} />
      <DemoNotice>
        No mailbox is connected. Emails you send here, including campaigns, are saved in “Sent” and on the lead's timeline but are NOT delivered to the customer, and new incoming mail does not arrive — the Inbox shows sample messages.
        Connect a mailbox (Gmail, Outlook or SMTP/IMAP) under {integrationsLink} to send and receive for real; that connection is not available in this version.
      </DemoNotice>

      <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className={cn('space-y-1', sel && 'hidden lg:block')}>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {FOLDERS.map(f => (
              <NavBtn key={f.id} active={view === f.id} icon={f.icon} label={f.label} count={counts[f.id]} onClick={() => go(f.id)} />
            ))}
            <div className="col-span-full my-1 hidden border-t border-border lg:block" />
            <NavBtn active={view === 'templates'} icon={FileText} label="Templates" onClick={() => go('templates')} />
            <NavBtn active={view === 'campaigns'} icon={Megaphone} label="Campaigns" onClick={() => go('campaigns')} />
          </div>
        </nav>

        {view === 'templates' && <Templates />}
        {view === 'campaigns' && <Campaigns />}
        {isFolder && (
          <div className="grid min-w-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Card className={cn('min-w-0 self-start overflow-hidden', sel && 'hidden lg:block')}>
              <div className="relative border-b border-border p-2">
                <Search size={14} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted" />
                <Input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${view}`} className="pl-8" />
              </div>
              {list.length === 0 ? (
                <EmptyState icon={Mail} title={q ? 'No messages match' : `Nothing in ${FOLDERS.find(f => f.id === view)?.label}`} action={<Button variant="primary" icon={PenSquare} onClick={() => setCompose({ to: '', subject: '', body: '' })}>Compose</Button>} />
              ) : (
                <ul className="max-h-[70vh] overflow-y-auto">
                  {list.map(e => {
                    const outgoing = e.folder === 'sent' || e.folder === 'drafts'
                    return (
                      <li key={e.id}>
                        <button type="button" onClick={() => openMail(e)} className={cn('block w-full cursor-pointer border-b border-border px-3 py-2.5 text-left hover:bg-surface-2', selId === e.id && 'bg-brand-soft')}>
                          <span className="flex items-center justify-between gap-2">
                            <span className={cn('flex min-w-0 items-center gap-1.5 truncate text-sm', !e.read ? 'font-semibold' : 'text-muted')}>
                              {!e.read && <span className="size-2 shrink-0 rounded-full bg-brand" />}
                              <span className="truncate">{outgoing ? `To: ${e.to || '(no recipient)'}` : e.from}</span>
                            </span>
                            <span className="shrink-0 text-[11px] text-muted">{friendlyDay(e.at)}</span>
                          </span>
                          <span className={cn('mt-0.5 block truncate text-sm', !e.read && 'font-semibold')}>{e.subject || '(no subject)'}</span>
                          <span className="block truncate text-xs text-muted">{e.body.replace(/\s+/g, ' ').slice(0, 90)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>

            <Card className={cn('min-w-0 self-start', !sel && 'hidden lg:block')}>
              {!sel ? (
                <EmptyState icon={MailOpen} title="Select a message" text={view === 'drafts' ? 'Click a draft to continue writing it.' : 'Pick a message from the list to read it here.'} />
              ) : (
                <div>
                  <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
                    <Button size="sm" variant="ghost" icon={ArrowLeft} className="lg:hidden" onClick={() => setSelId(null)}>Back</Button>
                    <Button size="sm" icon={Reply} onClick={() => replyTo(sel)}>Reply</Button>
                    {sel.folder !== 'archive'
                      ? <Button size="sm" icon={Archive} onClick={() => { update('emails', sel.id, { folder: 'archive' }); setSelId(null) }}>Archive</Button>
                      : <Button size="sm" icon={Inbox} onClick={() => { update('emails', sel.id, { folder: sel.from === businessEmail ? 'sent' : 'inbox' }); setSelId(null) }}>Move back</Button>}
                    <Button size="sm" icon={Mail} onClick={() => { update('emails', sel.id, { read: false }); setSelId(null) }}>Mark unread</Button>
                    <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDel(sel)}>Delete</Button>
                  </div>
                  <div className="p-4">
                    <h2 className="text-base font-semibold">{sel.subject || '(no subject)'}</h2>
                    <p className="mt-1 break-all text-xs text-muted">From {sel.from} · To {sel.to} · {fmtDateTime(sel.at)}</p>
                    {sel.folder === 'sent' && <p className="mt-2"><Badge tone="warn">Recorded only — not delivered (no mailbox connected)</Badge></p>}
                    <div className="mt-3 rounded-lg bg-surface-2 p-3 text-xs">
                      {selLead ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Link2 size={14} className="text-muted" />
                          <span className="text-muted">Linked lead:</span>
                          <Link to={`/leads/${selLead.id}`} className="font-medium text-brand hover:underline">{selLead.name} · #{selLead.no}</Link>
                          <button type="button" className="ml-auto cursor-pointer text-muted hover:text-text" onClick={() => update('emails', sel.id, { leadId: undefined })}>Unlink</button>
                        </div>
                      ) : linking ? (
                        <div>
                          <div className="mb-2 flex items-center justify-between"><span className="font-medium">Link to lead</span><button type="button" aria-label="Close" className="cursor-pointer" onClick={() => setLinking(false)}><X size={14} /></button></div>
                          <LeadPicker onPick={l => { update('emails', sel.id, { leadId: l.id }); setLinking(false) }} />
                        </div>
                      ) : (
                        <button type="button" className="inline-flex cursor-pointer items-center gap-2 font-medium text-brand hover:underline" onClick={() => setLinking(true)}><Link2 size={14} />Link to lead</button>
                      )}
                    </div>
                    <div className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed">{sel.body}</div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {compose && <Compose draft={compose} onClose={() => setCompose(null)} onDone={f => { setCompose(null); go(f) }} />}
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete this email?" footer={<><Button onClick={() => setDel(null)}>Keep</Button><Button variant="danger" onClick={() => { if (del) remove('emails', del.id); setDel(null); setSelId(null) }}>Delete</Button></>}>
        <p className="text-sm text-muted">“{del?.subject || '(no subject)'}” will be removed for good.</p>
      </Modal>
    </div>
  )
}

function NavBtn({ active, icon: Icon, label, count, onClick }: { active: boolean; icon: LucideIcon; label: string; count?: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm', active ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:bg-surface-2 hover:text-text')}>
      <Icon size={16} />
      <span className="truncate">{label}</span>
      {!!count && <span className="ml-auto rounded-full bg-surface-2 px-1.5 text-[11px] font-medium text-text">{count}</span>}
    </button>
  )
}

function Compose({ draft, onClose, onDone }: { draft: Draft; onClose: () => void; onDone: (folder: Folder) => void }) {
  const leads = useStore(s => s.leads)
  const templates = useStore(s => s.emailTemplates)
  const businessEmail = useStore(s => s.settings.businessEmail)
  const [to, setTo] = useState(draft.to)
  const [subject, setSubject] = useState(draft.subject)
  const [body, setBody] = useState(draft.body)
  const [leadId, setLeadId] = useState(draft.leadId)
  const [tplId, setTplId] = useState('')
  const lead = leads.find(l => l.id === leadId)
  const validTo = /^\S+@\S+\.\S+$/.test(to.trim())

  const pickLead = (l: Lead) => { setLeadId(l.id); setTo(l.email ?? '') }
  const useTemplate = (id: string) => {
    setTplId(id)
    const t = templates.find(x => x.id === id)
    if (!t) return
    const name = lead?.name ?? leads.find(l => l.email && l.email.toLowerCase() === to.trim().toLowerCase())?.name
    setSubject(fill(t.subject, name)); setBody(fill(t.body, name))
  }
  const save = (folder: 'sent' | 'drafts') => {
    const { add, update, log } = useStore.getState()
    const linked = leadId ?? leads.find(l => l.email && l.email.toLowerCase() === to.trim().toLowerCase())?.id
    const data = { folder, from: businessEmail, to: to.trim(), subject: subject.trim(), body, at: nowIso(), read: true, leadId: linked }
    if (draft.id) update('emails', draft.id, data)
    else add('emails', data)
    if (folder === 'sent') log('email', `Email recorded (not delivered — no mailbox connected): ${subject.trim() || '(no subject)'} → ${to.trim()}`, linked)
    onDone(folder)
  }

  return (
    <Modal open onClose={onClose} wide title={draft.id ? 'Edit draft' : 'New email'} footer={<>
      <Button onClick={onClose}>Discard changes</Button>
      <Button disabled={!to.trim() && !subject.trim() && !body.trim()} onClick={() => save('drafts')}>Save draft</Button>
      <Button variant="primary" icon={Send} disabled={!validTo || !subject.trim()} onClick={() => save('sent')}>Send</Button>
    </>}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="To" hint={to.trim() && !validTo ? 'Enter a full email address.' : undefined}><Input type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="customer@example.com" /></Field>
          <Field label="Or pick a lead with an email"><LeadPicker onlyWithEmail onPick={pickLead} placeholder="Search leads" /></Field>
        </div>
        {lead && (
          <p className="flex items-center gap-2 rounded-lg bg-brand-soft px-3 py-1.5 text-xs text-brand">
            <Link2 size={13} />Linked to {lead.name} · #{lead.no}
            <button type="button" aria-label="Remove link" className="ml-auto cursor-pointer" onClick={() => setLeadId(undefined)}><X size={13} /></button>
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
          <Field label="Subject"><Input value={subject} onChange={e => setSubject(e.target.value)} /></Field>
          <Field label="Use template">
            <Select value={tplId} onChange={e => useTemplate(e.target.value)}>
              <option value="">Choose a template…</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Message"><Textarea className="min-h-56" value={body} onChange={e => setBody(e.target.value)} /></Field>
        <p className="text-xs text-muted">Send saves this email in “Sent” and on the lead's timeline. It is not delivered until a mailbox is connected.</p>
      </div>
    </Modal>
  )
}

function Templates() {
  const templates = useStore(s => s.emailTemplates)
  const [edit, setEdit] = useState<EmailTemplate | 'new' | null>(null)
  const [f, setF] = useState({ name: '', subject: '', body: '' })
  const [del, setDel] = useState<EmailTemplate | null>(null)
  const { add, update, remove } = useStore.getState()
  const open = (t: EmailTemplate | 'new') => { setF(t === 'new' ? { name: '', subject: '', body: 'Hi {{name}},\n\n\n\nRegards,\nSuper Packers and Movers' } : { name: t.name, subject: t.subject, body: t.body }); setEdit(t) }
  const save = () => {
    const data = { name: f.name.trim(), subject: f.subject.trim(), body: f.body }
    if (edit === 'new') add('emailTemplates', data)
    else if (edit) update('emailTemplates', edit.id, data)
    setEdit(null)
  }
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">Reusable emails. <code className="rounded bg-surface-2 px-1">{'{{name}}'}</code> is replaced with the lead's name.</p>
        <Button variant="primary" size="sm" icon={Plus} onClick={() => open('new')}>New template</Button>
      </div>
      {templates.length === 0 ? (
        <Card><EmptyState icon={FileText} title="No templates yet" text="Save the emails you write again and again." action={<Button variant="primary" icon={Plus} onClick={() => open('new')}>New template</Button>} /></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map(t => (
            <Card key={t.id} title={t.name} action={<span className="flex gap-1"><Button size="sm" variant="ghost" icon={Pencil} onClick={() => open(t)}>Edit</Button><Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDel(t)} aria-label="Delete template" /></span>}>
              <div className="p-4">
                <p className="text-sm font-medium">{t.subject}</p>
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-muted">{t.body}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'New template' : 'Edit template'} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" disabled={!f.name.trim() || !f.subject.trim() || !f.body.trim()} onClick={save}>Save template</Button></>}>
        <div className="space-y-3">
          <Field label="Template name"><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Survey confirmation" /></Field>
          <Field label="Subject"><Input value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} /></Field>
          <Field label="Body" hint="Write {{name}} where the customer's name should go."><Textarea className="min-h-48" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} /></Field>
        </div>
      </Modal>
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete template?" footer={<><Button onClick={() => setDel(null)}>Keep</Button><Button variant="danger" onClick={() => { if (del) remove('emailTemplates', del.id); setDel(null) }}>Delete</Button></>}>
        <p className="text-sm text-muted">“{del?.name}” will be removed. Emails already saved are not changed.</p>
      </Modal>
    </div>
  )
}

function Campaigns() {
  const leads = useStore(s => s.leads)
  const stages = useStore(s => s.stages)
  const sources = useStore(s => s.sources)
  const templates = useStore(s => s.emailTemplates)
  const businessEmail = useStore(s => s.settings.businessEmail)
  const currentUserId = useStore(s => s.currentUserId)
  const [campaigns, setCampaigns] = useLocalState<EmailCampaign[]>('spm-email-campaigns', [])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [tplId, setTplId] = useState('')
  const [stageId, setStageId] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [result, setResult] = useState<EmailCampaign | null>(null)
  const [del, setDel] = useState<EmailCampaign | null>(null)

  const matched = useMemo(() => leads.filter(l => (!stageId || l.stageId === stageId) && (!sourceId || l.sourceId === sourceId)), [leads, stageId, sourceId])
  const withEmail = useMemo(() => matched.filter(l => !!l.email), [matched])
  const tpl = templates.find(t => t.id === tplId)
  const sendCount = Math.min(withEmail.length, CAP)
  const start = () => { setName(''); setTplId(templates[0]?.id ?? ''); setStageId(''); setSourceId(''); setResult(null); setOpen(true) }

  const send = () => {
    if (!tpl || !sendCount) return
    const at = nowIso()
    const targets = withEmail.slice(0, CAP)
    const newEmails: Email[] = targets.map(l => ({ id: uid(), folder: 'sent', from: businessEmail, to: l.email as string, subject: fill(tpl.subject, l.name), body: fill(tpl.body, l.name), at, read: true, leadId: l.id }))
    const acts = targets.map(l => ({ id: uid(), type: 'email' as const, text: `Campaign “${name.trim()}” email recorded (not delivered — no mailbox connected): ${fill(tpl.subject, l.name)}`, leadId: l.id, userId: currentUserId, at }))
    useStore.setState(s => ({ emails: [...newEmails, ...s.emails], activities: [...acts, ...s.activities] }))
    const audience = [stages.find(s => s.id === stageId)?.label ?? 'Any stage', sources.find(s => s.id === sourceId)?.label ?? 'Any source'].join(' · ')
    const rec: EmailCampaign = { id: uid(), name: name.trim(), templateName: tpl.name, audience, recipients: targets.length, leftOut: matched.length - targets.length, at }
    setCampaigns(c => [rec, ...c])
    setResult(rec)
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">Send one template to many leads at once (up to {CAP} per campaign).</p>
        <Button variant="primary" size="sm" icon={Plus} onClick={start}>New campaign</Button>
      </div>
      {campaigns.length === 0 ? (
        <Card><EmptyState icon={Megaphone} title="No email campaigns yet" text="Pick a template and an audience by stage or source." action={<Button variant="primary" icon={Plus} onClick={start}>New campaign</Button>} /></Card>
      ) : (
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead><tr>{['Campaign', 'Template', 'Audience', 'Emails recorded', 'Left out', 'Sent on', ''].map(h => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id} className={trCls}>
                  <td className={tdCls + ' whitespace-nowrap font-medium'}>{c.name}</td>
                  <td className={tdCls + ' whitespace-nowrap'}>{c.templateName}</td>
                  <td className={tdCls + ' whitespace-nowrap text-xs text-muted'}>{c.audience}</td>
                  <td className={tdCls}><Badge tone="warn">{c.recipients} · not delivered</Badge></td>
                  <td className={tdCls + ' text-xs text-muted'}>{c.leftOut}</td>
                  <td className={tdCls + ' whitespace-nowrap text-xs text-muted'}>{fmtDateTime(c.at)}</td>
                  <td className={tdCls}><Button size="sm" variant="ghost" icon={Trash2} aria-label="Delete campaign" onClick={() => setDel(c)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={result ? 'Campaign result' : 'New email campaign'} footer={result
        ? <Button variant="primary" onClick={() => setOpen(false)}>Done</Button>
        : <><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" icon={Send} disabled={!name.trim() || !tpl || !sendCount} onClick={send}>Send to {sendCount} lead{sendCount === 1 ? '' : 's'}</Button></>}>
        {result ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium">“{result.name}” finished.</p>
            <ul className="list-disc space-y-1 pl-5 text-muted">
              <li><span className="font-medium text-text">{result.recipients}</span> emails saved in “Sent” and on each lead's timeline.</li>
              <li><span className="font-medium text-text">{result.leftOut}</span> matching leads left out (no email address, or over the {CAP} limit).</li>
              <li>Nothing was delivered to customers: no mailbox is connected.</li>
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Campaign name"><Input value={name} onChange={e => setName(e.target.value)} placeholder="Diwali shifting offer" autoFocus /></Field>
            <Field label="Template" hint={templates.length ? undefined : 'Create a template first in the Templates view.'}>
              <Select value={tplId} onChange={e => setTplId(e.target.value)}><option value="">Choose a template…</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Stage"><Select value={stageId} onChange={e => setStageId(e.target.value)}><option value="">Any stage</option>{stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
              <Field label="Source"><Select value={sourceId} onChange={e => setSourceId(e.target.value)}><option value="">Any source</option>{sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
            </div>
            <div className="rounded-lg bg-surface-2 p-3 text-sm">
              <span className="text-lg font-semibold">{withEmail.length}</span> of {matched.length} matching leads have an email address
              {withEmail.length > CAP && <p className="text-xs text-amber-600">Only the first {CAP} will be included.</p>}
            </div>
            {tpl && <div className="rounded-lg border border-border p-3 text-xs"><p className="font-medium">{fill(tpl.subject, withEmail[0]?.name)}</p><p className="mt-1 line-clamp-4 whitespace-pre-wrap text-muted">{fill(tpl.body, withEmail[0]?.name)}</p></div>}
          </div>
        )}
      </Modal>
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete campaign record?" footer={<><Button onClick={() => setDel(null)}>Keep</Button><Button variant="danger" onClick={() => { setCampaigns(c => c.filter(x => x.id !== del?.id)); setDel(null) }}>Delete</Button></>}>
        <p className="text-sm text-muted">Removes “{del?.name}” from this list. The emails saved in “Sent” stay.</p>
      </Modal>
    </div>
  )
}
