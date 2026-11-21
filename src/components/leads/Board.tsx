import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, MapPin } from 'lucide-react'
import { Avatar } from '@/components/ui'
import { cn, friendlyDay, inr } from '@/lib/utils'
import type { Lead, Stage, User } from '@/lib/types'

/** Pipeline board: one column per stage. Drag a card to another column to change its stage. */
export default function Board({ leads, stages, users, onMove }: { leads: Lead[]; stages: Stage[]; users: User[]; onMove: (leadId: string, stageId: string) => void }) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const now = Date.now()

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {stages.map(st => {
        const list = leads.filter(l => l.stageId === st.id)
        const total = list.reduce((s, l) => s + (l.value || 0), 0)
        return (
          <section
            key={st.id}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overId !== st.id) setOverId(st.id) }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverId(o => (o === st.id ? null : o)) }}
            onDrop={e => {
              e.preventDefault()
              const id = e.dataTransfer.getData('text/plain') || dragId
              setOverId(null); setDragId(null)
              const lead = leads.find(l => l.id === id)
              if (lead && lead.stageId !== st.id) onMove(lead.id, st.id)
            }}
            className={cn('flex w-64 shrink-0 flex-col rounded-xl border bg-surface-2/50 transition-colors', overId === st.id && dragId ? 'border-brand bg-brand-soft' : 'border-border')}
          >
            <header className="border-b border-border px-3 py-2.5" style={{ borderTop: `3px solid ${st.color}`, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate text-sm font-semibold">{st.label}</h3>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted">{list.length}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted">{inr(total)}</p>
            </header>
            <div className="flex max-h-[65vh] min-h-24 flex-col gap-2 overflow-y-auto p-2">
              {list.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted">Drop a lead here</p>}
              {list.map(l => {
                const owner = users.find(u => u.id === l.ownerId)
                const overdue = l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() < now
                return (
                  <article
                    key={l.id}
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('text/plain', l.id); e.dataTransfer.effectAllowed = 'move'; setDragId(l.id) }}
                    onDragEnd={() => { setDragId(null); setOverId(null) }}
                    className={cn('cursor-grab rounded-lg border border-border bg-surface p-2.5 shadow-sm active:cursor-grabbing', dragId === l.id && 'opacity-50')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/leads/${l.id}`} draggable={false} className="min-w-0 truncate text-sm font-medium hover:text-brand">{l.name}</Link>
                      {owner ? <span title={owner.name}><Avatar name={owner.name} color={owner.color} size={22} /></span> : <span className="text-[10px] text-muted">No owner</span>}
                    </div>
                    {(l.moveFrom || l.moveTo) && (
                      <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted"><MapPin size={12} className="shrink-0" />{l.moveFrom || '?'} → {l.moveTo || '?'}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold">{l.value ? inr(l.value) : <span className="font-normal text-muted">No value</span>}</span>
                      {l.nextFollowUpAt && (
                        <span className={cn('flex items-center gap-1', overdue ? 'text-rose-600' : 'text-muted')}><CalendarClock size={12} />{friendlyDay(l.nextFollowUpAt)}</span>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
