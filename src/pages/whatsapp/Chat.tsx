import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, isToday, isYesterday } from 'date-fns'
import { AlertCircle, ArrowLeft, Bot, Check, CheckCheck, ExternalLink, FileText, Flag, Hand, MessageCircle, MessageSquarePlus, Plus, Search, Send, Sparkles, UserPlus, Zap } from 'lucide-react'
import { useCurrentUser, useStore } from '@/lib/store'
import { cn, fmtDate, fmtTime, nowIso, timeAgo } from '@/lib/utils'
import type { Conversation, WaMessage } from '@/lib/types'
import { Avatar, Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select, Tabs, Textarea } from '@/components/ui'
import { digits, fillTemplate, sendWa, suggestReply, templateVars } from '@/components/whatsapp/helpers'

type Status = Conversation['status']
type OwnerFilter = 'all' | 'mine' | 'unassigned'

const DEMO_REPLIES = [
  'Okay, thank you.',
  'What will be the charges?',
  'Can you do a survey tomorrow?',
  'We have a fridge, washing machine and 2 double beds.',
  'Is insurance included?',
  'Please call me after 6 pm.',
]

function dayLabel(iso: string) {
  const d = new Date(iso)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return fmtDate(iso)
}
const listTime = (iso: string) => (isToday(new Date(iso)) ? fmtTime(iso) : format(new Date(iso), 'dd MMM'))

export default function Chat() {
  const conversations = useStore(s => s.conversations)
  const users = useStore(s => s.users)
  const me = useCurrentUser()
  const [tab, setTab] = useState<Status>('active')
  const [q, setQ] = useState('')
  const [ownerF, setOwnerF] = useState<OwnerFilter>('all')
  const [selId, setSelId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)

  const counts = useMemo(() => {
    const c: Record<Status, number> = { active: 0, requesting: 0, intervened: 0 }
    conversations.forEach(x => { c[x.status]++ })
    return c
  }, [conversations])

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return conversations
      .filter(c => c.status === tab)
      .filter(c => (ownerF === 'all' ? true : ownerF === 'mine' ? c.ownerId === me.id : !c.ownerId))
      .filter(c => !term || c.name.toLowerCase().includes(term) || c.phone.includes(term.replace(/\s/g, '')))
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
  }, [conversations, tab, ownerF, q, me.id])

  const selected = conversations.find(c => c.id === selId)

  const open = (c: Conversation) => {
    setSelId(c.id)
    if (c.unread) useStore.getState().update('conversations', c.id, { unread: 0 })
  }

  return (
    <div>
      <PageHeader
        title="Live chat"
        subtitle="Shared WhatsApp inbox for the whole team"
        icon={MessageCircle}
        actions={<Button variant="primary" icon={MessageSquarePlus} onClick={() => setNewOpen(true)}>New message</Button>}
      />
      <div className="flex h-[calc(100dvh-17rem)] min-h-[460px] overflow-hidden rounded-xl border border-border bg-surface">
        {/* Conversation list */}
        <aside className={cn('w-full shrink-0 flex-col border-border md:flex md:w-80 md:border-r', selected ? 'hidden' : 'flex')}>
          <div className="space-y-2 border-b border-border p-3">
            <Tabs<Status>
              className="w-full"
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'active', label: 'Active', count: counts.active },
                { id: 'requesting', label: 'Requesting', count: counts.requesting },
                { id: 'intervened', label: 'Intervened', count: counts.intervened },
              ]}
            />
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-muted" />
                <Input className="pl-8" placeholder="Search name or number" value={q} onChange={e => setQ(e.target.value)} />
              </div>
              <Select className="w-32 shrink-0" value={ownerF} onChange={e => setOwnerF(e.target.value as OwnerFilter)} aria-label="Filter by owner">
                <option value="all">All owners</option>
                <option value="mine">Mine</option>
                <option value="unassigned">Unassigned</option>
              </Select>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="No conversations here"
                text={q || ownerF !== 'all' ? 'Try clearing the search or the owner filter.' : 'Start a chat with a lead or a new number.'}
                action={<Button size="sm" icon={Plus} onClick={() => setNewOpen(true)}>New message</Button>}
              />
            ) : (
              list.map(c => {
                const owner = users.find(u => u.id === c.ownerId)
                return (
                  <button
                    key={c.id}
                    onClick={() => open(c)}
                    className={cn('flex w-full cursor-pointer items-start gap-2.5 border-b border-border px-3 py-2.5 text-left hover:bg-surface-2/60', selId === c.id && 'bg-brand-soft/60')}
                  >
                    <Avatar name={c.name} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{c.name}</span>
                        <span className="shrink-0 text-[11px] text-muted">{listTime(c.lastAt)}</span>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn('truncate text-xs', c.unread ? 'font-medium text-text' : 'text-muted')}>{c.lastMessage || 'No messages yet'}</span>
                        {c.unread > 0 && <span className="grid h-4.5 min-w-4.5 shrink-0 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-fg">{c.unread}</span>}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1">
                        {owner ? <Badge color={owner.color}>{owner.name.split(' ')[0]}</Badge> : <Badge>Unassigned</Badge>}
                        {c.botPaused ? <Badge tone="warn">Bot paused</Badge> : <Badge tone="info"><Bot size={11} /> Bot on</Badge>}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* Thread */}
        <section className={cn('min-w-0 flex-1 flex-col md:flex', selected ? 'flex' : 'hidden')}>
          {selected ? (
            <Thread key={selected.id} conv={selected} onBack={() => setSelId(null)} />
          ) : (
            <div className="grid flex-1 place-items-center">
              <EmptyState icon={MessageCircle} title="Pick a conversation" text="Choose a chat from the list to read and reply." />
            </div>
          )}
        </section>
      </div>

      {newOpen && (
        <NewMessageModal
          onClose={() => setNewOpen(false)}
          onOpened={c => { setTab(c.status); setQ(''); setOwnerF('all'); setSelId(c.id); setNewOpen(false) }}
        />
      )}
    </div>
  )
}

