import { useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useStore } from '@/lib/store'
import { Button, Drawer, Field, Input, Select, Textarea } from '@/components/ui'
import { nowIso, toLocalInput } from '@/lib/utils'
import { HOME_SIZES, Stars, phoneDigits } from '@/components/leads/shared'
import type { CustomField, Lead } from '@/lib/types'

type CustomValue = string | number | boolean

/** Create (no `lead`) or edit a lead in a right-side drawer. */
export default function LeadForm({ open, onClose, lead }: { open: boolean; onClose: () => void; lead?: Lead }) {
  if (!open) return null
  // Keyed so the fields start fresh each time the drawer opens for a different lead.
  return <LeadFormBody key={lead?.id ?? 'new'} onClose={onClose} lead={lead} />
}

function LeadFormBody({ onClose, lead }: { onClose: () => void; lead?: Lead }) {
  const leads = useStore(s => s.leads)
  const allStages = useStore(s => s.stages)
  const sources = useStore(s => s.sources)
  const users = useStore(s => s.users)
  const allCustomFields = useStore(s => s.customFields)
  const stages = useMemo(() => [...allStages].sort((a, b) => a.order - b.order), [allStages])
  const customFields = useMemo(() => allCustomFields.filter(f => f.active), [allCustomFields])
  const initialStage = stages.find(s => s.isInitial) ?? stages[0]

  const [f, setF] = useState({
    name: lead?.name ?? '', phone: lead?.phone ?? '', email: lead?.email ?? '', altPhone: lead?.altPhone ?? '',
    company: lead?.company ?? '', city: lead?.city ?? '',
    stageId: lead?.stageId ?? initialStage?.id ?? '', sourceId: lead?.sourceId ?? sources[0]?.id ?? '', ownerId: lead?.ownerId ?? '',
    value: lead?.value ? String(lead.value) : '', rating: lead?.rating ?? 0, tags: (lead?.tags ?? []).join(', '),
    moveFrom: lead?.moveFrom ?? '', moveTo: lead?.moveTo ?? '', moveDate: lead?.moveDate ?? '', homeSize: lead?.homeSize ?? '',
    nextFollowUpAt: toLocalInput(lead?.nextFollowUpAt),
  })
  const [custom, setCustom] = useState<Record<string, CustomValue>>({ ...(lead?.custom ?? {}) })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(p => ({ ...p, [k]: v }))
  const setC = (id: string, v: CustomValue) => setCustom(p => ({ ...p, [id]: v }))

  const duplicate = useMemo(() => {
    const d = phoneDigits(f.phone)
    if (d.length < 10) return undefined
    return leads.find(l => l.id !== lead?.id && phoneDigits(l.phone) === d)
  }, [f.phone, leads, lead?.id])

  const save = () => {
    const e: Record<string, string> = {}
    if (!f.name.trim()) e.name = 'Enter the customer name.'
    const digits = f.phone.replace(/\D/g, '')
    if (!f.phone.trim()) e.phone = 'Enter a phone number.'
    else if (digits.length < 10) e.phone = 'Phone number needs at least 10 digits.'
    if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'This email address does not look right.'
    if (f.value && (isNaN(Number(f.value)) || Number(f.value) < 0)) e.value = 'Enter an amount of 0 or more.'
    customFields.forEach(cf => {
      const v = custom[cf.id]
      if (cf.required && (v === undefined || v === '' || (cf.type === 'rating' && !v))) e[cf.id] = `${cf.label} is required.`
    })
    setErrors(e)
    if (Object.keys(e).length) return

    const cleanCustom: Record<string, CustomValue> = {}
    Object.entries(custom).forEach(([k, v]) => { if (v !== '' && v !== undefined) cleanCustom[k] = v })
    const data = {
      name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim() || undefined, altPhone: f.altPhone.trim() || undefined,
      company: f.company.trim() || undefined, city: f.city.trim() || undefined,
      stageId: f.stageId, sourceId: f.sourceId, ownerId: f.ownerId || undefined,
      value: Number(f.value) || 0, rating: f.rating,
      tags: [...new Set(f.tags.split(',').map(t => t.trim()).filter(Boolean))],
      moveFrom: f.moveFrom.trim() || undefined, moveTo: f.moveTo.trim() || undefined, moveDate: f.moveDate || undefined, homeSize: f.homeSize || undefined,
      nextFollowUpAt: f.nextFollowUpAt ? new Date(f.nextFollowUpAt).toISOString() : undefined,
      custom: cleanCustom,
    }
    const st = useStore.getState()
    if (lead) {
      // Stage and owner go through their own actions so the timeline records them.
      const { stageId, ownerId, ...rest } = data
      st.update('leads', lead.id, { ...rest, updatedAt: nowIso() })
      if (stageId !== lead.stageId) st.setLeadStage(lead.id, stageId, lead.lostReasonId)
      if (ownerId !== lead.ownerId) st.setLeadOwner(lead.id, ownerId)
      st.log('system', 'Lead details updated', lead.id)
    } else {
      st.createLead(data)
    }
    onClose()
  }

  const err = (k: string) => errors[k] && <span className="mt-1 block text-xs text-rose-600">{errors[k]}</span>

  return (
    <Drawer
      open
      onClose={onClose}
      title={lead ? `Edit lead #${lead.no}` : 'New lead'}
      width={560}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{lead ? 'Save changes' : 'Create lead'}</Button></>}
    >
      <form onSubmit={e => { e.preventDefault(); save() }} className="space-y-5">
        <Section title="Customer">
          <Field label="Name *"><Input autoFocus value={f.name} onChange={e => set('name', e.target.value)} placeholder="Customer name" />{err('name')}</Field>
          <Field label="Phone *">
            <Input type="tel" value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="10-digit mobile number" />
            {err('phone')}
            {duplicate && (
              <span className="mt-1 flex items-start gap-1 text-xs text-amber-600">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                Lead #{duplicate.no} ({duplicate.name}) already has this phone number. You can still save.
              </span>
            )}
          </Field>
          <Field label="Email"><Input type="email" value={f.email} onChange={e => set('email', e.target.value)} placeholder="name@example.com" />{err('email')}</Field>
          <Field label="Alternate phone"><Input type="tel" value={f.altPhone} onChange={e => set('altPhone', e.target.value)} /></Field>
          <Field label="Company"><Input value={f.company} onChange={e => set('company', e.target.value)} /></Field>
          <Field label="City"><Input value={f.city} onChange={e => set('city', e.target.value)} /></Field>
        </Section>

        <Section title="Pipeline">
          <Field label="Stage">
            <Select value={f.stageId} onChange={e => set('stageId', e.target.value)}>{stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</Select>
          </Field>
          <Field label="Source">
            <Select value={f.sourceId} onChange={e => set('sourceId', e.target.value)}>{sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</Select>
          </Field>
          <Field label="Owner" hint={lead ? undefined : 'Leave blank to use auto-assign.'}>
            <Select value={f.ownerId} onChange={e => set('ownerId', e.target.value)}>
              <option value="">{lead ? 'No owner' : 'Auto-assign'}</option>
              {users.filter(u => u.active || u.id === f.ownerId).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="Expected value (₹)"><Input type="number" min={0} value={f.value} onChange={e => set('value', e.target.value)} placeholder="0" />{err('value')}</Field>
          <Field label="Rating"><div className="flex h-9 items-center"><Stars value={f.rating} onChange={v => set('rating', v)} size={20} /></div></Field>
          <Field label="Next follow-up"><Input type="datetime-local" value={f.nextFollowUpAt} onChange={e => set('nextFollowUpAt', e.target.value)} /></Field>
          <Field label="Tags" hint="Separate tags with commas." className="sm:col-span-2"><Input value={f.tags} onChange={e => set('tags', e.target.value)} placeholder="urgent, corporate" /></Field>
        </Section>

        <Section title="Move details">
          <Field label="Move from"><Input value={f.moveFrom} onChange={e => set('moveFrom', e.target.value)} placeholder="Pickup city or area" /></Field>
          <Field label="Move to"><Input value={f.moveTo} onChange={e => set('moveTo', e.target.value)} placeholder="Drop city or area" /></Field>
          <Field label="Move date"><Input type="date" value={f.moveDate} onChange={e => set('moveDate', e.target.value)} /></Field>
          <Field label="Home size">
            <Select value={f.homeSize} onChange={e => set('homeSize', e.target.value)}>
              <option value="">Not known</option>
              {HOME_SIZES.map(s => <option key={s}>{s}</option>)}
              {f.homeSize && !HOME_SIZES.includes(f.homeSize) && <option>{f.homeSize}</option>}
            </Select>
          </Field>
        </Section>

        {customFields.length > 0 && (
          <Section title="More details">
            {customFields.map(cf => (
              <Field key={cf.id} label={cf.label + (cf.required ? ' *' : '')} className={cf.type === 'textarea' ? 'sm:col-span-2' : undefined}>
                <CustomInput field={cf} value={custom[cf.id]} onChange={v => setC(cf.id, v)} />
                {err(cf.id)}
              </Field>
            ))}
          </Section>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function CustomInput({ field, value, onChange }: { field: CustomField; value: CustomValue | undefined; onChange: (v: CustomValue) => void }) {
  const str = value === undefined || typeof value === 'boolean' ? '' : String(value)
  const num = (v: string) => onChange(v === '' ? '' : Number(v))
  switch (field.type) {
    case 'textarea': return <Textarea value={str} onChange={e => onChange(e.target.value)} />
    case 'number': return <Input type="number" value={str} onChange={e => num(e.target.value)} />
    case 'currency': return <Input type="number" min={0} value={str} onChange={e => num(e.target.value)} placeholder="₹" />
    case 'email': return <Input type="email" value={str} onChange={e => onChange(e.target.value)} />
    case 'phone': return <Input type="tel" value={str} onChange={e => onChange(e.target.value)} />
    case 'url': return <Input type="url" value={str} onChange={e => onChange(e.target.value)} placeholder="https://" />
    case 'date': return <Input type="date" value={str} onChange={e => onChange(e.target.value)} />
    case 'dropdown':
      return (
        <Select value={str} onChange={e => onChange(e.target.value)}>
          <option value="">Not set</option>
          {(field.options ?? []).map(o => <option key={o}>{o}</option>)}
          {str && !(field.options ?? []).includes(str) && <option>{str}</option>}
        </Select>
      )
    case 'yesno':
      return (
        <Select value={value === true ? 'yes' : value === false ? 'no' : ''} onChange={e => onChange(e.target.value === '' ? '' : e.target.value === 'yes')}>
          <option value="">Not set</option><option value="yes">Yes</option><option value="no">No</option>
        </Select>
      )
    case 'rating': return <div className="flex h-9 items-center"><Stars value={Number(value) || 0} onChange={onChange} size={20} /></div>
    default: return <Input value={str} onChange={e => onChange(e.target.value)} />
  }
}
