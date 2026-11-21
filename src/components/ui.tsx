/* Shared UI kit. Use these everywhere so all pages look the same. */
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { X, type LucideIcon } from 'lucide-react'
import { cn, initials } from '@/lib/utils'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; icon?: LucideIcon }
export function Button({ variant = 'secondary', size = 'md', icon: Icon, className, children, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-brand text-brand-fg hover:opacity-90',
        variant === 'secondary' && 'bg-surface border border-border text-text hover:bg-surface-2',
        variant === 'ghost' && 'text-muted hover:text-text hover:bg-surface-2',
        variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-700',
        className,
      )}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  )
}

const fieldCls = 'w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text placeholder:text-muted outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cn(fieldCls, className)} />
export const Select = ({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cn(fieldCls, 'pr-8 cursor-pointer', className)}>{children}</select>
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cn(fieldCls, 'h-auto min-h-20 py-2', className)} />

/** Label + control + optional hint, stacked. */
export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Card({ className, children, title, action }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cn('rounded-xl border border-border bg-surface', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

/** Page title row. Put the page's main buttons in `actions`. */
export function PageHeader({ title, subtitle, icon: Icon, actions }: { title: string; subtitle?: ReactNode; icon?: LucideIcon; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {Icon && <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand"><Icon size={18} /></span>}
        <div>
          <h1 className="text-lg font-semibold leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  )
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'default' }: { label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; tone?: 'default' | 'good' | 'bad' | 'warn' }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted">
        {label}
        {Icon && <Icon size={16} />}
      </div>
      <div className={cn('mt-1 text-2xl font-semibold', tone === 'good' && 'text-emerald-600', tone === 'bad' && 'text-rose-600', tone === 'warn' && 'text-amber-600')}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  )
}

/** Coloured pill. Pass `color` (hex) for stage/source colours, or a `tone`. */
export function Badge({ children, color, tone = 'neutral', className }: { children: ReactNode; color?: string; tone?: 'neutral' | 'good' | 'bad' | 'warn' | 'info' | 'brand'; className?: string }) {
  const tones = {
    neutral: 'bg-surface-2 text-muted', good: 'bg-emerald-500/15 text-emerald-600', bad: 'bg-rose-500/15 text-rose-600',
    warn: 'bg-amber-500/15 text-amber-600', info: 'bg-sky-500/15 text-sky-600', brand: 'bg-brand-soft text-brand',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', !color && tones[tone], className)} style={color ? { background: color + '22', color } : undefined}>
      {children}
    </span>
  )
}

export function Avatar({ name, color, size = 28 }: { name: string; color?: string; size?: number }) {
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.4, background: color ?? '#78716c' }}>
      {initials(name)}
    </span>
  )
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
}

/** Centered dialog. `footer` is for the action buttons. */
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEscape(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onMouseDown={onClose}>
      <div className={cn('flex max-h-[90vh] w-full flex-col rounded-xl border border-border bg-surface shadow-xl', wide ? 'max-w-3xl' : 'max-w-lg')} onMouseDown={e => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-text cursor-pointer" aria-label="Close"><X size={18} /></button>
        </header>
        <div className="overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</footer>}
      </div>
    </div>
  )
}

/** Right-side panel for create/edit forms. */
export function Drawer({ open, onClose, title, children, footer, width = 480 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEscape(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onMouseDown={onClose}>
      <aside className="absolute inset-y-0 right-0 flex max-w-full flex-col border-l border-border bg-surface shadow-xl" style={{ width }} onMouseDown={e => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-text cursor-pointer" aria-label="Close"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</footer>}
      </aside>
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: string; count?: number; icon?: LucideIcon }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('inline-flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1', className)}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer', value === t.id ? 'bg-brand-soft text-brand' : 'text-muted hover:text-text')}>
          {t.icon && <t.icon size={14} />}
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-surface-2 px-1.5 text-[10px] text-muted">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, text, action }: { icon?: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && <span className="mb-3 grid size-11 place-items-center rounded-xl bg-surface-2 text-muted"><Icon size={20} /></span>}
      <p className="font-medium">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors cursor-pointer', checked ? 'bg-brand' : 'bg-border')}>
      <span className={cn('absolute top-0.5 size-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
    </button>
  )
}

/** Banner for screens that need an outside account (WhatsApp, telephony, AI) before they work for real. */
export function DemoNotice({ children }: { children: ReactNode }) {
  return <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400">{children}</div>
}

/* Table helpers: <div className={tableWrap}><table className={tableCls}><thead><tr><th className={thCls}>…  <td className={tdCls}> */
export const tableWrap = 'overflow-x-auto rounded-xl border border-border bg-surface'
export const tableCls = 'w-full text-sm'
export const thCls = 'whitespace-nowrap border-b border-border bg-surface-2/60 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted'
export const tdCls = 'border-b border-border px-3 py-2.5 align-middle'
export const trCls = 'hover:bg-surface-2/50'
