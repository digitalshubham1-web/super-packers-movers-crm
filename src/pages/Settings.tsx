import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bell, Building2, Database, FileText, GitBranch, ListChecks, Moon, Palette, Radio, Settings as SettingsIcon, SlidersHorizontal, Sun, XCircle, type LucideIcon } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Settings } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Badge, Button, Card, Field, Input, PageHeader, Select, Textarea, Toggle } from '@/components/ui'
import { SavedTag, useSaved } from '@/components/admin/shared'
import { CustomFieldsSection, OptionsSection, StagesSection, TaskTypesSection } from '@/components/admin/SettingsLists'
import { DataSection } from '@/components/admin/SettingsData'

const SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'general', label: 'General', icon: Building2 },
  { id: 'stages', label: 'Lead stages', icon: GitBranch },
  { id: 'sources', label: 'Lead sources', icon: Radio },
  { id: 'lost-reasons', label: 'Lost reasons', icon: XCircle },
  { id: 'custom-fields', label: 'Custom fields', icon: SlidersHorizontal },
  { id: 'task-types', label: 'Task types', icon: ListChecks },
  { id: 'billing', label: 'Billing', icon: FileText },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'data', label: 'Data', icon: Database },
]
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York']

function FormCard({ title, saved, onSave, error, children }: { title: string; saved: boolean; onSave: () => void; error?: string; children: ReactNode }) {
  return (
    <Card title={title}>
      <form className="space-y-4 p-4" onSubmit={e => { e.preventDefault(); onSave() }}>
        {children}
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <div className="flex items-center gap-3"><Button type="submit" variant="primary">Save changes</Button><SavedTag show={saved} /></div>
      </form>
    </Card>
  )
}

function General() {
  const settings = useStore(s => s.settings)
  const [f, setF] = useState(settings)
  const [saved, flash] = useSaved()
  const [error, setError] = useState('')
  useEffect(() => setF(settings), [settings])
  const set = (p: Partial<Settings>) => setF(x => ({ ...x, ...p }))
  const save = () => {
    if (!f.businessName.trim()) { setError('Type your business name.'); return }
    if (f.gstin.trim() && !/^[0-9A-Z]{15}$/.test(f.gstin.trim().toUpperCase())) { setError('A GSTIN has 15 letters and digits. Leave it empty if you do not have one.'); return }
    if (f.workStart >= f.workEnd) { setError('Working hours must end after they start.'); return }
    if (!f.workDays.length) { setError('Tick at least one working day.'); return }
    setError('')
    useStore.getState().setSettings({
      businessName: f.businessName.trim(), businessPhone: f.businessPhone.trim(), businessEmail: f.businessEmail.trim(), businessAddress: f.businessAddress.trim(),
      gstin: f.gstin.trim().toUpperCase(), timezone: f.timezone, workStart: f.workStart, workEnd: f.workEnd, workDays: [...f.workDays].sort(),
    })
    flash()
  }
  const zones = ZONES.includes(f.timezone) ? ZONES : [f.timezone, ...ZONES]
  return (
    <FormCard title="General" saved={saved} onSave={save} error={error}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" className="sm:col-span-2"><Input value={f.businessName} onChange={e => set({ businessName: e.target.value })} /></Field>
        <Field label="Phone"><Input value={f.businessPhone} onChange={e => set({ businessPhone: e.target.value })} placeholder="+91 98100 00001" /></Field>
        <Field label="Email"><Input type="email" value={f.businessEmail} onChange={e => set({ businessEmail: e.target.value })} /></Field>
        <Field label="Address" className="sm:col-span-2"><Textarea value={f.businessAddress} onChange={e => set({ businessAddress: e.target.value })} /></Field>
        <Field label="GSTIN" hint="Printed on invoices and quotations."><Input value={f.gstin} onChange={e => set({ gstin: e.target.value })} placeholder="06ABCDE1234F1Z5" maxLength={15} /></Field>
        <Field label="Currency" hint="Fixed to Indian Rupees (₹)."><Input value={f.currency} readOnly disabled /></Field>
        <Field label="Time zone">
          <Select value={f.timezone} onChange={e => set({ timezone: e.target.value })}>{zones.map(z => <option key={z} value={z}>{z}</option>)}</Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Work starts"><Input type="time" value={f.workStart} onChange={e => set({ workStart: e.target.value })} /></Field>
          <Field label="Work ends"><Input type="time" value={f.workEnd} onChange={e => set({ workEnd: e.target.value })} /></Field>
        </div>
      </div>
      <div>
        <span className="mb-1.5 block text-xs font-medium text-muted">Working days</span>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d, i) => {
            const on = f.workDays.includes(i)
            return <button key={d} type="button" aria-pressed={on} onClick={() => set({ workDays: on ? f.workDays.filter(x => x !== i) : [...f.workDays, i] })}
              className={cn('h-9 w-12 rounded-lg border text-xs font-medium cursor-pointer', on ? 'border-brand bg-brand-soft text-brand' : 'border-border bg-surface text-muted')}>{d}</button>
          })}
        </div>
      </div>
    </FormCard>
  )
}

