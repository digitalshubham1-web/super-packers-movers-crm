/* Helpers shared by the Tasks, Calendar, Dashboard and Activities pages. */
import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Priority, Task } from '@/lib/types'
import { Input } from '@/components/ui'

export const isLate = (t: Task, now = Date.now()) => t.status === 'pending' && new Date(t.dueAt).getTime() < now
export type TaskView = 'pending' | 'late' | 'done' | 'cancelled'
export const taskView = (t: Task, now = Date.now()): TaskView => (isLate(t, now) ? 'late' : t.status)
export const viewTone = { pending: 'warn', late: 'bad', done: 'good', cancelled: 'neutral' } as const
export const viewLabel = { pending: 'Pending', late: 'Late', done: 'Done', cancelled: 'Cancelled' } as const
export const priorityTone = { low: 'neutral', medium: 'info', high: 'warn', urgent: 'bad' } as const
export const priorities: Priority[] = ['low', 'medium', 'high', 'urgent']
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Mark a task done / pending again, and note it on the linked lead's timeline. */
export function toggleTaskDone(t: Task) {
  const { update, log } = useStore.getState()
  if (t.status === 'done') {
    update('tasks', t.id, { status: 'pending', completedAt: undefined })
    log('task', `Task reopened: ${t.title}`, t.leadId)
  } else {
    update('tasks', t.id, { status: 'done', completedAt: new Date().toISOString() })
    log('task', `Task completed: ${t.title}`, t.leadId)
  }
}

/** Search-as-you-type lead chooser. */
export function LeadPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const leads = useStore(s => s.leads)
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState(false)
  const selected = leads.find(l => l.id === value)
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = s ? leads.filter(l => l.name.toLowerCase().includes(s) || l.phone.includes(s) || String(l.no).includes(s) || (l.city ?? '').toLowerCase().includes(s)) : leads
    return list.slice(0, 8)
  }, [leads, q])

  if (selected) {
    return (
      <div className="flex h-9 items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 text-sm">
        <span className="truncate">{selected.name} <span className="text-muted">· #{selected.no} · {selected.phone}</span></span>
        <button type="button" onClick={() => onChange('')} className="cursor-pointer rounded p-0.5 text-muted hover:text-text" aria-label="Remove linked lead"><X size={14} /></button>
      </div>
    )
  }
  return (
    <div className="relative">
      <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-muted" />
      <Input className="pl-8" placeholder="Search leads by name, phone or number" value={q} onChange={e => setQ(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} />
      {focus && (
        <div className="absolute inset-x-0 top-10 z-10 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
          {matches.length === 0 && <div className="px-3 py-2 text-xs text-muted">No leads match "{q}"</div>}
          {matches.map(l => (
            <button type="button" key={l.id} onMouseDown={e => { e.preventDefault(); onChange(l.id); setQ(''); setFocus(false) }} className="block w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-surface-2">
              {l.name} <span className="text-xs text-muted">· #{l.no} · {l.phone}{l.city ? ' · ' + l.city : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
