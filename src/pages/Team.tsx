import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightLeft, Check, Eye, Pencil, Search, ShieldCheck, Upload, UserPlus, Users } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Role, User } from '@/lib/types'
import { Avatar, Badge, Button, Card, Drawer, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea, Toggle, tableCls, tableWrap, tdCls, thCls, trCls } from '@/components/ui'
import { cn, fmtDate, nowIso, parseCsv, timeAgo } from '@/lib/utils'
import { BarList, Mini, splitLeads } from '@/components/insights/shared'

const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', manager: 'Manager', sales: 'Sales agent' }
const ROLE_TONE: Record<Role, 'brand' | 'info' | 'neutral'> = { admin: 'brand', manager: 'info', sales: 'neutral' }
const ROLES: Role[] = ['admin', 'manager', 'sales']
const COLOURS = ['#ea580c', '#0891b2', '#7c3aed', '#16a34a', '#db2777', '#2563eb', '#ca8a04', '#dc2626', '#0d9488', '#64748b']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`

function parseRole(raw: string): Role | null {
  const v = raw.trim().toLowerCase()
  if (!v) return 'sales'
  if (v === 'admin' || v === 'administrator' || v === 'owner') return 'admin'
  if (v === 'manager') return 'manager'
  if (['sales', 'sales agent', 'agent', 'sales executive', 'executive'].includes(v)) return 'sales'
  return null
}

/* ---------- Add / edit drawer ---------- */
function UserDrawer({ user, onClose }: { user: User | 'new'; onClose: () => void }) {
  const users = useStore(s => s.users)
  const editing = user === 'new' ? null : user
  const [f, setF] = useState(() => ({
    name: editing?.name ?? '', email: editing?.email ?? '', phone: editing?.phone ?? '', role: (editing?.role ?? 'sales') as Role,
    reportsTo: editing?.reportsTo ?? '', color: editing?.color ?? COLOURS[users.length % COLOURS.length],
  }))
  const [tried, setTried] = useState(false)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(p => ({ ...p, [k]: v }))

  const otherAdmins = users.filter(u => u.active && u.role === 'admin' && u.id !== editing?.id).length
  const lastAdmin = !!editing && editing.active && editing.role === 'admin' && otherAdmins === 0
  const email = f.email.trim().toLowerCase()
  const errors = {
    name: !f.name.trim() ? 'Enter a name.' : '',
    email: !email ? 'Enter an email address.' : !EMAIL_RE.test(email) ? 'This does not look like an email address.' : users.some(u => u.id !== editing?.id && u.email.toLowerCase() === email) ? 'Another user already has this email.' : '',
    phone: f.phone.trim() && f.phone.replace(/\D/g, '').length < 10 ? 'A phone number needs at least 10 digits.' : '',
    role: lastAdmin && f.role !== 'admin' ? 'This is the only active admin. Make someone else an admin first.' : '',
  }
  const ok = !Object.values(errors).some(Boolean)

  const save = () => {
    setTried(true)
    if (!ok) return
    const { add, update } = useStore.getState()
    const data = { name: f.name.trim(), email, phone: f.phone.trim(), role: f.role, reportsTo: f.reportsTo || undefined, color: f.color }
    if (editing) update('users', editing.id, data)
    else add('users', { ...data, active: true, available: true, joinedAt: nowIso() })
    onClose()
  }
  const err = (m: string) => tried && m ? <span className="mt-1 block text-xs text-rose-600">{m}</span> : null

  return (
    <Drawer open onClose={onClose} title={editing ? `Edit ${editing.name}` : 'Add user'} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{editing ? 'Save changes' : 'Add user'}</Button></>}>
      <div className="space-y-4">
        <Field label="Full name *"><Input autoFocus value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Rakesh Sharma" />{err(errors.name)}</Field>
        <Field label="Email *"><Input type="email" value={f.email} onChange={e => set('email', e.target.value)} placeholder="name@company.in" />{err(errors.email)}</Field>
        <Field label="Phone"><Input type="tel" value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98XXXXXXXX" />{err(errors.phone)}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role">
            <Select value={f.role} onChange={e => set('role', e.target.value as Role)}>{ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>
            {errors.role && <span className="mt-1 block text-xs text-rose-600">{errors.role}</span>}
          </Field>
          <Field label="Reports to">
            <Select value={f.reportsTo} onChange={e => set('reportsTo', e.target.value)}>
              <option value="">No one</option>
              {users.filter(u => u.id !== editing?.id).map(u => <option key={u.id} value={u.id}>{u.name}{u.active ? '' : ' (inactive)'}</option>)}
            </Select>
          </Field>
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-muted">Colour</span>
          <div className="flex flex-wrap items-center gap-2">
            {COLOURS.map(c => (
              <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={f.color === c} onClick={() => set('color', c)} className={cn('grid size-7 cursor-pointer place-items-center rounded-full text-white', f.color === c && 'ring-2 ring-brand ring-offset-2 ring-offset-surface')} style={{ background: c }}>
                {f.color === c && <Check size={14} />}
              </button>
            ))}
            <input type="color" aria-label="Custom colour" value={f.color} onChange={e => set('color', e.target.value)} className="size-7 cursor-pointer rounded border border-border bg-surface p-0.5" />
            <span className="ml-auto flex items-center gap-2 text-xs text-muted">Preview <Avatar name={f.name || 'New user'} color={f.color} size={30} /></span>
          </div>
        </div>
        {!editing && <p className="rounded-lg bg-surface-2/60 px-3 py-2 text-xs text-muted">The user is added to this CRM straight away. No invitation email is sent — personal sign-in arrives in a later version.</p>}
      </div>
    </Drawer>
  )
}

/* ---------- Import (CSV paste) ---------- */
function ImportModal({ onClose }: { onClose: () => void }) {
  const users = useStore(s => s.users)
  const [text, setText] = useState('')
  const [done, setDone] = useState<number | null>(null)

  const rows = useMemo(() => {
    const raw = text.trim()
    if (!raw) return []
    const first = raw.split(/\r?\n/)[0].toLowerCase()
    const withHead = /\bname\b/.test(first) && /\bemail\b/.test(first) ? raw : 'name,email,phone,role\n' + raw
    const seen = new Set(users.map(u => u.email.toLowerCase()))
    return parseCsv(withHead).map((r, i) => {
      const g = (k: string) => { const hit = Object.keys(r).find(h => h.toLowerCase() === k); return hit ? r[hit] : '' }
      const name = g('name'), email = g('email').toLowerCase(), phone = g('phone'), role = parseRole(g('role'))
      let problem = ''
      if (!name) problem = 'Name is missing'
      else if (!email) problem = 'Email is missing'
      else if (!EMAIL_RE.test(email)) problem = 'Email is not valid'
      else if (seen.has(email)) problem = 'Email already in use'
      else if (!role) problem = `Unknown role "${g('role')}"`
      if (!problem) seen.add(email)
      return { i, name, email, phone, role, problem }
    })
  }, [text, users])
  const good = rows.filter(r => !r.problem)

  const run = () => {
    const { add } = useStore.getState()
    const base = users.length
    // add() puts new records first, so insert in reverse to keep the pasted order.
    ;[...good].reverse().forEach((r, k) => add('users', { name: r.name, email: r.email, phone: r.phone, role: r.role ?? 'sales', active: true, available: true, joinedAt: nowIso(), color: COLOURS[(base + good.length - 1 - k) % COLOURS.length] }))
    setDone(good.length)
  }

  if (done !== null) {
    return (
      <Modal open onClose={onClose} title="Import users" footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
        <p className="text-sm"><span className="font-semibold text-emerald-600">{plural(done, 'user')} added.</span>{rows.length - done > 0 && ` ${plural(rows.length - done, 'row')} skipped because of the problems shown in the preview.`}</p>
      </Modal>
    )
  }
  return (
    <Modal open wide onClose={onClose} title="Import users" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!good.length} onClick={run}>{good.length ? `Import ${plural(good.length, 'user')}` : 'Import'}</Button></>}>
      <div className="space-y-3">
        <Field label="Paste CSV rows" hint="One user per line: name, email, phone, role. Role can be Admin, Manager or Sales agent (blank = Sales agent). A header line is optional.">
          <Textarea rows={6} className="font-mono text-xs" value={text} onChange={e => setText(e.target.value)} placeholder={'name,email,phone,role\nRakesh Sharma,rakesh@company.in,9811122233,Sales agent\nNisha Gupta,nisha@company.in,9811122244,Manager'} />
        </Field>
        {rows.length > 0 && (
          <>
            <p className="text-xs text-muted"><span className="font-medium text-emerald-600">{good.length} ready</span>{rows.length - good.length > 0 && <> · <span className="font-medium text-rose-600">{rows.length - good.length} will be skipped</span></>}</p>
            <div className="max-h-64 overflow-auto rounded-lg border border-border">
              <table className={tableCls}>
                <thead><tr>{['Name', 'Email', 'Phone', 'Role', 'Check'].map(h => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.i} className={cn(r.problem && 'opacity-70')}>
                      <td className={tdCls}>{r.name || '—'}</td>
                      <td className={tdCls}>{r.email || '—'}</td>
                      <td className={tdCls}>{r.phone || '—'}</td>
                      <td className={tdCls}>{r.role ? ROLE_LABEL[r.role] : '—'}</td>
                      <td className={tdCls}>{r.problem ? <Badge tone="bad">{r.problem}</Badge> : <Badge tone="good">Ready</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

/* ---------- Hand over before deactivating ---------- */
function HandOverModal({ user, onClose }: { user: User; onClose: () => void }) {
  const users = useStore(s => s.users)
  const leads = useStore(s => s.leads)
  const tasks = useStore(s => s.tasks)
  const stages = useStore(s => s.stages)
  const others = users.filter(u => u.active && u.id !== user.id)

  const [mode, setMode] = useState<'one' | 'split'>('one')
  const [one, setOne] = useState(others[0]?.id ?? '')
  const [many, setMany] = useState<string[]>(() => others.map(u => u.id))
  const [result, setResult] = useState<{ name: string; leads: number; tasks: number }[] | null>(null)

  const openLeads = useMemo(() => splitLeads(leads.filter(l => l.ownerId === user.id), stages).open, [leads, stages, user.id])
  const pending = useMemo(() => tasks.filter(t => t.assigneeId === user.id && t.status === 'pending'), [tasks, user.id])
  const targets = mode === 'one' ? (one ? [one] : []) : others.filter(u => many.includes(u.id)).map(u => u.id)

  const run = () => {
    if (!targets.length) return
    const { setLeadOwner, update, log } = useStore.getState()
    const tally = new Map(targets.map(id => [id, { leads: 0, tasks: 0 }]))
    const leadTo = new Map<string, string>()
    openLeads.forEach((l, i) => { const to = targets[i % targets.length]; leadTo.set(l.id, to); setLeadOwner(l.id, to); tally.get(to)!.leads++ })
    // A task follows its lead to the same person; tasks without a moved lead are dealt out in turn.
    let k = 0
    pending.forEach(t => { const to = (t.leadId && leadTo.get(t.leadId)) || targets[k++ % targets.length]; update('tasks', t.id, { assigneeId: to }); tally.get(to)!.tasks++ })
    update('users', user.id, { active: false, available: false })
    const s = useStore.getState()
    if (s.settings.autoAssignUserIds.includes(user.id)) s.setSettings({ autoAssignUserIds: s.settings.autoAssignUserIds.filter(id => id !== user.id) })
    const res = targets.map(id => ({ name: users.find(u => u.id === id)?.name ?? '', ...tally.get(id)! }))
    log('system', `${user.name} deactivated. ${plural(openLeads.length, 'open lead')} and ${plural(pending.length, 'pending task')} handed over to ${res.map(r => r.name).join(', ')}.`)
    setResult(res)
  }

  if (result) {
    const tl = result.reduce((a, r) => a + r.leads, 0), tt = result.reduce((a, r) => a + r.tasks, 0)
    return (
      <Modal open onClose={onClose} title="Hand over complete" footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
        <p className="text-sm"><span className="font-semibold">{user.name}</span> is now inactive. Moved <span className="font-semibold">{plural(tl, 'open lead')}</span> and <span className="font-semibold">{plural(tt, 'pending task')}</span>:</p>
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border text-sm">
          {result.map(r => <li key={r.name} className="flex items-center justify-between gap-3 px-3 py-2"><span className="flex items-center gap-2"><Avatar name={r.name} color={users.find(u => u.name === r.name)?.color} size={22} />{r.name}</span><span className="text-muted">{plural(r.leads, 'lead')} · {plural(r.tasks, 'task')}</span></li>)}
        </ul>
        <p className="mt-3 text-xs text-muted">Won and lost leads and finished tasks stay under {user.name} so past reports do not change.</p>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} title={`Hand over ${user.name}'s work`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="danger" icon={ArrowRightLeft} disabled={!targets.length} onClick={run}>Hand over and deactivate</Button></>}>
      <p className="text-sm">{user.name} still owns <span className="font-semibold">{plural(openLeads.length, 'open lead')}</span> and <span className="font-semibold">{plural(pending.length, 'pending task')}</span>. Choose who takes them over before this user is deactivated.</p>
      {!others.length ? (
        <p className="mt-3 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-600">There is no other active user to hand over to. Add or activate another user first.</p>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="radio" name="ho-mode" className="mt-1 accent-[var(--c-brand)]" checked={mode === 'one'} onChange={() => setMode('one')} />
            <span className="flex-1"><span className="font-medium">Give everything to one person</span>
              {mode === 'one' && <Select className="mt-2" aria-label="Hand over to" value={one} onChange={e => setOne(e.target.value)}>{others.map(u => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role]}{u.available ? '' : ' (away)'}</option>)}</Select>}
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="radio" name="ho-mode" className="mt-1 accent-[var(--c-brand)]" checked={mode === 'split'} onChange={() => setMode('split')} />
            <span className="font-medium">Split evenly across several people</span>
          </label>
          {mode === 'split' && (
            <div className="ml-6 space-y-1.5">
              {others.map(u => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-[var(--c-brand)]" checked={many.includes(u.id)} onChange={e => setMany(m => (e.target.checked ? [...m, u.id] : m.filter(x => x !== u.id)))} />
                  <Avatar name={u.name} color={u.color} size={22} />{u.name}<span className="text-xs text-muted">{ROLE_LABEL[u.role]}{u.available ? '' : ' · away'}</span>
                </label>
              ))}
              {targets.length > 0 ? <p className="pt-1 text-xs text-muted">About {Math.ceil(openLeads.length / targets.length)} {openLeads.length / targets.length === 1 ? 'lead' : 'leads'} each. A task goes to whoever receives its lead.</p> : <p className="pt-1 text-xs text-rose-600">Tick at least one person.</p>}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

/* ---------- Profile ---------- */
function ProfileModal({ user, onClose, onEdit }: { user: User; onClose: () => void; onEdit: () => void }) {
  const users = useStore(s => s.users)
  const leads = useStore(s => s.leads)
  const tasks = useStore(s => s.tasks)
  const stages = useStore(s => s.stages)
  const activities = useStore(s => s.activities)

  const d = useMemo(() => {
    const mine = leads.filter(l => l.ownerId === user.id)
    const myTasks = tasks.filter(t => t.assigneeId === user.id)
    const now = Date.now()
    const pending = myTasks.filter(t => t.status === 'pending')
    const leadName = new Map(leads.map(l => [l.id, l.name]))
    return {
      total: mine.length,
      byStage: [...stages].sort((a, b) => a.order - b.order).map(st => ({ stage: st, count: mine.filter(l => l.stageId === st.id).length })),
      late: pending.filter(t => new Date(t.dueAt).getTime() < now).length, pending: pending.length, done: myTasks.filter(t => t.status === 'done').length,
      recent: activities.filter(a => a.userId === user.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8).map(a => ({ ...a, leadName: a.leadId ? leadName.get(a.leadId) : undefined })),
    }
  }, [leads, tasks, stages, activities, user.id])
  const boss = users.find(u => u.id === user.reportsTo)

  return (
    <Modal open wide onClose={onClose} title="Team member" footer={<><Button onClick={onClose}>Close</Button><Button variant="primary" icon={Pencil} onClick={onEdit}>Edit</Button></>}>
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={user.name} color={user.color} size={48} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{user.name}</p>
          <p className="break-all text-xs text-muted">{user.email}{user.phone && ` · ${user.phone}`}</p>
          <p className="text-xs text-muted">Joined {fmtDate(user.joinedAt)}{boss && ` · reports to ${boss.name}`}</p>
        </div>
        <div className="flex gap-1.5"><Badge tone={ROLE_TONE[user.role]}>{ROLE_LABEL[user.role]}</Badge><Badge tone={!user.active ? 'bad' : user.available ? 'good' : 'warn'}>{!user.active ? 'Inactive' : user.available ? 'Working' : 'Away'}</Badge></div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Mini label="Late tasks" value={<span className={d.late ? 'text-rose-600' : undefined}>{d.late}</span>} />
        <Mini label="Pending tasks" value={d.pending} sub={d.late ? `${d.late} of them late` : undefined} />
        <Mini label="Done tasks" value={d.done} />
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Leads by stage · {d.total}</h4>
          {d.total ? (
            <BarList rows={d.byStage.map(r => ({ key: r.stage.id, label: r.stage.label, value: r.count, color: r.stage.color, right: <span className="font-medium text-text">{r.count}</span> }))} />
          ) : <p className="text-sm text-muted">No leads are assigned to {user.name}.</p>}
        </div>
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Recent activity</h4>
          {d.recent.length ? (
            <ul className="space-y-2.5">
              {d.recent.map(a => (
                <li key={a.id} className="text-sm">
                  <p className="leading-snug">{a.text}</p>
                  <p className="text-xs text-muted">{timeAgo(a.at)}{a.leadId && a.leadName && <> · <Link to={`/leads/${a.leadId}`} onClick={onClose} className="text-brand hover:underline">{a.leadName}</Link></>}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Nothing logged by {user.name} yet.</p>}
        </div>
      </div>
    </Modal>
  )
}

/* ---------- Page ---------- */
const ROLE_HELP: { role: Role; summary: string; can: string[] }[] = [
  { role: 'admin', summary: 'Runs the account.', can: ['Everything a manager can do', 'Add, edit and deactivate users and change roles', 'Business settings, stages, sources, integrations and billing setup'] },
  { role: 'manager', summary: 'Leads a team of sales agents.', can: ['See and reassign every lead and task', 'Reports, analytics and the leaderboard for the whole team', 'Automations, campaigns and message templates'] },
  { role: 'sales', summary: 'Works the leads given to them.', can: ['Their own leads, tasks, calls and WhatsApp chats', 'Quotations and invoices for their customers', 'Their own numbers on the leaderboard'] },
]

export default function Team() {
  const users = useStore(s => s.users)
  const leads = useStore(s => s.leads)
  const tasks = useStore(s => s.tasks)
  const stages = useStore(s => s.stages)
  const currentUserId = useStore(s => s.currentUserId)

  const [role, setRole] = useState<'all' | Role>('all')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [q, setQ] = useState('')
  const [form, setForm] = useState<User | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [handOverId, setHandOverId] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)

  const load = useMemo(() => {
    const { open } = splitLeads(leads, stages)
    const m = new Map<string, { leads: number; tasks: number }>()
    const at = (id: string) => { let v = m.get(id); if (!v) { v = { leads: 0, tasks: 0 }; m.set(id, v) } return v }
    open.forEach(l => { if (l.ownerId) at(l.ownerId).leads++ })
    tasks.forEach(t => { if (t.status === 'pending') at(t.assigneeId).tasks++ })
    return m
  }, [leads, tasks, stages])

  const activeCount = users.filter(u => u.active).length
  const activeAdmins = users.filter(u => u.active && u.role === 'admin').length
  const term = q.trim().toLowerCase()
  const shown = users.filter(u =>
    (role === 'all' || u.role === role) && (status === 'all' || (status === 'active') === u.active) &&
    (!term || [u.name, u.email, u.phone].some(v => v.toLowerCase().includes(term))),
  )
  const filtered = role !== 'all' || status !== 'all' || !!term
  const handOver = users.find(u => u.id === handOverId)
  const profile = users.find(u => u.id === profileId)

  const setActive = (u: User, on: boolean) => {
    const { update } = useStore.getState()
    if (on) return update('users', u.id, { active: true, available: true })
    const w = load.get(u.id)
    if (w && (w.leads > 0 || w.tasks > 0)) return setHandOverId(u.id)
    update('users', u.id, { active: false, available: false })
    const s = useStore.getState()
    if (s.settings.autoAssignUserIds.includes(u.id)) s.setSettings({ autoAssignUserIds: s.settings.autoAssignUserIds.filter(id => id !== u.id) })
  }

  return (
    <div>
      <PageHeader
        title="Team" icon={Users}
        subtitle={`${plural(activeCount, 'seat')} in use · ${plural(users.length, 'user')} in total${users.length - activeCount ? ` (${users.length - activeCount} inactive)` : ''}`}
        actions={<><Button icon={Upload} onClick={() => setImporting(true)}>Import users</Button><Button variant="primary" icon={UserPlus} onClick={() => setForm('new')}>Add user</Button></>}
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input aria-label="Search users" className="pl-9" placeholder="Search name, email or phone" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Select aria-label="Role" className="w-auto" value={role} onChange={e => setRole(e.target.value as typeof role)}>
          <option value="all">All roles</option>{ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </Select>
        <Select aria-label="Status" className="w-auto" value={status} onChange={e => setStatus(e.target.value as typeof status)}>
          <option value="all">Active and inactive</option><option value="active">Active only</option><option value="inactive">Inactive only</option>
        </Select>
        {filtered && <Button variant="ghost" onClick={() => { setRole('all'); setStatus('all'); setQ('') }}>Clear filters</Button>}
      </div>

      <div className={tableWrap}>
        {!shown.length ? (
          <EmptyState icon={Users} title={filtered ? 'No users match these filters' : 'No users yet'} text={filtered ? 'Try a different search or clear the filters.' : 'Add the people who will work on leads.'}
            action={filtered ? <Button onClick={() => { setRole('all'); setStatus('all'); setQ('') }}>Clear filters</Button> : <Button variant="primary" icon={UserPlus} onClick={() => setForm('new')}>Add user</Button>} />
        ) : (
          <table className={tableCls}>
            <thead><tr>{['User', 'Role', 'Reports to', 'Email', 'Phone', 'Joined', 'Availability', 'Active', ''].map((h, i) => <th key={i} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>
              {shown.map(u => {
                const me = u.id === currentUserId
                const lastAdmin = u.active && u.role === 'admin' && activeAdmins <= 1
                const w = load.get(u.id)
                return (
                  <tr key={u.id} className={cn(trCls, !u.active && 'text-muted')}>
                    <td className={tdCls}>
                      <button onClick={() => setProfileId(u.id)} className="flex cursor-pointer items-center gap-2.5 text-left" title="Open profile">
                        <Avatar name={u.name} color={u.active ? u.color : undefined} size={30} />
                        <span className="whitespace-nowrap">
                          <span className="block font-medium text-text hover:text-brand">{u.name}{me && <span className="ml-1 text-xs font-semibold text-brand">(you)</span>}</span>
                          <span className="block text-xs text-muted">{w ? `${plural(w.leads, 'open lead')} · ${plural(w.tasks, 'pending task')}` : 'No open work'}</span>
                        </span>
                      </button>
                    </td>
                    <td className={tdCls}>
                      <div className="flex items-center gap-2">
                        <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                        <Select aria-label={`Role of ${u.name}`} className="h-8 w-32 text-xs" value={u.role} disabled={lastAdmin} onChange={e => useStore.getState().update('users', u.id, { role: e.target.value as Role })}>
                          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </Select>
                      </div>
                      {lastAdmin && <p className="mt-1 max-w-52 text-[11px] leading-tight text-muted">Only active admin. Make another user an admin before changing this role.</p>}
                    </td>
                    <td className={tdCls}>
                      <Select aria-label={`${u.name} reports to`} className="h-8 w-36 text-xs" value={u.reportsTo && users.some(x => x.id === u.reportsTo) ? u.reportsTo : ''} onChange={e => useStore.getState().update('users', u.id, { reportsTo: e.target.value || undefined })}>
                        <option value="">No one</option>
                        {users.filter(x => x.id !== u.id).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </Select>
                    </td>
                    <td className={tdCls + ' whitespace-nowrap'}>{u.email}</td>
                    <td className={tdCls + ' whitespace-nowrap'}>{u.phone || '—'}</td>
                    <td className={tdCls + ' whitespace-nowrap'}>{fmtDate(u.joinedAt)}</td>
                    <td className={tdCls}>
                      {u.active ? (
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <Toggle label={`${u.name} is working`} checked={u.available} onChange={v => useStore.getState().update('users', u.id, { available: v })} />
                          <span className={cn('text-xs font-medium', u.available ? 'text-emerald-600' : 'text-amber-600')}>{u.available ? 'Working' : 'Away'}</span>
                        </span>
                      ) : <span className="text-xs">—</span>}
                    </td>
                    <td className={tdCls}>
                      {me || lastAdmin ? (
                        <div>
                          <span className="flex items-center gap-2 whitespace-nowrap opacity-60"><span className="pointer-events-none"><Toggle label={`${u.name} is active`} checked={u.active} onChange={() => {}} /></span><span className="text-xs font-medium">Active</span></span>
                          <p className="mt-1 max-w-44 text-[11px] leading-tight text-muted">{me ? 'You cannot deactivate your own account.' : 'The last active admin cannot be deactivated.'}</p>
                        </div>
                      ) : (
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <Toggle label={`${u.name} is active`} checked={u.active} onChange={v => setActive(u, v)} />
                          <span className={cn('text-xs font-medium', u.active ? 'text-text' : 'text-rose-600')}>{u.active ? 'Active' : 'Inactive'}</span>
                        </span>
                      )}
                    </td>
                    <td className={tdCls}>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" icon={Eye} aria-label={`View ${u.name}`} title="View profile" onClick={() => setProfileId(u.id)} />
                        <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Edit ${u.name}`} title="Edit" onClick={() => setForm(u)} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">Showing {shown.length} of {users.length}. Deactivating keeps a user's history; if they still own open leads or pending tasks you will be asked who takes them over.</p>

      <Card className="mt-5" title={<span className="flex items-center gap-2"><ShieldCheck size={15} className="text-muted" />What each role can do</span>}>
        <div className="grid gap-4 p-4 md:grid-cols-3">
          {ROLE_HELP.map(r => (
            <div key={r.role}>
              <div className="flex items-center gap-2"><Badge tone={ROLE_TONE[r.role]}>{ROLE_LABEL[r.role]}</Badge><span className="text-xs text-muted">{plural(users.filter(u => u.active && u.role === r.role).length, 'active user')}</span></div>
              <p className="mt-2 text-sm font-medium">{r.summary}</p>
              <ul className="mt-1.5 space-y-1 text-sm text-muted">{r.can.map(c => <li key={c} className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-emerald-600" />{c}</li>)}</ul>
            </div>
          ))}
        </div>
        <p className="border-t border-border px-4 py-3 text-xs text-muted">
          These limits are not enforced yet. In this version everyone using this browser can open every screen; roles start restricting access when real sign-in is added in a later version. Until then roles are used for labels, reporting lines and the last-admin safeguard.
        </p>
      </Card>

      {form && <UserDrawer key={form === 'new' ? 'new' : form.id} user={form} onClose={() => setForm(null)} />}
      {importing && <ImportModal onClose={() => setImporting(false)} />}
      {handOver && <HandOverModal user={handOver} onClose={() => setHandOverId(null)} />}
      {profile && <ProfileModal user={profile} onClose={() => setProfileId(null)} onEdit={() => { setForm(profile); setProfileId(null) }} />}
    </div>
  )
}