function Billing() {
  const settings = useStore(s => s.settings)
  const [f, setF] = useState({ invoicePrefix: settings.invoicePrefix, quotationPrefix: settings.quotationPrefix, defaultTax: String(settings.defaultTax), invoiceTerms: settings.invoiceTerms })
  const [saved, flash] = useSaved()
  const [error, setError] = useState('')
  useEffect(() => setF({ invoicePrefix: settings.invoicePrefix, quotationPrefix: settings.quotationPrefix, defaultTax: String(settings.defaultTax), invoiceTerms: settings.invoiceTerms }), [settings])
  const save = () => {
    const tax = Number(f.defaultTax)
    if (!f.invoicePrefix.trim() || !f.quotationPrefix.trim()) { setError('Both prefixes are needed, for example INV- and QT-.'); return }
    if (f.defaultTax.trim() === '' || Number.isNaN(tax) || tax < 0 || tax > 28) { setError('Default GST must be between 0 and 28 percent.'); return }
    setError('')
    useStore.getState().setSettings({ invoicePrefix: f.invoicePrefix.trim(), quotationPrefix: f.quotationPrefix.trim(), defaultTax: tax, invoiceTerms: f.invoiceTerms.trim() })
    flash()
  }
  return (
    <FormCard title="Billing" saved={saved} onSave={save} error={error}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Invoice number prefix" hint={`Next looks like ${f.invoicePrefix}0007`}><Input value={f.invoicePrefix} onChange={e => setF({ ...f, invoicePrefix: e.target.value })} /></Field>
        <Field label="Quotation number prefix" hint={`Next looks like ${f.quotationPrefix}0007`}><Input value={f.quotationPrefix} onChange={e => setF({ ...f, quotationPrefix: e.target.value })} /></Field>
        <Field label="Default GST %" hint="Used for new items and lines.">
          <Input type="number" min={0} max={28} step="0.5" value={f.defaultTax} onChange={e => setF({ ...f, defaultTax: e.target.value })} />
        </Field>
      </div>
      <Field label="Invoice terms" hint="Printed at the bottom of every invoice."><Textarea className="min-h-28" value={f.invoiceTerms} onChange={e => setF({ ...f, invoiceTerms: e.target.value })} /></Field>
    </FormCard>
  )
}

