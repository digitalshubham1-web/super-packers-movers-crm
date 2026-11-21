import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore, type State } from '@/lib/store'
import type { CustomField, FieldType, Option, Stage } from '@/lib/types'
import { nowIso, uid } from '@/lib/utils'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Textarea, Toggle } from '@/components/ui'
import { COLOURS, Confirm, SavedTag, useSaved } from './shared'

function ColourPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {COLOURS.map(c => (
        <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={value === c} onClick={() => onChange(c)}
          className={'size-6 rounded-full border-2 cursor-pointer ' + (value === c ? 'border-text' : 'border-transparent')} style={{ background: c }} />
      ))}
      <input type="color" aria-label="Custom colour" value={value} onChange={e => onChange(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-border bg-surface" />
    </div>
  )
}
const Row = ({ children }: { children: ReactNode }) => <li className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 last:border-b-0">{children}</li>

/* ───────────── Lead stages ───────────── */
type Kind = 'open' | 'initial' | 'won' | 'lost'
const kindOf = (s: Stage): Kind => (s.isInitial ? 'initial' : s.isWon ? 'won' : s.isLost ? 'lost' : 'open')
const KIND_LABEL: Record<Kind, string> = { open: 'In progress', initial: 'Initial (new leads start here)', won: 'Won', lost: 'Lost' }

