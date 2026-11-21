import { useMemo, useState } from 'react'
import { BadgeCheck, Copy, FileText, LayoutGrid, List, Pencil, Plus, Search, Send, Trash2 } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn, fmtDate, nowIso, timeAgo } from '@/lib/utils'
import type { WaTemplate } from '@/lib/types'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea, tableCls, tableWrap, tdCls, thCls, trCls } from '@/components/ui'
import { PhonePreview, fillTemplate, sampleFor, templateVars } from '@/components/whatsapp/helpers'

const CATEGORIES: WaTemplate['category'][] = ['MARKETING', 'UTILITY', 'AUTHENTICATION']
const LANGUAGES = ['English', 'Hindi', 'Hinglish', 'Marathi', 'Gujarati', 'Punjabi', 'Bengali', 'Tamil', 'Telugu', 'Kannada']
const STATUSES: WaTemplate['status'][] = ['draft', 'pending', 'approved', 'rejected']
const statusTone = { approved: 'good', pending: 'warn', rejected: 'bad', draft: 'neutral' } as const
const statusLabel = { approved: 'Approved', pending: 'Pending approval', rejected: 'Rejected', draft: 'Draft' } as const
const catLabel = (c: string) => c.charAt(0) + c.slice(1).toLowerCase()
const cleanName = (s: string) => s.toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 60)
const sampleText = (body: string) => fillTemplate(body, Object.fromEntries(templateVars(body).map(n => [n, sampleFor(n)])))

