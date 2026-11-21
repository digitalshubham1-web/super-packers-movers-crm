import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity, BarChart3, Bell, Bot, CalendarDays, CheckSquare, FileText, Headphones, Home, IndianRupee, Mail, Menu, MessageCircle, Moon, Package,
  PhoneCall, PhoneForwarded, PieChart, Plug, Plus, Search, Settings as SettingsIcon, Sparkles, Sun, Trophy, Truck, Users, UsersRound, Wallet, Zap, FileSpreadsheet, TrendingUp,
} from 'lucide-react'
import { useCurrentUser, useStore } from '@/lib/store'
import { cn, timeAgo } from '@/lib/utils'
import { Avatar, Button } from './ui'
import Assistant from './Assistant'
import LeadForm from './LeadForm'

const NAV = [
  { group: 'Work', items: [
    { to: '/', label: 'Dashboard', icon: Home, end: true },
    { to: '/leads', label: 'Leads', icon: Users },
    { to: '/tasks', label: 'Tasks', icon: CheckSquare },
    { to: '/calendar', label: 'Calendar', icon: CalendarDays },
    { to: '/activities', label: 'Activity', icon: Activity },
  ]},
  { group: 'Reach out', items: [
    { to: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { to: '/calling', label: 'Calling', icon: PhoneCall },
    { to: '/call-campaigns', label: 'Call campaigns', icon: PhoneForwarded },
    { to: '/voice-agents', label: 'AI voice agents', icon: Headphones },
    { to: '/email', label: 'Email', icon: Mail },
    { to: '/automations', label: 'Automations', icon: Zap },
  ]},
  { group: 'Billing', items: [
    { to: '/billing/quotations', label: 'Quotations', icon: FileSpreadsheet },
    { to: '/billing/invoices', label: 'Invoices', icon: FileText },
    { to: '/billing/payments', label: 'Payments', icon: Wallet },
    { to: '/billing/items', label: 'Items', icon: Package },
    { to: '/billing/revenue', label: 'Revenue', icon: IndianRupee },
  ]},
  { group: 'Insights', items: [
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/reports/leads', label: 'Lead reports', icon: PieChart },
    { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  ]},
  { group: 'Admin', items: [
    { to: '/team', label: 'Team', icon: UsersRound },
    { to: '/integrations', label: 'Integrations', icon: Plug },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
  ]},
]

export default function Layout() {
  const user = useCurrentUser()
  const { theme, setTheme, notifications, users, setCurrentUser, update, leads } = useStore()
  const [navOpen, setNavOpen] = useState(false)
  const [assistant, setAssistant] = useState(false)
  const [newLead, setNewLead] = useState(false)
  const [bell, setBell] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const [q, setQ] = useState('')
  const nav = useNavigate()
  const loc = useLocation()

  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark') }, [theme])
  useEffect(() => { setNavOpen(false); setBell(false); setUserMenu(false); setQ('') }, [loc.pathname])

  const unread = notifications.filter(n => !n.read).length
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (t.length < 2) return []
    return leads.filter(l => l.name.toLowerCase().includes(t) || l.phone.includes(t) || String(l.no).includes(t)).slice(0, 6)
  }, [q, leads])

  return (
    <div className="flex h-full">
      {navOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setNavOpen(false)} />}
      <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-surface transition-transform lg:static lg:translate-x-0', navOpen ? 'translate-x-0' : '-translate-x-full')}>
        <Link to="/" className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
          <span className="grid size-9 place-items-center rounded-lg bg-brand text-white"><Truck size={18} /></span>
          <span className="leading-tight">
            <span className="block text-sm font-bold">Super Packers</span>
            <span className="block text-[11px] text-muted">and Movers CRM</span>
          </span>
        </Link>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV.map(g => (
            <div key={g.group} className="mb-3">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{g.group}</div>
              {g.items.map(i => (
                <NavLink key={i.to} to={i.to} end={'end' in i ? i.end : false} className={({ isActive }) => cn('flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm', isActive ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:bg-surface-2 hover:text-text')}>
                  <i.icon size={16} /> {i.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-border p-3 text-[11px] text-muted">Data is saved in this browser only.</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 lg:px-5">
          <button className="rounded p-1.5 text-muted hover:bg-surface-2 lg:hidden cursor-pointer" onClick={() => setNavOpen(true)} aria-label="Menu"><Menu size={20} /></button>
          <div className="relative max-w-md flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search leads by name, phone or number…" className="h-9 w-full rounded-lg border border-border bg-bg pl-9 pr-3 text-sm outline-none focus:border-brand" />
            {hits.length > 0 && (
              <div className="absolute left-0 right-0 top-10 z-30 rounded-lg border border-border bg-surface p-1 shadow-lg">
                {hits.map(l => (
                  <button key={l.id} onClick={() => nav(`/leads/${l.id}`)} className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-surface-2 cursor-pointer">
                    <span>{l.name}</span><span className="text-xs text-muted">#{l.no} · {l.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setNewLead(true)}><span className="hidden sm:inline">New lead</span></Button>
            <Button size="sm" icon={Sparkles} onClick={() => setAssistant(true)}><span className="hidden sm:inline">Assistant</span></Button>
            <Link to="/reports/leads" className="hidden rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text md:block" title="Lead reports"><TrendingUp size={17} /></Link>
            <Link to="/whatsapp/ai-agent" className="hidden rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text md:block" title="WhatsApp AI agent"><Bot size={17} /></Link>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text cursor-pointer" aria-label="Switch theme">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
            <div className="relative">
              <button onClick={() => { setBell(!bell); setUserMenu(false) }} className="relative rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text cursor-pointer" aria-label="Notifications">
                <Bell size={17} />
                {unread > 0 && <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">{unread}</span>}
              </button>
              {bell && (
                <div className="absolute right-0 top-11 z-30 w-80 rounded-xl border border-border bg-surface shadow-xl">
                  <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                    <span className="text-sm font-semibold">Notifications</span>
                    <button className="text-xs text-brand cursor-pointer" onClick={() => notifications.forEach(n => !n.read && update('notifications', n.id, { read: true }))}>Mark all read</button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 && <p className="p-4 text-sm text-muted">Nothing new.</p>}
                    {notifications.slice(0, 20).map(n => (
                      <button key={n.id} onClick={() => { update('notifications', n.id, { read: true }); if (n.link) nav(n.link); setBell(false) }} className="flex w-full gap-2 border-b border-border px-4 py-2.5 text-left hover:bg-surface-2 cursor-pointer">
                        <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-brand')} />
                        <span><span className="block text-sm font-medium">{n.title}</span><span className="block text-xs text-muted">{n.body} · {timeAgo(n.at)}</span></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={() => { setUserMenu(!userMenu); setBell(false) }} className="cursor-pointer" aria-label="Account"><Avatar name={user.name} color={user.color} size={32} /></button>
              {userMenu && (
                <div className="absolute right-0 top-11 z-30 w-64 rounded-xl border border-border bg-surface p-2 shadow-xl">
                  <div className="px-2 py-1.5"><div className="text-sm font-semibold">{user.name}</div><div className="text-xs capitalize text-muted">{user.role}</div></div>
                  <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted">View the app as</div>
                  {users.filter(u => u.active).map(u => (
                    <button key={u.id} onClick={() => { setCurrentUser(u.id); setUserMenu(false) }} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2 cursor-pointer', u.id === user.id && 'bg-surface-2')}>
                      <Avatar name={u.name} color={u.color} size={22} /> {u.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6"><Outlet /></main>
      </div>

      <Assistant open={assistant} onClose={() => setAssistant(false)} />
      <LeadForm open={newLead} onClose={() => setNewLead(false)} />
    </div>
  )
}
