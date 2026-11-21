/* Small chart and number helpers shared by the Insights pages (Analytics, Lead reports, Leaderboard, Team). */
import type { ReactNode } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { Lead, Stage } from '@/lib/types'
import { cn } from '@/lib/utils'

export const tooltipStyle = {
  background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 12, color: 'var(--c-text)',
} as const
export const axisTick = { fontSize: 11, fill: 'var(--c-muted)' } as const

/** Status colours that read on both themes (same hues as the emerald/amber/rose/sky tints). */
export const TONE = { good: '#16a34a', warn: '#f59e0b', bad: '#ef4444', info: '#0ea5e9', violet: '#8b5cf6', muted: 'var(--c-muted)', brand: 'var(--c-brand)' } as const

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)
export const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0)
/** "1h 12m", "4m 05s", "32s" */
export const talkTime = (sec: number) => {
  if (sec >= 3600) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
  if (sec >= 60) return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`
  return `${Math.round(sec)}s`
}

/** Won / lost / open split of a list of leads, using the stage flags. */
export function splitLeads(leads: Lead[], stages: Stage[]) {
  const wonIds = new Set(stages.filter(s => s.isWon).map(s => s.id))
  const lostIds = new Set(stages.filter(s => s.isLost).map(s => s.id))
  const won = leads.filter(l => wonIds.has(l.stageId))
  const lost = leads.filter(l => lostIds.has(l.stageId))
  const open = leads.filter(l => !wonIds.has(l.stageId) && !lostIds.has(l.stageId))
  return { won, lost, open, wonIds, lostIds }
}

export interface Slice { name: string; value: number; color: string }

/** Donut with a centre label and a legend that lists every slice with its number and share. */
export function Donut({ data, centre, centreSub, format = String, size = 170 }: { data: Slice[]; centre?: ReactNode; centreSub?: string; format?: (n: number) => string; size?: number }) {
  const total = sum(data, d => d.value)
  const shown = data.filter(d => d.value > 0)
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={shown.length ? shown : [{ name: 'No data', value: 1, color: 'var(--c-border)' }]} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={shown.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
              {(shown.length ? shown : [{ name: 'No data', value: 1, color: 'var(--c-border)' }]).map(d => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            {shown.length > 0 && <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--c-text)' }} formatter={v => format(Number(v))} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-semibold leading-none">{centre ?? format(total)}</span>
          {centreSub && <span className="mt-1 text-[11px] text-muted">{centreSub}</span>}
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5 text-sm">
        {data.map(d => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 truncate">{d.name}</span>
            <span className="font-medium tabular-nums">{format(d.value)}</span>
            <span className="w-10 text-right text-xs text-muted tabular-nums">{pct(d.value, total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export interface BarRow { key: string; label: ReactNode; value: number; color?: string; right: ReactNode }

/** Horizontal bars: label on the left, numbers on the right, bar underneath. */
export function BarList({ rows, max }: { rows: BarRow[]; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map(r => r.value))
  return (
    <ul className="space-y-3">
      {rows.map(r => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 text-xs text-muted tabular-nums">{r.right}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full" style={{ width: `${top > 0 ? Math.max(r.value > 0 ? 2 : 0, (r.value / top) * 100) : 0}%`, background: r.color ?? 'var(--c-brand)' }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Change against the previous period. `lowerIsBetter` flips the colour (e.g. overdue follow-ups). */
export function Delta({ now, prev, format = n => String(n), formatPrev, lowerIsBetter, hasPrev }: { now: number; prev: number; format?: (n: number) => string; formatPrev?: (n: number) => string; lowerIsBetter?: boolean; hasPrev: boolean }) {
  if (!hasPrev) return <span>No earlier period to compare</span>
  const d = now - prev
  if (Math.abs(d) < 1e-9) return <span>Same as the previous period</span>
  const good = lowerIsBetter ? d < 0 : d > 0
  return (
    <span>
      <span className={cn('font-medium', good ? 'text-emerald-600' : 'text-rose-600')}>{d > 0 ? '▲ +' : '▼ −'}{format(Math.abs(d))}</span> vs previous period ({(formatPrev ?? format)(prev)})
    </span>
  )
}

export function Mini({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-lg bg-surface-2/60 px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-semibold leading-tight tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  )
}
