import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Bot, FileText, Megaphone, MessageCircle, Settings, Workflow } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { DemoNotice } from '@/components/ui'

const tabs = [
  { to: '/whatsapp/chat', label: 'Live chat', icon: MessageCircle },
  { to: '/whatsapp/ai-agent', label: 'AI agent', icon: Bot },
  { to: '/whatsapp/templates', label: 'Templates', icon: FileText },
  { to: '/whatsapp/flows', label: 'Bot flows', icon: Workflow },
  { to: '/whatsapp/campaigns', label: 'Campaigns', icon: Megaphone },
  { to: '/whatsapp/settings', label: 'Settings', icon: Settings },
]

export default function WhatsAppLayout() {
  const connected = useStore(s => s.integrations.find(i => i.id === 'in_wa')?.connected ?? false)
  const { pathname } = useLocation()
  const isIndex = pathname.replace(/\/+$/, '') === '/whatsapp'
  return (
    <div>
      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1" aria-label="WhatsApp sections">
        {tabs.map((t, i) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) => cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap',
              isActive || (i === 0 && isIndex) ? 'bg-brand-soft text-brand' : 'text-muted hover:text-text',
            )}
          >
            <t.icon size={14} />
            {t.label}
          </NavLink>
        ))}
      </nav>
      {!connected && (
        <DemoNotice>
          <strong>Demo mode.</strong> Messages here are simulated and are not delivered to customers until a WhatsApp Business API number is connected in{' '}
          <Link to="/integrations" className="font-semibold underline">Integrations</Link>.
        </DemoNotice>
      )}
      <Outlet />
    </div>
  )
}