function Ticks({ status, onBrand }: { status?: WaMessage['status']; onBrand?: boolean }) {
  if (status === 'failed') return <AlertCircle size={13} className="text-rose-500" aria-label="Failed" />
  if (status === 'read') return <CheckCheck size={13} className={onBrand ? 'text-sky-300' : 'text-sky-500'} aria-label="Read" />
  if (status === 'delivered') return <CheckCheck size={13} className="opacity-70" aria-label="Delivered" />
  if (status === 'sent') return <Check size={13} className="opacity-70" aria-label="Sent" />
  return null
}

function Thread({ conv, onBack }: { conv: Conversation; onBack: () => void }) {
  const allMessages = useStore(s => s.messages)
  const users = useStore(s => s.users)
  const leads = useStore(s => s.leads)
  const canned = useStore(s => s.cannedMessages)
  const sources = useStore(s => s.sources)
  const [text, setText] = useState('')
  const [cannedOpen, setCannedOpen] = useState(false)
  const [tplOpen, setTplOpen] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)

  const msgs = useMemo(() => allMessages.filter(m => m.conversationId === conv.id).sort((a, b) => a.at.localeCompare(b.at)), [allMessages, conv.id])
  const lead = leads.find(l => l.id === conv.leadId)
  const lastCustomer = useMemo(() => [...msgs].reverse().find(m => m.from === 'customer'), [msgs])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs.length])

  const showCanned = cannedOpen || text.startsWith('/')
  const cannedList = useMemo(() => {
    const term = text.startsWith('/') ? text.toLowerCase() : ''
    return canned.filter(c => !term || c.shortcut.toLowerCase().startsWith(term) || c.shortcut.toLowerCase().includes(term.slice(1)))
  }, [canned, text])

  const { update } = useStore.getState()

  const send = () => {
    if (!text.trim()) return
    sendWa(conv.id, text)
    setText('')
    setCannedOpen(false)
  }
  const pickCanned = (t: string) => { setText(t); setCannedOpen(false); box.current?.focus() }
  const takeOver = () => update('conversations', conv.id, { botPaused: true, status: 'intervened' })
  const handBack = () => update('conversations', conv.id, { botPaused: false, status: 'active' })
  const toggleAttention = () =>
    update('conversations', conv.id, { status: conv.status === 'requesting' ? (conv.botPaused ? 'intervened' : 'active') : 'requesting' })

  const addToLeads = () => {
    const s = useStore.getState()
    const existing = s.leads.find(l => digits(l.phone) === digits(conv.phone))
    const l = existing ?? s.createLead({ name: conv.name, phone: conv.phone, sourceId: sources.find(x => /whatsapp/i.test(x.label))?.id ?? sources[0]?.id ?? '', ownerId: conv.ownerId })
    s.update('conversations', conv.id, { leadId: l.id })
    s.log('whatsapp', 'WhatsApp conversation linked to this lead', l.id)
  }

  const simulateCustomer = () => {
    const s = useStore.getState()
    const reply = DEMO_REPLIES[msgs.filter(m => m.from === 'customer').length % DEMO_REPLIES.length]
    const at = nowIso()
    s.add('messages', { conversationId: conv.id, from: 'customer', text: reply, at })
    s.update('conversations', conv.id, { lastMessage: reply, lastAt: at, unread: 0 })
    if (conv.leadId) s.log('whatsapp', `WhatsApp received (demo): ${reply}`, conv.leadId)
    // When the bot is not paused it answers, the same way it would on a connected number.
    if (!conv.botPaused) {
      const botText = /charge|price|quot/i.test(reply)
        ? 'Our team will check your details and share the quotation shortly.'
        : 'Thank you. I have noted that and our team will get back to you shortly.'
      sendWa(conv.id, botText, 'bot', new Date(Date.now() + 1000).toISOString())
    }
  }

  return (
    <>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-3 py-2.5">
        <button onClick={onBack} className="cursor-pointer rounded p-1 text-muted hover:bg-surface-2 hover:text-text md:hidden" aria-label="Back to conversations"><ArrowLeft size={18} /></button>
        <Avatar name={conv.name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{conv.name}</span>
            {conv.status === 'requesting' && <Badge tone="warn">Needs attention</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span>+91 {conv.phone}</span>
            {lead ? (
              <Link to={`/leads/${lead.id}`} className="inline-flex items-center gap-1 font-medium text-brand hover:underline">Lead #{lead.no} <ExternalLink size={11} /></Link>
            ) : (
              <button onClick={addToLeads} className="inline-flex cursor-pointer items-center gap-1 font-medium text-brand hover:underline"><UserPlus size={12} /> Add to leads</button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="h-8 w-36 text-xs"
            aria-label="Conversation owner"
            value={conv.ownerId ?? ''}
            onChange={e => update('conversations', conv.id, { ownerId: e.target.value || undefined })}
          >
            <option value="">Unassigned</option>
            {users.filter(u => u.active || u.id === conv.ownerId).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          {conv.botPaused
            ? <Button size="sm" icon={Bot} onClick={handBack}>Hand back to bot</Button>
            : <Button size="sm" variant="primary" icon={Hand} onClick={takeOver}>Take over</Button>}
          <Button size="sm" icon={Flag} onClick={toggleAttention} className={conv.status === 'requesting' ? 'border-amber-500/50 text-amber-600' : ''}>
            {conv.status === 'requesting' ? 'Clear attention' : 'Needs attention'}
          </Button>
        </div>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-bg px-3 py-3">
        {msgs.length === 0 && <p className="py-10 text-center text-xs text-muted">No messages yet. Write the first one below.</p>}
        {msgs.map((m, i) => {
          const newDay = i === 0 || dayLabel(msgs[i - 1].at) !== dayLabel(m.at)
          const mine = m.from !== 'customer'
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-2 flex justify-center">
                  <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] text-muted">{dayLabel(m.at)}</span>
                </div>
              )}
              <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[82%] rounded-xl px-3 py-1.5 text-sm sm:max-w-[70%]',
                    m.from === 'customer' && 'rounded-tl-none border border-border bg-surface',
                    m.from === 'agent' && 'rounded-tr-none bg-brand text-brand-fg',
                    m.from === 'bot' && 'rounded-tr-none border border-brand/30 bg-brand-soft',
                  )}
                >
                  {m.from === 'bot' && <div className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-brand"><Bot size={11} /> Bot</div>}
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <div className={cn('mt-0.5 flex items-center justify-end gap-1 text-[10px]', m.from === 'agent' ? 'opacity-80' : 'text-muted')}>
                    {fmtTime(m.at)}
                    {mine && <Ticks status={m.status} onBrand={m.from === 'agent'} />}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <footer className="relative border-t border-border p-3">
        {showCanned && (
          <div className="absolute inset-x-3 bottom-full mb-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
            {cannedList.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted">No canned reply matches. Add replies in <Link to="/whatsapp/settings" className="text-brand underline">Settings</Link>.</p>
            ) : (
              cannedList.map(c => (
                <button key={c.id} onClick={() => pickCanned(c.text)} className="block w-full cursor-pointer border-b border-border px-3 py-2 text-left last:border-0 hover:bg-surface-2">
                  <span className="text-xs font-semibold text-brand">{c.shortcut}</span>
                  <span className="block truncate text-xs text-muted">{c.text}</span>
                </button>
              ))
            )}
          </div>
        )}
        <textarea
          ref={box}
          rows={2}
          aria-label="Message"
          className="min-h-14 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
          placeholder='Type a message. Enter sends, Shift+Enter adds a line, "/" opens canned replies.'
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" icon={Zap} onClick={() => setCannedOpen(o => !o)}>Canned replies</Button>
          <Button size="sm" icon={FileText} onClick={() => setTplOpen(true)}>Send template</Button>
          <Button size="sm" icon={Sparkles} disabled={!lastCustomer} title={lastCustomer ? 'Rule-based suggestion from the last customer message' : 'No customer message yet'} onClick={() => { if (lastCustomer) { setText(suggestReply(lastCustomer.text, conv.name, lead)); box.current?.focus() } }}>
            Suggest a reply
          </Button>
          <Button size="sm" variant="ghost" onClick={simulateCustomer} title="Adds a pretend customer message so you can try the flow">Simulate customer reply (demo)</Button>
          <span className="ml-auto flex items-center gap-2">
            <span className="hidden text-[11px] text-muted sm:inline">{conv.lastAt ? `Last activity ${timeAgo(conv.lastAt)}` : ''}</span>
            <Button size="sm" variant="primary" icon={Send} disabled={!text.trim()} onClick={send}>Send</Button>
          </span>
        </div>
      </footer>

      {tplOpen && <TemplateModal conv={conv} onClose={() => setTplOpen(false)} />}
    </>
  )
}

function TemplateModal({ conv, onClose }: { conv: Conversation; onClose: () => void }) {
  const templates = useStore(s => s.templates)
  const approved = useMemo(() => templates.filter(t => t.status === 'approved'), [templates])
  const [id, setId] = useState(approved[0]?.id ?? '')
  const [vals, setVals] = useState<Record<number, string>>({ 1: conv.name.split(/\s+/)[0] ?? '' })
  const tpl = approved.find(t => t.id === id)
  const vars = tpl ? templateVars(tpl.body) : []
  const missing = vars.some(n => !vals[n]?.trim())
  const send = () => {
    if (!tpl || missing) return
    sendWa(conv.id, fillTemplate(tpl.body, vals))
    useStore.getState().update('templates', tpl.id, { lastUsedAt: nowIso() })
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Send a template"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={Send} disabled={!tpl || missing} onClick={send}>Send template</Button></>}
    >
      {approved.length === 0 ? (
        <EmptyState icon={FileText} title="No approved templates" text="Only approved templates can be sent." action={<Link to="/whatsapp/templates"><Button size="sm">Open templates</Button></Link>} />
      ) : (
        <div className="space-y-3">
          <Field label="Approved template">
            <Select value={id} onChange={e => setId(e.target.value)}>
              {approved.map(t => <option key={t.id} value={t.id}>{t.name} ({t.language})</option>)}
            </Select>
          </Field>
          {vars.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {vars.map(n => (
                <Field key={n} label={`Value for {{${n}}}`}>
                  <Input value={vals[n] ?? ''} onChange={e => setVals(v => ({ ...v, [n]: e.target.value }))} placeholder={n === 1 ? 'Customer name' : 'Type a value'} />
                </Field>
              ))}
            </div>
          )}
          {tpl && (
            <div>
              <span className="mb-1 block text-xs font-medium text-muted">Message that will be sent</span>
              <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm whitespace-pre-wrap">{fillTemplate(tpl.body, vals)}</p>
              {missing && <p className="mt-1 text-xs text-amber-600">Fill every variable before sending.</p>}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

function NewMessageModal({ onClose, onOpened }: { onClose: () => void; onOpened: (c: Conversation) => void }) {
  const leads = useStore(s => s.leads)
  const me = useCurrentUser()
  const [mode, setMode] = useState<'lead' | 'number'>('lead')
  const [q, setQ] = useState('')
  const [leadId, setLeadId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [first, setFirst] = useState('')

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase()
    return leads.filter(l => !term || l.name.toLowerCase().includes(term) || l.phone.includes(term)).slice(0, 8)
  }, [leads, q])

  const phoneOk = digits(phone).length === 10
  const canStart = mode === 'lead' ? !!leadId : phoneOk

  const start = () => {
    const s = useStore.getState()
    const lead = mode === 'lead' ? s.leads.find(l => l.id === leadId) : s.leads.find(l => digits(l.phone) === digits(phone))
    const ph = mode === 'lead' ? (lead?.phone ?? '') : digits(phone)
    if (!ph) return
    let conv = s.conversations.find(c => digits(c.phone) === digits(ph))
    if (!conv) {
      conv = s.add('conversations', {
        leadId: lead?.id, name: mode === 'lead' ? (lead?.name ?? ph) : (name.trim() || lead?.name || `+91 ${ph}`), phone: ph,
        ownerId: me.id, status: 'active', unread: 0, lastMessage: '', lastAt: nowIso(), botPaused: true,
      })
    }
    if (first.trim()) sendWa(conv.id, first)
    onOpened(useStore.getState().conversations.find(c => c.id === conv.id) ?? conv)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New message"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={MessageCircle} disabled={!canStart} onClick={start}>Open chat</Button></>}
    >
      <div className="space-y-3">
        <Tabs<'lead' | 'number'> value={mode} onChange={setMode} tabs={[{ id: 'lead', label: 'Pick a lead' }, { id: 'number', label: 'Type a number' }]} />
        {mode === 'lead' ? (
          <>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-muted" />
              <Input className="pl-8" placeholder="Search leads by name or phone" value={q} onChange={e => setQ(e.target.value)} autoFocus />
            </div>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
              {matches.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted">No lead matches that search.</p>}
              {matches.map(l => (
                <button key={l.id} onClick={() => setLeadId(l.id)} className={cn('flex w-full cursor-pointer items-center gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-surface-2', leadId === l.id && 'bg-brand-soft')}>
                  <Avatar name={l.name} size={24} />
                  <span className="min-w-0 flex-1 truncate">{l.name}</span>
                  <span className="text-xs text-muted">+91 {l.phone}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name (optional)"><Input value={name} onChange={e => setName(e.target.value)} placeholder="Customer name" /></Field>
            <Field label="WhatsApp number" hint={phone && !phoneOk ? 'Enter a 10-digit mobile number.' : undefined}>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="98XXXXXXXX" inputMode="tel" />
            </Field>
          </div>
        )}
        <Field label="First message (optional)">
          <Textarea rows={2} value={first} onChange={e => setFirst(e.target.value)} placeholder="Namaste! This is Super Packers and Movers…" />
        </Field>
        <p className="text-xs text-muted">If a chat with this number already exists, it is opened instead of creating a new one.</p>
      </div>
    </Modal>
  )
}