export function StagesSection() {
  const stages = useStore(s => s.stages)
  const leads = useStore(s => s.leads)
  const sorted = useMemo(() => [...stages].sort((a, b) => a.order - b.order), [stages])
  const [saved, flash] = useSaved()
  const [edit, setEdit] = useState<{ id?: string; label: string; color: string; kind: Kind } | null>(null)
  const [error, setError] = useState('')
  const [del, setDel] = useState<Stage | null>(null)
  const [moveTo, setMoveTo] = useState('')
  const count = (id: string) => leads.filter(l => l.stageId === id).length

  const writeStages = (list: Stage[]) => { useStore.setState({ stages: list.map((s, i) => ({ ...s, order: i })) }); flash() }
  const move = (i: number, d: -1 | 1) => {
    const list = [...sorted]; const j = i + d
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    writeStages(list)
  }
  const save = () => {
    if (!edit) return
    const label = edit.label.trim()
    if (!label) { setError('Type a name for the stage.'); return }
    if (sorted.some(s => s.id !== edit.id && s.label.toLowerCase() === label.toLowerCase())) { setError('Another stage already has this name.'); return }
    const prev = sorted.find(s => s.id === edit.id)
    const was = prev ? kindOf(prev) : undefined
    if (was && was !== edit.kind) {
      if (was === 'initial') { setError('This is the initial stage. Mark another stage as Initial first; there must always be exactly one.'); return }
      if (was === 'won' && sorted.filter(s => s.isWon).length === 1) { setError('This is the only Won stage. Mark another stage as Won first.'); return }
      if (was === 'lost' && sorted.filter(s => s.isLost).length === 1) { setError('This is the only Lost stage. Mark another stage as Lost first.'); return }
    }
    const flags = { isInitial: edit.kind === 'initial' || undefined, isWon: edit.kind === 'won' || undefined, isLost: edit.kind === 'lost' || undefined }
    let list: Stage[] = prev
      ? sorted.map(s => (s.id === prev.id ? { ...s, label, color: edit.color, ...flags } : s))
      : [...sorted, { id: 'st_' + uid(), label, color: edit.color, order: sorted.length, ...flags }]
    // Exactly one initial stage: the one just marked wins.
    if (edit.kind === 'initial') list = list.map(s => (s.label === label ? s : { ...s, isInitial: undefined }))
    writeStages(list); setEdit(null)
  }
  const askDelete = (s: Stage) => { setDel(s); setMoveTo(sorted.find(x => x.id !== s.id && !x.isWon && !x.isLost)?.id ?? sorted.find(x => x.id !== s.id)?.id ?? '') }
  const blocked = del
    ? del.isInitial ? 'This is the initial stage where new leads start. Mark another stage as Initial before deleting it.'
    : del.isWon && sorted.filter(s => s.isWon).length === 1 ? 'This is the only Won stage. Mark another stage as Won before deleting it.'
    : del.isLost && sorted.filter(s => s.isLost).length === 1 ? 'This is the only Lost stage. Mark another stage as Lost before deleting it.'
    : ''
    : ''
  const delCount = del ? count(del.id) : 0
  const doDelete = () => {
    if (!del || blocked) return
    const st = useStore.getState()
    const target = st.stages.find(s => s.id === moveTo)
    if (delCount && !target) return
    useStore.setState({
      leads: target ? st.leads.map(l => (l.stageId === del.id ? { ...l, stageId: target.id, lostReasonId: target.isLost ? l.lostReasonId : undefined, updatedAt: nowIso() } : l)) : st.leads,
      stages: st.stages.filter(s => s.id !== del.id).sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i })),
      automations: st.automations.map(a => (a.filterStageId === del.id ? { ...a, filterStageId: undefined } : a)),
    })
    if (delCount && target) st.log('system', `${delCount} lead${delCount === 1 ? '' : 's'} moved from “${del.label}” to “${target.label}” because the stage was deleted`)
    setDel(null); flash()
  }

  return (
    <Card title={<span className="flex items-center gap-2">Lead stages <SavedTag show={saved} /></span>} action={<Button size="sm" variant="primary" icon={Plus} onClick={() => { setError(''); setEdit({ label: '', color: COLOURS[sorted.length % COLOURS.length], kind: 'open' }) }}>Add stage</Button>}>
      <p className="border-b border-border px-4 py-2.5 text-xs text-muted">The steps a lead moves through, in order. There is always exactly one initial stage, and at least one Won and one Lost stage.</p>
      <ul>
        {sorted.map((s, i) => (
          <Row key={s.id}>
            <span className="size-3 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 text-sm font-medium">{s.label}</span>
            {s.isInitial && <Badge tone="info">Initial</Badge>}
            {s.isWon && <Badge tone="good">Won</Badge>}
            {s.isLost && <Badge tone="bad">Lost</Badge>}
            <span className="text-xs text-muted">{count(s.id)} leads</span>
            <span className="flex gap-0.5">
              <Button size="sm" variant="ghost" icon={ArrowUp} disabled={i === 0} aria-label={`Move ${s.label} up`} onClick={() => move(i, -1)} />
              <Button size="sm" variant="ghost" icon={ArrowDown} disabled={i === sorted.length - 1} aria-label={`Move ${s.label} down`} onClick={() => move(i, 1)} />
              <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Edit ${s.label}`} onClick={() => { setError(''); setEdit({ id: s.id, label: s.label, color: s.color, kind: kindOf(s) }) }} />
              <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete ${s.label}`} onClick={() => askDelete(s)} />
            </span>
          </Row>
        ))}
      </ul>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit stage' : 'Add stage'} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save stage</Button></>}>
        {edit && (
          <div className="space-y-4">
            <Field label="Stage name"><Input autoFocus value={edit.label} onChange={e => setEdit({ ...edit, label: e.target.value })} placeholder="e.g. Survey booked" /></Field>
            <div><span className="mb-1 block text-xs font-medium text-muted">Colour</span><ColourPicker value={edit.color} onChange={color => setEdit({ ...edit, color })} /></div>
            <Field label="What this stage means" hint={edit.kind === 'initial' ? 'The current initial stage will become a normal in-progress stage.' : undefined}>
              <Select value={edit.kind} onChange={e => setEdit({ ...edit, kind: e.target.value as Kind })}>
                {(Object.keys(KIND_LABEL) as Kind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </Select>
            </Field>
            {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
          </div>
        )}
      </Modal>

      <Confirm open={!!del} onClose={() => setDel(null)} title={`Delete “${del?.label ?? ''}”?`} confirmLabel={delCount ? 'Move leads and delete' : 'Delete stage'} disabled={!!blocked || (delCount > 0 && !moveTo)} onConfirm={doDelete}>
        {blocked ? <p className="text-rose-600">{blocked}</p> : delCount ? <>
          <p>{delCount} lead{delCount === 1 ? ' is' : 's are'} in this stage. Choose where to move {delCount === 1 ? 'it' : 'them'} before the stage is deleted.</p>
          <Field label="Move leads to">
            <Select value={moveTo} onChange={e => setMoveTo(e.target.value)}>
              {sorted.filter(s => s.id !== del?.id).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </Field>
        </> : <p>No leads are in this stage. It will be removed from the pipeline.</p>}
      </Confirm>
    </Card>
  )
}

/* ───────────── Sources and lost reasons ───────────── */
export function OptionsSection({ col }: { col: 'sources' | 'lostReasons' }) {
  const isSrc = col === 'sources'
  const options = useStore(s => s[col])
  const leads = useStore(s => s.leads)
  const [saved, flash] = useSaved()
  const [edit, setEdit] = useState<{ id?: string; label: string; color: string } | null>(null)
  const [error, setError] = useState('')
  const [del, setDel] = useState<Option | null>(null)
  const noun = isSrc ? 'source' : 'reason'
  const count = (id: string) => leads.filter(l => (isSrc ? l.sourceId : l.lostReasonId) === id).length
  const delCount = del ? count(del.id) : 0

  const save = () => {
    if (!edit) return
    const label = edit.label.trim()
    if (!label) { setError(`Type a name for the ${noun}.`); return }
    if (options.some(o => o.id !== edit.id && o.label.toLowerCase() === label.toLowerCase())) { setError(`This ${noun} already exists.`); return }
    const { update } = useStore.getState()
    const body = isSrc ? { label, color: edit.color } : { label }
    if (edit.id) update(col, edit.id, body)
    else useStore.setState(s => ({ [col]: [...s[col], { id: (isSrc ? 'src_' : 'lr_') + uid(), ...body }] }) as Partial<State>)
    setEdit(null); flash()
  }
  const doDelete = () => {
    if (!del) return
    if (isSrc && delCount) return
    const st = useStore.getState()
    if (!isSrc && delCount) useStore.setState({ leads: st.leads.map(l => (l.lostReasonId === del.id ? { ...l, lostReasonId: undefined } : l)) })
    st.remove(col, del.id)
    setDel(null); flash()
  }

  return (
    <Card title={<span className="flex items-center gap-2">{isSrc ? 'Lead sources' : 'Lost reasons'} <SavedTag show={saved} /></span>}
      action={<Button size="sm" variant="primary" icon={Plus} onClick={() => { setError(''); setEdit({ label: '', color: COLOURS[options.length % COLOURS.length] }) }}>Add {noun}</Button>}>
      <p className="border-b border-border px-4 py-2.5 text-xs text-muted">{isSrc ? 'Where your enquiries come from. Used in lead forms, filters and reports.' : 'The reasons your team can pick when a lead is marked as lost.'}</p>
      {options.length === 0 ? <EmptyState title={`No ${noun}s yet`} action={<Button variant="primary" icon={Plus} onClick={() => { setError(''); setEdit({ label: '', color: COLOURS[0] }) }}>Add {noun}</Button>} /> : (
        <ul>
          {options.map(o => (
            <Row key={o.id}>
              {isSrc && <span className="size-3 shrink-0 rounded-full" style={{ background: o.color ?? '#64748b' }} />}
              <span className="min-w-0 flex-1 text-sm font-medium">{o.label}</span>
              <span className="text-xs text-muted">{count(o.id)} leads</span>
              <span className="flex gap-0.5">
                <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Edit ${o.label}`} onClick={() => { setError(''); setEdit({ id: o.id, label: o.label, color: o.color ?? COLOURS[0] }) }} />
                <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete ${o.label}`} onClick={() => setDel(o)} />
              </span>
            </Row>
          ))}
        </ul>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`${edit?.id ? 'Edit' : 'Add'} ${noun}`} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
        {edit && (
          <div className="space-y-4">
            <Field label="Name"><Input autoFocus value={edit.label} onChange={e => setEdit({ ...edit, label: e.target.value })} placeholder={isSrc ? 'e.g. Housing society poster' : 'e.g. Date not available'} /></Field>
            {isSrc && <div><span className="mb-1 block text-xs font-medium text-muted">Colour</span><ColourPicker value={edit.color} onChange={color => setEdit({ ...edit, color })} /></div>}
            {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
          </div>
        )}
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} title={`Delete “${del?.label ?? ''}”?`} confirmLabel={`Delete ${noun}`} disabled={isSrc && delCount > 0} onConfirm={doDelete}>
        {isSrc && delCount > 0
          ? <p className="text-rose-600">{delCount} lead{delCount === 1 ? ' uses' : 's use'} this source, so it cannot be deleted. Change the source on those leads first (filter the Leads page by this source), or rename it instead.</p>
          : !isSrc && delCount > 0 ? <p>{delCount} lost lead{delCount === 1 ? ' has' : 's have'} this reason. They will stay lost but show no reason.</p>
          : <p>No leads use this {noun}. It will be removed from the list.</p>}
      </Confirm>
    </Card>
  )
}

/* ───────────── Custom fields ───────────── */
const TYPES: Record<FieldType, string> = {
  text: 'Short text', textarea: 'Long text', number: 'Number', currency: 'Amount (₹)', email: 'Email', phone: 'Phone number',
  url: 'Web link', date: 'Date', dropdown: 'Dropdown', yesno: 'Yes / No', rating: 'Rating (1 to 5)',
}
export function CustomFieldsSection() {
  const fields = useStore(s => s.customFields)
  const [saved, flash] = useSaved()
  const [edit, setEdit] = useState<(Omit<CustomField, 'id' | 'options'> & { id?: string; optionsText: string }) | null>(null)
  const [error, setError] = useState('')
  const [del, setDel] = useState<CustomField | null>(null)
  const open = (f?: CustomField) => { setError(''); setEdit(f ? { id: f.id, label: f.label, type: f.type, required: !!f.required, active: f.active, optionsText: (f.options ?? []).join('\n') } : { label: '', type: 'text', required: false, active: true, optionsText: '' }) }
  const save = () => {
    if (!edit) return
    const label = edit.label.trim()
    if (!label) { setError('Type a label for the field.'); return }
    if (fields.some(f => f.id !== edit.id && f.label.toLowerCase() === label.toLowerCase())) { setError('Another field already has this label.'); return }
    const options = Array.from(new Set(edit.optionsText.split(/[\n,]/).map(o => o.trim()).filter(Boolean)))
    if (edit.type === 'dropdown' && options.length < 2) { setError('A dropdown needs at least two choices.'); return }
    const body = { label, type: edit.type, options: edit.type === 'dropdown' ? options : undefined, required: edit.required, active: edit.active }
    if (edit.id) useStore.getState().update('customFields', edit.id, body)
    else useStore.setState(s => ({ customFields: [...s.customFields, { id: 'cf_' + uid(), ...body }] }))
    setEdit(null); flash()
  }
  return (
    <Card title={<span className="flex items-center gap-2">Custom fields <SavedTag show={saved} /></span>} action={<Button size="sm" variant="primary" icon={Plus} onClick={() => open()}>Add field</Button>}>
      <p className="border-b border-border px-4 py-2.5 text-xs text-muted">Extra details to record on every lead, such as pickup floor or lift availability.</p>
      {fields.length === 0 ? <EmptyState title="No custom fields yet" text="Add a field to record details that are specific to your moving jobs." action={<Button variant="primary" icon={Plus} onClick={() => open()}>Add field</Button>} /> : (
        <ul>
          {fields.map(f => (
            <Row key={f.id}>
              <span className="min-w-0 flex-1">
                <span className="text-sm font-medium">{f.label}</span>
                {f.type === 'dropdown' && <span className="block truncate text-xs text-muted">{(f.options ?? []).join(', ')}</span>}
              </span>
              <Badge>{TYPES[f.type]}</Badge>
              {f.required && <Badge tone="warn">Required</Badge>}
              <Toggle checked={f.active} label={`${f.label} active`} onChange={v => { useStore.getState().update('customFields', f.id, { active: v }); flash() }} />
              <span className="flex gap-0.5">
                <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Edit ${f.label}`} onClick={() => open(f)} />
                <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete ${f.label}`} onClick={() => setDel(f)} />
              </span>
            </Row>
          ))}
        </ul>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit field' : 'Add field'} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save field</Button></>}>
        {edit && (
          <div className="space-y-4">
            <Field label="Label"><Input autoFocus value={edit.label} onChange={e => setEdit({ ...edit, label: e.target.value })} placeholder="e.g. Drop floor" /></Field>
            <Field label="Type">
              <Select value={edit.type} onChange={e => setEdit({ ...edit, type: e.target.value as FieldType })}>
                {(Object.keys(TYPES) as FieldType[]).map(t => <option key={t} value={t}>{TYPES[t]}</option>)}
              </Select>
            </Field>
            {edit.type === 'dropdown' && <Field label="Choices" hint="One per line, or separated by commas."><Textarea value={edit.optionsText} onChange={e => setEdit({ ...edit, optionsText: e.target.value })} placeholder={'None\nBike\nCar'} /></Field>}
            <div className="flex items-center justify-between text-sm"><span>Must be filled in</span><Toggle checked={!!edit.required} onChange={v => setEdit({ ...edit, required: v })} label="Must be filled in" /></div>
            <div className="flex items-center justify-between text-sm"><span>Show on lead forms</span><Toggle checked={edit.active} onChange={v => setEdit({ ...edit, active: v })} label="Show on lead forms" /></div>
            {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
          </div>
        )}
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} title={`Delete “${del?.label ?? ''}”?`} confirmLabel="Delete field"
        onConfirm={() => { if (del) useStore.getState().remove('customFields', del.id); setDel(null); flash() }}>
        <p>The field will disappear from lead forms and lead pages. To hide it but keep it for later, switch it off instead.</p>
      </Confirm>
    </Card>
  )
}

/* ───────────── Task types ───────────── */
export function TaskTypesSection() {
  const types = useStore(s => s.settings.taskTypes)
  const tasks = useStore(s => s.tasks)
  const [saved, flash] = useSaved()
  const [edit, setEdit] = useState<{ index: number; value: string } | null>(null)
  const [error, setError] = useState('')
  const [del, setDel] = useState<string | null>(null)
  const count = (t: string) => tasks.filter(x => x.type === t).length
  const save = () => {
    if (!edit) return
    const v = edit.value.trim()
    if (!v) { setError('Type a name.'); return }
    if (types.some((t, i) => i !== edit.index && t.toLowerCase() === v.toLowerCase())) { setError('This task type already exists.'); return }
    const st = useStore.getState()
    if (edit.index < 0) st.setSettings({ taskTypes: [...types, v] })
    else {
      const old = types[edit.index]
      st.setSettings({ taskTypes: types.map((t, i) => (i === edit.index ? v : t)) })
      if (old !== v) useStore.setState(s => ({ tasks: s.tasks.map(t => (t.type === old ? { ...t, type: v } : t)) }))
    }
    setEdit(null); flash()
  }
  return (
    <Card title={<span className="flex items-center gap-2">Task types <SavedTag show={saved} /></span>} action={<Button size="sm" variant="primary" icon={Plus} onClick={() => { setError(''); setEdit({ index: -1, value: '' }) }}>Add type</Button>}>
      <p className="border-b border-border px-4 py-2.5 text-xs text-muted">The kinds of task your team can create. Renaming a type also renames it on existing tasks.</p>
      <ul>
        {types.map((t, i) => (
          <Row key={t}>
            <span className="min-w-0 flex-1 text-sm font-medium">{t}</span>
            <span className="text-xs text-muted">{count(t)} tasks</span>
            <span className="flex gap-0.5">
              <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Rename ${t}`} onClick={() => { setError(''); setEdit({ index: i, value: t }) }} />
              <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete ${t}`} onClick={() => setDel(t)} />
            </span>
          </Row>
        ))}
      </ul>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit && edit.index >= 0 ? 'Rename task type' : 'Add task type'} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
        {edit && <div className="space-y-3">
          <Field label="Name"><Input autoFocus value={edit.value} onChange={e => setEdit({ ...edit, value: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') save() }} placeholder="e.g. Site visit" /></Field>
          {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        </div>}
      </Modal>
      <Confirm open={del !== null} onClose={() => setDel(null)} title={`Delete “${del ?? ''}”?`} confirmLabel="Delete type" disabled={types.length <= 1}
        onConfirm={() => { if (del !== null) useStore.getState().setSettings({ taskTypes: types.filter(t => t !== del) }); setDel(null); flash() }}>
        {types.length <= 1 ? <p className="text-rose-600">Keep at least one task type.</p>
          : <p>{del !== null && count(del) > 0 ? `${count(del)} existing task${count(del) === 1 ? ' keeps' : 's keep'} this type, but it can no longer be chosen for new tasks.` : 'No tasks use this type. It will be removed from the list.'}</p>}
      </Confirm>
    </Card>
  )
}
