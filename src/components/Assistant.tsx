import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Copy, MessageSquarePlus, Send, Sparkles, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn, friendlyDay, uid } from '@/lib/utils'
import { Button, Drawer, Input } from '@/components/ui'
import { copyText } from '@/components/admin/shared'
import { answer, applyProposal, STARTERS, type Reply } from '@/components/admin/sathi'

interface Msg extends Reply { id: string; from: 'user' | 'sathi'; state?: 'pending' | 'approved' | 'cancelled' }

/** Renders **bold** and line breaks only. */
function Rich({ text }: { text: string }) {
  return <>{text.split('\n').map((line, i) => (
    <span key={i}>{i > 0 && <br />}{line.split(/\*\*(.+?)\*\*/g).map((part, j) => (j % 2 ? <strong key={j}>{part}</strong> : part))}</span>
  ))}</>
}

export default function Assistant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const firstName = useStore(s => (s.users.find(u => u.id === s.currentUserId) ?? s.users[0])?.name.split(' ')[0] ?? '')
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (open) endRef.current?.scrollIntoView({ block: 'end' }) }, [messages, open])

  const send = (raw: string) => {
    const text = raw.trim()
    if (!text) return
    let reply: Reply
    try { reply = answer(text) } catch { reply = { text: 'Something went wrong while reading your CRM data. Please try wording it differently.' } }
    setMessages(m => [...m, { id: uid(), from: 'user', text }, { id: uid(), from: 'sathi', ...reply, state: reply.proposal ? 'pending' : undefined }])
    setInput('')
  }
  const decide = (msg: Msg, approve: boolean) => {
    if (!msg.proposal || msg.state !== 'pending') return
    const result = approve ? applyProposal(msg.proposal) : 'Cancelled. Nothing was changed.'
    setMessages(m => [...m.map(x => (x.id === msg.id ? { ...x, state: approve ? 'approved' as const : 'cancelled' as const } : x)), { id: uid(), from: 'sathi', text: result, links: approve ? [{ label: `Open ${msg.proposal!.leadName}`, to: `/leads/${msg.proposal!.leadId}` }] : undefined }])
  }
  const copy = async (msg: Msg) => { if (msg.copy && (await copyText(msg.copy))) { setCopied(msg.id); window.setTimeout(() => setCopied(''), 2000) } }

  return (
    <Drawer open={open} onClose={onClose} title="Sathi · CRM helper" width={440}
      footer={
        <form className="flex w-full gap-2" onSubmit={e => { e.preventDefault(); send(input) }}>
          <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about leads, tasks or invoices" aria-label="Message to Sathi" autoFocus />
          <Button type="submit" variant="primary" icon={Send} disabled={!input.trim()} aria-label="Send" />
        </form>
      }>
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">Works from your CRM data. No AI model is connected yet.</p>
        <Button size="sm" icon={MessageSquarePlus} disabled={!messages.length} onClick={() => { setMessages([]); setInput('') }}>New chat</Button>
      </div>

      {messages.length === 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand"><Sparkles size={18} /></span>
            <div><p className="text-sm font-semibold">Namaste{firstName ? `, ${firstName}` : ''}. I am Sathi.</p><p className="text-xs text-muted">Pick a question or type your own.</p></div>
          </div>
          <div className="flex flex-col gap-1.5">
            {STARTERS.map(s => (
              <button key={s} onClick={() => send(s)} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm hover:border-brand hover:bg-surface-2 cursor-pointer">
                {s}<ArrowRight size={14} className="shrink-0 text-muted" />
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">You can also type things like “find Rohan”, “create a task to call Rohan tomorrow” or “move Rohan to Contacted”. I always ask before changing anything.</p>
        </div>
      )}

      <div className="space-y-3" aria-live="polite">
        {messages.map(m => (
          <div key={m.id} className={cn('flex', m.from === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[88%] rounded-xl px-3 py-2 text-sm', m.from === 'user' ? 'bg-brand text-brand-fg' : 'border border-border bg-surface-2')}>
              <Rich text={m.text} />
              {m.copy && (
                <div className="mt-2 rounded-lg border border-border bg-surface p-2.5">
                  <p className="whitespace-pre-wrap text-sm">{m.copy}</p>
                  <div className="mt-2"><Button size="sm" icon={copied === m.id ? Check : Copy} onClick={() => copy(m)}>{copied === m.id ? 'Copied' : 'Copy text'}</Button></div>
                </div>
              )}
              {m.proposal && (
                <div className="mt-2 rounded-lg border border-border bg-surface p-2.5">
                  {m.proposal.kind === 'task' ? (
                    <dl className="space-y-0.5 text-sm">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted">New task</div>
                      <div><dt className="inline text-muted">Title: </dt><dd className="inline font-medium">{m.proposal.title}</dd></div>
                      <div><dt className="inline text-muted">Lead: </dt><dd className="inline font-medium">{m.proposal.leadName}</dd></div>
                      <div><dt className="inline text-muted">Due: </dt><dd className="inline font-medium">{friendlyDay(m.proposal.dueAt)}</dd></div>
                      <div><dt className="inline text-muted">Type: </dt><dd className="inline font-medium">{m.proposal.type}</dd></div>
                    </dl>
                  ) : (
                    <dl className="space-y-0.5 text-sm">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted">Change stage</div>
                      <div><dt className="inline text-muted">Lead: </dt><dd className="inline font-medium">{m.proposal.leadName}</dd></div>
                      <div><dt className="inline text-muted">From: </dt><dd className="inline font-medium">{m.proposal.fromLabel}</dd></div>
                      <div><dt className="inline text-muted">To: </dt><dd className="inline font-medium">{m.proposal.stageLabel}</dd></div>
                    </dl>
                  )}
                  {m.state === 'pending' ? (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="primary" icon={Check} onClick={() => decide(m, true)}>Approve</Button>
                      <Button size="sm" icon={X} onClick={() => decide(m, false)}>Cancel</Button>
                    </div>
                  ) : <p className={cn('mt-2 text-xs font-medium', m.state === 'approved' ? 'text-emerald-600' : 'text-muted')}>{m.state === 'approved' ? 'Approved' : 'Cancelled'}</p>}
                </div>
              )}
              {m.links && m.links.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {m.links.map((l, i) => (
                    <li key={i}><Link to={l.to} onClick={onClose} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text hover:border-brand hover:text-brand">
                      <span className="min-w-0 break-words">{l.label}</span><ArrowRight size={12} className="shrink-0" />
                    </Link></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
      <div ref={endRef} />
    </Drawer>
  )
}