function Notifications() {
  const notifyTaskDue = useStore(s => s.settings.notifyTaskDue)
  const notifyNewLead = useStore(s => s.settings.notifyNewLead)
  const businessName = useStore(s => s.settings.businessName)
  const [saved, flash] = useSaved()
  const supported = typeof window !== 'undefined' && 'Notification' in window
  const [perm, setPerm] = useState<string>(supported ? Notification.permission : 'unsupported')
  const set = (p: Partial<Settings>) => { useStore.getState().setSettings(p); flash() }
  const ask = async () => {
    if (!supported) return
    try {
      const res = await Notification.requestPermission()
      setPerm(res)
      if (res === 'granted') new Notification(businessName, { body: 'Browser notifications are switched on for this CRM.' })
    } catch { setPerm(Notification.permission) }
  }
  const PERM: Record<string, { label: string; tone: 'good' | 'bad' | 'warn' | 'neutral'; text: string }> = {
    granted: { label: 'Allowed', tone: 'good', text: 'This browser can show CRM notifications.' },
    denied: { label: 'Blocked', tone: 'bad', text: 'Notifications are blocked. Allow them for this site in your browser’s site settings (the padlock icon in the address bar), then reload.' },
    default: { label: 'Not asked yet', tone: 'warn', text: 'Press the button and choose Allow when your browser asks.' },
    unsupported: { label: 'Not supported', tone: 'neutral', text: 'This browser does not support notifications.' },
  }
  const p = PERM[perm] ?? PERM.default
  return (
    <Card title={<span className="flex items-center gap-2">Notifications <SavedTag show={saved} /></span>}>
      <div className="divide-y divide-border">
        <div className="flex items-center justify-between gap-3 p-4">
          <div><p className="text-sm font-medium">Task due reminders</p><p className="text-xs text-muted">Notify when a task is about to be due or becomes overdue.</p></div>
          <Toggle checked={notifyTaskDue} onChange={v => set({ notifyTaskDue: v })} label="Task due reminders" />
        </div>
        <div className="flex items-center justify-between gap-3 p-4">
          <div><p className="text-sm font-medium">New lead alerts</p><p className="text-xs text-muted">Notify when a new lead is captured or assigned.</p></div>
          <Toggle checked={notifyNewLead} onChange={v => set({ notifyNewLead: v })} label="New lead alerts" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-medium">Browser notifications <Badge tone={p.tone}>{p.label}</Badge></p>
            <p className="text-xs text-muted">{p.text} Notifications appear only while the CRM is open in a browser tab.</p>
          </div>
          <Button icon={Bell} disabled={!supported || perm === 'denied'} onClick={ask}>{perm === 'granted' ? 'Send a test notification' : 'Allow browser notifications'}</Button>
        </div>
      </div>
    </Card>
  )
}

function Appearance() {
  const theme = useStore(s => s.theme)
  const [saved, flash] = useSaved()
  const opts: { id: 'light' | 'dark'; label: string; icon: LucideIcon; text: string }[] = [
    { id: 'light', label: 'Light', icon: Sun, text: 'Bright background, best in daylight.' },
    { id: 'dark', label: 'Dark', icon: Moon, text: 'Dark background, easier on the eyes at night.' },
  ]
  return (
    <Card title={<span className="flex items-center gap-2">Appearance <SavedTag show={saved} /></span>}>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {opts.map(o => (
          <button key={o.id} type="button" aria-pressed={theme === o.id} onClick={() => { useStore.getState().setTheme(o.id); flash() }}
            className={cn('flex items-start gap-3 rounded-xl border p-4 text-left cursor-pointer', theme === o.id ? 'border-brand bg-brand-soft' : 'border-border bg-surface hover:bg-surface-2')}>
            <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', theme === o.id ? 'bg-brand text-brand-fg' : 'bg-surface-2 text-muted')}><o.icon size={18} /></span>
            <span><span className="block text-sm font-semibold">{o.label}{theme === o.id && <span className="ml-2 text-xs font-medium text-brand">In use</span>}</span><span className="block text-xs text-muted">{o.text}</span></span>
          </button>
        ))}
      </div>
    </Card>
  )
}

export default function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('section') ?? 'general'
  const section = SECTIONS.some(s => s.id === raw) ? raw : 'general'
  const go = (id: string) => setParams(p => { const n = new URLSearchParams(p); n.set('section', id); return n }, { replace: true })

  return (
    <div>
      <PageHeader title="Settings" icon={SettingsIcon} subtitle="Business details, pipeline, billing and data" />
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <nav aria-label="Settings sections" className="shrink-0 rounded-xl border border-border bg-surface p-1.5 md:sticky md:top-4 md:w-52">
          <ul className="grid grid-cols-2 gap-0.5 sm:grid-cols-3 md:grid-cols-1">
            {SECTIONS.map(s => (
              <li key={s.id}>
                <button onClick={() => go(s.id)} aria-current={section === s.id ? 'page' : undefined}
                  className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm cursor-pointer', section === s.id ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:bg-surface-2 hover:text-text')}>
                  <s.icon size={15} className="shrink-0" /><span className="truncate">{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 flex-1">
          {section === 'general' && <General />}
          {section === 'stages' && <StagesSection />}
          {section === 'sources' && <OptionsSection key="sources" col="sources" />}
          {section === 'lost-reasons' && <OptionsSection key="lostReasons" col="lostReasons" />}
          {section === 'custom-fields' && <CustomFieldsSection />}
          {section === 'task-types' && <TaskTypesSection />}
          {section === 'billing' && <Billing />}
          {section === 'notifications' && <Notifications />}
          {section === 'appearance' && <Appearance />}
          {section === 'data' && <DataSection />}
        </div>
      </div>
    </div>
  )
}
