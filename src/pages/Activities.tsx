import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, History, Search } from 'lucide-react'
import { endOfDay, format, isToday, isYesterday, startOfDay } from 'date-fns'
import { useStore } from '@/lib/store'
import type { ActivityType } from '@/lib/types'
import { cn, downloadCsv, fmtDateTime, fmtTime } from '@/lib/utils'
import { ACTIVITY_TYPES as TYPES, activityMeta } from '@/components/work/activityMeta'
import { Button, Card, EmptyState, Input, PageHeader, Select } from '@/components/ui'

const PAGE = 50

export default function Activities() {
  const activities = useStore(s => s.activities)
  const leads = useStore(s => s.leads)
  const users = useStore(s => s.users)

  const [type, setType] = useState('')
  const [userId, setUserId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE)

  const leadById = useMemo(() => new Map(leads.map(l => [l.id, l])), [leads])
  const userById = useMemo(() => new Map(users.map(u => [u.id, u])), [users])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const f = from ? startOfDay(new Date(from + 'T00:00')).getTime() : -Infinity
    const t = to ? endOfDay(new Date(to + 'T00:00')).getTime() : Infinity
    return activities
      .filter(a => {
        if (type && a.type !== type) return false
        if (userId === 'none' ? !!a.userId : userId && a.userId !== userId) return false
        const at = new Date(a.at).getTime()
        if (at < f || at > t) return false
        if (s) {
          const lead = a.leadId ? leadById.get(a.leadId) : undefined
          if (![a.text, lead?.name, lead?.phone].join(' ').toLowerCase().includes(s)) return false
        }
        return true
      })
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [activities, type, userId, from, to, q, leadById])

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: typeof filtered }[] = []
    for (const a of filtered.slice(0, limit)) {
      const d = new Date(a.at)
      const key = format(d, 'yyyy-MM-dd')
      let g = out[out.length - 1]
      if (!g || g.key !== key) {
        g = { key, label: (isToday(d) ? 'Today · ' : isYesterday(d) ? 'Yesterday · ' : '') + format(d, 'EEEE, dd MMM yyyy'), items: [] }
        out.push(g)
      }
      g.items.push(a)
    }
    return out
  }, [filtered, limit])

  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setLimit(PAGE) }
  const filtersOn = type || userId || from || to || q
  const clear = () => { setType(''); setUserId(''); setFrom(''); setTo(''); setQ(''); setLimit(PAGE) }

  const exportCsv = () =>
    downloadCsv('activities.csv', filtered.map(a => ({
      When: fmtDateTime(a.at), Type: activityMeta(a.type).label, Activity: a.text,
      Lead: a.leadId ? leadById.get(a.leadId)?.name ?? '' : '', User: a.userId ? userById.get(a.userId)?.name ?? '' : 'System',
    })))

  return (
    <div>
      <PageHeader
        title="Activities"
        icon={History}
        subtitle="Everything that happened across leads, tasks, calls and billing"
        actions={<Button icon={Download} onClick={exportCsv} disabled={!filtered.length}>Download CSV</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-[1fr_160px_170px_150px_150px_auto]">
        <div className="relative col-span-2 lg:col-span-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-muted" />
          <Input className="pl-8" placeholder="Search activity text or lead" value={q} onChange={e => reset(setQ)(e.target.value)} />
        </div>
        <Select value={type} onChange={e => reset(setType)(e.target.value)} aria-label="Type">
          <option value="">All types</option>
          {(Object.keys(TYPES) as ActivityType[]).map(t => <option key={t} value={t}>{TYPES[t].label}</option>)}
        </Select>
        <Select value={userId} onChange={e => reset(setUserId)(e.target.value)} aria-label="User">
          <option value="">All users</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          <option value="none">System / automation</option>
        </Select>
        <Input type="date" value={from} max={to || undefined} onChange={e => reset(setFrom)(e.target.value)} aria-label="From date" title="From date" />
        <Input type="date" value={to} min={from || undefined} onChange={e => reset(setTo)(e.target.value)} aria-label="To date" title="To date" />
        {filtersOn ? <Button variant="ghost" onClick={clear}>Clear</Button> : <span className="hidden lg:block" />}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title={activities.length ? 'No activity matches these filters' : 'No activity yet'}
            text={activities.length ? 'Change the type, user or dates to see more.' : 'Notes, calls, stage changes and tasks will show up here as your team works on leads.'}
            action={activities.length ? <Button onClick={clear}>Clear filters</Button> : <Link to="/leads?new=1"><Button variant="primary">Add a lead</Button></Link>}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(g => (
            <Card key={g.key} title={g.label} action={<span className="text-xs text-muted">{g.items.length}</span>}>
              <ul className="divide-y divide-border">
                {g.items.map(a => {
                  const m = activityMeta(a.type)
                  const lead = a.leadId ? leadById.get(a.leadId) : undefined
                  const user = a.userId ? userById.get(a.userId) : undefined
                  return (
                    <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                      <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg', m.cls)} title={m.label}><m.icon size={15} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm">{a.text}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {m.label}
                          {lead && <> · <Link to={`/leads/${lead.id}`} className="text-brand hover:underline">{lead.name}</Link></>}
                          {' · '}{user?.name ?? 'System'}
                        </p>
                      </div>
                      <time className="shrink-0 whitespace-nowrap text-xs text-muted" title={fmtDateTime(a.at)}>{fmtTime(a.at)}</time>
                    </li>
                  )
                })}
              </ul>
            </Card>
          ))}
          <div className="flex flex-col items-center gap-2 pb-2">
            <p className="text-xs text-muted">Showing {Math.min(limit, filtered.length)} of {filtered.length}</p>
            {filtered.length > limit && <Button onClick={() => setLimit(l => l + PAGE)}>Load more</Button>}
          </div>
        </div>
      )}
    </div>
  )
}
