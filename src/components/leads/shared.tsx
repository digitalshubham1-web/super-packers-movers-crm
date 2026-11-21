/* Helpers shared by the Leads list, the lead page and the lead form. */
import { useState } from 'react'
import { Star } from 'lucide-react'
import { useStore } from '@/lib/store'
import { Button, Field, Modal, Select } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Activity, Lead, Stage } from '@/lib/types'

export const HOME_SIZES = ['1 BHK', '2 BHK', '3 BHK', 'Villa', 'Office', 'Few items', 'Vehicle only']

/** Digits only, last 10 — used for tel:, wa.me and duplicate checks. */
export const phoneDigits = (p?: string) => (p ?? '').replace(/\D/g, '').slice(-10)
export const waLink = (p?: string) => `https://wa.me/91${phoneDigits(p)}`
export const telLink = (p?: string) => `tel:+91${phoneDigits(p)}`

/** Asks why one or more leads were lost, then moves them to the given Lost stage. */
export function LostReasonModal({ open, onClose, leadIds, stageId }: { open: boolean; onClose: () => void; leadIds: string[]; stageId: string }) {
  const reasons = useStore(s => s.lostReasons)
  const [reasonId, setReasonId] = useState('')
  const save = () => {
    const { setLeadStage } = useStore.getState()
    const rid = reasonId || reasons[0]?.id
    leadIds.forEach(id => setLeadStage(id, stageId, rid))
    setReasonId('')
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={leadIds.length > 1 ? `Mark ${leadIds.length} leads as lost` : 'Mark lead as lost'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="danger" onClick={save}>Mark as lost</Button></>}
    >
      <Field label="Why was this lead lost?" hint="The reason is used in the lost-lead reports.">
        <Select value={reasonId || reasons[0]?.id || ''} onChange={e => setReasonId(e.target.value)}>
          {reasons.length === 0 && <option value="">No reasons set up</option>}
          {reasons.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </Select>
      </Field>
    </Modal>
  )
}

export function Stars({ value, onChange, size = 16 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => {
        const star = <Star size={size} className={cn(n <= value ? 'fill-amber-500 text-amber-500' : 'text-muted')} />
        return onChange
          ? <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`} title={n === value ? 'Click to clear' : `${n} of 5`} onClick={() => onChange(n === value ? 0 : n)} className="cursor-pointer rounded p-0.5 hover:bg-surface-2">{star}</button>
          : <span key={n}>{star}</span>
      })}
    </span>
  )
}

export interface ScoreRule { label: string; detail: string; points: number; max: number }

/** Rule-based engagement score (0–100). No AI involved: every point comes from one of the rules below. */
export function engagementScore(lead: Lead, stages: Stage[], activities: Activity[], hasBillingDoc: boolean): { total: number; rules: ScoreRule[] } {
  const now = Date.now()
  const rules: ScoreRule[] = []

  const touches = activities.filter(a => a.leadId === lead.id && ['call', 'whatsapp', 'email', 'note'].includes(a.type))
  const last = touches.reduce((m, a) => Math.max(m, new Date(a.at).getTime()), 0)
  const days = last ? (now - last) / 864e5 : Infinity
  rules.push({
    label: 'Recent contact', max: 25,
    points: days <= 3 ? 25 : days <= 7 ? 15 : days <= 14 ? 8 : 0,
    detail: last ? `Last call, message or note ${Math.floor(days)} day${Math.floor(days) === 1 ? '' : 's'} ago (3 days = 25, 7 = 15, 14 = 8)` : 'No call, message or note yet',
  })

  const fu = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).getTime() : 0
  rules.push({
    label: 'Follow-up planned', max: 15,
    points: !fu ? 0 : fu >= now ? 15 : 5,
    detail: !fu ? 'No follow-up date set' : fu >= now ? 'A follow-up is scheduled' : 'Follow-up date has passed (5 instead of 15)',
  })

  const stage = stages.find(s => s.id === lead.stageId)
  const open = stages.filter(s => !s.isLost).sort((a, b) => a.order - b.order)
  const idx = open.findIndex(s => s.id === lead.stageId)
  rules.push({
    label: 'Stage progress', max: 25,
    points: stage?.isLost || idx < 0 ? 0 : open.length > 1 ? Math.round((idx / (open.length - 1)) * 25) : 25,
    detail: stage?.isLost ? 'Lead is lost' : `${stage?.label ?? 'Unknown stage'} — step ${idx + 1} of ${open.length}`,
  })

  rules.push({ label: 'Rating', max: 20, points: Math.min(5, Math.max(0, lead.rating)) * 4, detail: `${lead.rating} of 5 stars (4 points per star)` })

  const moveKnown = Boolean(lead.moveFrom && lead.moveTo && lead.moveDate)
  rules.push({ label: 'Move details known', max: 5, points: moveKnown ? 5 : 0, detail: moveKnown ? 'From, to and date are filled in' : 'From, to or date is missing' })
  rules.push({ label: 'Email on file', max: 5, points: lead.email ? 5 : 0, detail: lead.email ? 'Email address is saved' : 'No email address' })
  rules.push({ label: 'Quotation or invoice', max: 5, points: hasBillingDoc ? 5 : 0, detail: hasBillingDoc ? 'At least one quotation or invoice exists' : 'Nothing quoted or billed yet' })

  return { total: Math.min(100, rules.reduce((s, r) => s + r.points, 0)), rules }
}