export default function Templates() {
  const templates = useStore(s => s.templates)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [lang, setLang] = useState('')
  const [status, setStatus] = useState('')
  const [view, setView] = useState<'list' | 'cards'>('list')
  const [editing, setEditing] = useState<WaTemplate | 'new' | null>(null)
  const [deleting, setDeleting] = useState<WaTemplate | null>(null)

  const languages = useMemo(() => [...new Set([...templates.map(t => t.language)])].sort(), [templates])
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return templates
      .filter(t => (!cat || t.category === cat) && (!lang || t.language === lang) && (!status || t.status === status))
      .filter(t => !term || t.name.includes(term) || t.body.toLowerCase().includes(term))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [templates, q, cat, lang, status])
  const filtered = !!(q || cat || lang || status)

  const { update, add, remove } = useStore.getState()
  const submit = (t: WaTemplate) => update('templates', t.id, { status: 'pending', updatedAt: nowIso() })
  const approve = (t: WaTemplate) => update('templates', t.id, { status: 'approved', updatedAt: nowIso() })
  const duplicate = (t: WaTemplate) => {
    const names = new Set(useStore.getState().templates.map(x => x.name))
    let name = cleanName(t.name + '_copy')
    for (let i = 2; names.has(name); i++) name = cleanName(`${t.name}_copy_${i}`)
    add('templates', { name, category: t.category, language: t.language, body: t.body, status: 'draft', createdAt: nowIso(), updatedAt: nowIso() })
  }

  const actions = (t: WaTemplate) => (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {(t.status === 'draft' || t.status === 'rejected') && <Button size="sm" icon={Send} onClick={() => submit(t)}>Submit for approval</Button>}
      {t.status === 'pending' && <Button size="sm" icon={BadgeCheck} onClick={() => approve(t)} title="Simulation: real approval comes from WhatsApp, usually within a day">Mark approved (simulation)</Button>}
      <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(t)} aria-label={`Edit ${t.name}`} />
      <Button size="sm" variant="ghost" icon={Copy} onClick={() => duplicate(t)} aria-label={`Duplicate ${t.name}`} title="Duplicate" />
      <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDeleting(t)} aria-label={`Delete ${t.name}`} title="Delete" />
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Message templates"
        subtitle="Pre-approved messages for campaigns and for chats older than 24 hours"
        icon={FileText}
        actions={<Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>New template</Button>}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-muted" />
          <Input className="pl-8" placeholder="Search name or text" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Select className="w-auto" value={cat} onChange={e => setCat(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
        </Select>
        <Select className="w-auto" value={lang} onChange={e => setLang(e.target.value)} aria-label="Language">
          <option value="">All languages</option>
          {languages.map(l => <option key={l}>{l}</option>)}
        </Select>
        <Select className="w-auto" value={status} onChange={e => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
        </Select>
        {filtered && <Button variant="ghost" size="sm" onClick={() => { setQ(''); setCat(''); setLang(''); setStatus('') }}>Clear filters</Button>}
        <div className="ml-auto inline-flex rounded-lg border border-border bg-surface p-1">
          {([['list', List, 'List view'], ['cards', LayoutGrid, 'Card view']] as const).map(([id, Icon, label]) => (
            <button key={id} onClick={() => setView(id)} aria-label={label} title={label} className={cn('cursor-pointer rounded-md p-1.5', view === id ? 'bg-brand-soft text-brand' : 'text-muted hover:text-text')}><Icon size={15} /></button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title={filtered ? 'No templates match these filters' : 'No templates yet'}
            text={filtered ? 'Change or clear the filters to see more.' : 'Create a template, submit it for approval, then use it in chats and campaigns.'}
            action={<Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>New template</Button>}
          />
        </Card>
      ) : view === 'list' ? (
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead>
              <tr>
                {['Name', 'Category', 'Language', 'Message', 'Status', 'Updated', 'Last used', ''].map(h => <th key={h} className={thCls}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(t => (
                <tr key={t.id} className={trCls}>
                  <td className={tdCls}><button onClick={() => setEditing(t)} className="cursor-pointer font-mono text-xs font-medium text-brand hover:underline">{t.name}</button></td>
                  <td className={tdCls}>{catLabel(t.category)}</td>
                  <td className={tdCls}>{t.language}</td>
                  <td className={cn(tdCls, 'max-w-72')}><span className="line-clamp-2 min-w-48 text-xs text-muted">{t.body}</span></td>
                  <td className={tdCls}><Badge tone={statusTone[t.status]}>{statusLabel[t.status]}</Badge></td>
                  <td className={cn(tdCls, 'whitespace-nowrap text-xs text-muted')}>{fmtDate(t.updatedAt)}</td>
                  <td className={cn(tdCls, 'whitespace-nowrap text-xs text-muted')}>{t.lastUsedAt ? timeAgo(t.lastUsedAt) : 'Never'}</td>
                  <td className={tdCls}>{actions(t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(t => (
            <Card key={t.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 break-all font-mono text-xs font-semibold">{t.name}</span>
                <Badge tone={statusTone[t.status]}>{statusLabel[t.status]}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap gap-1"><Badge>{catLabel(t.category)}</Badge><Badge>{t.language}</Badge></div>
              <p className="mt-3 flex-1 rounded-lg bg-surface-2 px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap">{t.body}</p>
              <p className="mt-2 text-[11px] text-muted">Updated {fmtDate(t.updatedAt)} · Last used {t.lastUsedAt ? timeAgo(t.lastUsedAt) : 'never'}</p>
              <div className="mt-3 border-t border-border pt-3">{actions(t)}</div>
            </Card>
          ))}
        </div>
      )}

      {editing && <TemplateForm template={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete template?"
        footer={<><Button onClick={() => setDeleting(null)}>Keep it</Button><Button variant="danger" icon={Trash2} onClick={() => { if (deleting) remove('templates', deleting.id); setDeleting(null) }}>Delete</Button></>}
      >
        <p className="text-sm">The template <span className="font-mono font-medium">{deleting?.name}</span> will be removed. Campaigns that used it keep their numbers.</p>
      </Modal>
    </div>
  )
}

function TemplateForm({ template, onClose }: { template?: WaTemplate; onClose: () => void }) {
  const all = useStore(s => s.templates)
  const [name, setName] = useState(template?.name ?? '')
  const [category, setCategory] = useState<WaTemplate['category']>(template?.category ?? 'UTILITY')
  const [language, setLanguage] = useState(template?.language ?? 'English')
  const [body, setBody] = useState(template?.body ?? '')
  const vars = templateVars(body)
  const nextVar = (vars[vars.length - 1] ?? 0) + 1
  const gap = vars.some((n, i) => n !== i + 1)
  const taken = all.some(t => t.name === name && t.id !== template?.id)
  const error = !name ? 'Give the template a name.' : taken ? 'Another template already uses this name.' : !body.trim() ? 'Write the message text.' : body.length > 1024 ? 'The message can be at most 1,024 characters.' : gap ? 'Variables must be numbered in order: {{1}}, {{2}}, {{3}}…' : ''
  const contentChanged = !!template && (template.body !== body || template.category !== category || template.language !== language)

  const save = (submit: boolean) => {
    if (error) return
    const s = useStore.getState()
    if (template) {
      const status: WaTemplate['status'] = submit ? 'pending' : contentChanged && template.status !== 'draft' ? 'draft' : template.status
      s.update('templates', template.id, { name, category, language, body: body.trim(), status, updatedAt: nowIso() })
    } else {
      s.add('templates', { name, category, language, body: body.trim(), status: submit ? 'pending' : 'draft', createdAt: nowIso(), updatedAt: nowIso() })
    }
    onClose()
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={template ? 'Edit template' : 'New template'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button disabled={!!error} onClick={() => save(false)}>{template ? 'Save' : 'Save as draft'}</Button>
          {(!template || template.status === 'draft' || template.status === 'rejected' || contentChanged) && <Button variant="primary" icon={Send} disabled={!!error} onClick={() => save(true)}>Save and submit for approval</Button>}
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          <Field label="Template name" hint="Lowercase letters, numbers and underscores only, e.g. quotation_follow_up.">
            <Input className="font-mono" value={name} onChange={e => setName(cleanName(e.target.value))} placeholder="booking_confirmation" autoFocus />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category">
              <Select value={category} onChange={e => setCategory(e.target.value as WaTemplate['category'])}>
                {CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
              </Select>
            </Field>
            <Field label="Language">
              <Select value={language} onChange={e => setLanguage(e.target.value)}>
                {[...new Set([...LANGUAGES, language])].map(l => <option key={l}>{l}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Message text">
            <Textarea rows={7} value={body} onChange={e => setBody(e.target.value)} placeholder="Hi {{1}}, your shifting is confirmed for {{2}}." />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button size="sm" icon={Plus} onClick={() => setBody(b => `${b}${b && !/\s$/.test(b) ? ' ' : ''}{{${nextVar}}}`)}>Add variable {`{{${nextVar}}}`}</Button>
            <span className={cn('text-xs', body.length > 1024 ? 'text-rose-600' : 'text-muted')}>{body.length} / 1,024</span>
          </div>
          {vars.length > 0 && (
            <p className="text-xs text-muted">
              Variables are replaced for each customer when sending. Preview uses: {vars.map(n => `{{${n}}} = ${sampleFor(n)}`).join(', ')}.
            </p>
          )}
          {template && contentChanged && template.status !== 'draft' && <p className="text-xs text-amber-600">Changing the text, category or language moves this template back to Draft until it is approved again.</p>}
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
        <div>
          <span className="mb-2 block text-center text-xs font-medium text-muted">Preview with sample values</span>
          <PhonePreview text={sampleText(body)} />
        </div>
      </div>
    </Modal>
  )
}
