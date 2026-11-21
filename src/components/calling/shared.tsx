/* Helpers shared by the Calling, Call lists, Voice agents and Email pages. */
import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Hash, Plus, Search, Trash2 } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Call, Lead } from '@/lib/types'
import { uid } from '@/lib/utils'
import { Button, Card, EmptyState, Field, Input, Modal } from '@/components/ui'

/** useState that is saved in localStorage under `key`. */
export function useLocalState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  const set = useCallback((v: T | ((prev: T) => T)) => {
    setValue(prev => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* storage full or blocked */ }
      return next
    })
  }, [key])
  return [value, set]
}

export const outcomeLabel: Record<Call['outcome'], string> = { connected: 'Connected', no_answer: 'No answer', busy: 'Busy', missed: 'Missed' }
export const outcomeTone: Record<Call['outcome'], 'good' | 'warn' | 'bad' | 'neutral'> = { connected: 'good', no_answer: 'warn', busy: 'neutral', missed: 'bad' }

/** Digits (and a leading +) only, for tel: links. */
export const telHref = (phone: string) => 'tel:' + phone.replace(/[^\d+]/g, '')

export const integrationsLink = <Link to="/integrations" className="font-semibold underline">Integrations</Link>

/** Search box that lists matching leads; click one to pick it. */
export function LeadPicker({ onPick, onlyWithEmail, placeholder }: { onPick: (lead: Lead) => void; onlyWithEmail?: boolean; placeholder?: string }) {
  const leads = useStore(s => s.leads)
  const [q, setQ] = useState('')
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    return leads
      .filter(l => (!onlyWithEmail || !!l.email) && (l.name.toLowerCase().includes(t) || l.phone.includes(t) || (l.email ?? '').toLowerCase().includes(t)))
      .slice(0, 8)
  }, [leads, q, onlyWithEmail])
  return (
    <div>
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder ?? 'Search leads by name or phone'} className="pl-8" />
      </div>
      {q.trim() && (
        <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface">
          {matches.length === 0 && <p className="px-3 py-2 text-xs text-muted">No matching lead{onlyWithEmail ? ' with an email address' : ''}.</p>}
          {matches.map(l => (
            <button key={l.id} type="button" onClick={() => { onPick(l); setQ('') }} className="flex w-full cursor-pointer items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-surface-2">
              <span className="min-w-0">
                <span className="block truncate font-medium">{l.name}</span>
                <span className="block truncate text-xs text-muted">{onlyWithEmail ? l.email : [l.moveFrom, l.moveTo].filter(Boolean).join(' → ') || l.city || `Lead #${l.no}`}</span>
              </span>
              <span className="shrink-0 text-xs text-muted">{l.phone}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface SavedNumber { id: string; label: string; number: string }

/** Business caller IDs. Real ones come from the telephony provider; until then the user can note numbers by hand. */
export function NumbersPanel() {
  const [numbers, setNumbers] = useLocalState<SavedNumber[]>('spm-numbers', [])
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [number, setNumber] = useState('')
  const [removeId, setRemoveId] = useState<string | null>(null)
  const save = () => {
    if (!number.trim()) return
    setNumbers(n => [...n, { id: uid(), label: label.trim() || 'Business number', number: number.trim() }])
    setLabel(''); setNumber(''); setOpen(false)
  }
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm font-medium">Business caller IDs</p>
        <p className="mt-1 text-sm text-muted">
          After you connect Exotel, Plivo or Twilio under {integrationsLink}, the phone numbers bought in that account appear here and can be used as the caller ID for team calls and voice agents.
          No provider is connected yet, so nothing is imported. You can note your numbers below so the team knows which line is used for what; this list is saved on this device only.
        </p>
      </Card>
      <Card title={`Saved numbers (${numbers.length})`} action={<Button size="sm" variant="primary" icon={Plus} onClick={() => setOpen(true)}>Add number</Button>}>
        {numbers.length === 0 ? (
          <EmptyState icon={Hash} title="No numbers saved" text="Add the office or sales line your team calls from." action={<Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>Add number</Button>} />
        ) : (
          <ul>
            {numbers.map(n => (
              <li key={n.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{n.label}</p>
                  <p className="text-xs text-muted">{n.number} · added by hand, not verified with a provider</p>
                </div>
                <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setRemoveId(n.id)}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Add number" footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" disabled={!number.trim()} onClick={save}>Save number</Button></>}>
        <div className="space-y-3">
          <Field label="Label"><Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Sales line" /></Field>
          <Field label="Phone number"><Input value={number} onChange={e => setNumber(e.target.value)} placeholder="+91 98100 00001" inputMode="tel" /></Field>
        </div>
      </Modal>
      <Modal open={!!removeId} onClose={() => setRemoveId(null)} title="Remove number?" footer={<><Button onClick={() => setRemoveId(null)}>Keep</Button><Button variant="danger" onClick={() => { setNumbers(n => n.filter(x => x.id !== removeId)); setRemoveId(null) }}>Remove</Button></>}>
        <p className="text-sm text-muted">This only removes the number from this list.</p>
      </Modal>
    </div>
  )
}
