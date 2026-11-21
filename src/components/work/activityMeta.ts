import { Activity as ActivityIcon, ArrowRightLeft, CheckSquare, FileText, Mail, MessageCircle, Phone, Receipt, Settings, StickyNote, UserCheck, type LucideIcon } from 'lucide-react'
import type { ActivityType } from '@/lib/types'

export const ACTIVITY_TYPES: Record<ActivityType, { label: string; icon: LucideIcon; cls: string }> = {
  note: { label: 'Note', icon: StickyNote, cls: 'bg-amber-500/15 text-amber-600' },
  call: { label: 'Call', icon: Phone, cls: 'bg-sky-500/15 text-sky-600' },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, cls: 'bg-emerald-500/15 text-emerald-600' },
  email: { label: 'Email', icon: Mail, cls: 'bg-sky-500/15 text-sky-600' },
  stage: { label: 'Stage change', icon: ArrowRightLeft, cls: 'bg-brand-soft text-brand' },
  owner: { label: 'Owner change', icon: UserCheck, cls: 'bg-brand-soft text-brand' },
  task: { label: 'Task', icon: CheckSquare, cls: 'bg-amber-500/15 text-amber-600' },
  system: { label: 'System', icon: Settings, cls: 'bg-surface-2 text-muted' },
  invoice: { label: 'Invoice', icon: Receipt, cls: 'bg-emerald-500/15 text-emerald-600' },
  quotation: { label: 'Quotation', icon: FileText, cls: 'bg-rose-500/15 text-rose-600' },
}
export const activityMeta = (t: ActivityType) => ACTIVITY_TYPES[t] ?? { label: t, icon: ActivityIcon, cls: 'bg-surface-2 text-muted' }
