import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Check, CircleSlash, Pencil, Plug, Plus, Save, Settings, Trash2, X, Zap } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { CannedMessage } from '@/lib/types'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Tabs, Textarea, tableCls, tableWrap, tdCls, thCls, trCls } from '@/components/ui'
import { DEFAULT_OPT_OUT_KEYWORDS, OPT_OUT_KEYWORDS_KEY, OPT_OUT_NUMBERS_KEY, digits, useLocal } from '@/components/whatsapp/helpers'

type TabId = 'profile' | 'canned' | 'optout' | 'connection'
interface Profile { name: string; about: string; address: string; email: string; website: string }

export default function WaSettings() {
  const [tab, setTab] = useState<TabId>('profile')
  return (
    <div>
      <PageHeader title="WhatsApp settings" subtitle="Business profile, quick replies, opt-outs and connection" icon={Settings} />
      <Tabs<TabId>
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'profile', label: 'Business profile', icon: Building2 }, { id: 'canned', label: 'Canned messages', icon: Zap },
          { id: 'optout', label: 'Opt-out', icon: CircleSlash }, { id: 'connection', label: 'Connection', icon: Plug },
        ]}
      />
      {tab === 'profile' && <ProfileTab />}
      {tab === 'canned' && <CannedTab />}
      {tab === 'optout' && <OptOutTab />}
      {tab === 'connection' && <ConnectionTab />}
    </div>
  )
}

function ProfileTab() {
  const settings = useStore(s => s.settings)
  const [saved, setSaved] = useLocal<Profile>('spm-wa-profile', {
    name: settings.businessName, about: 'Safe and on-time home, office and vehicle shifting across India.', address: settings.businessAddress, email: settings.businessEmail, website: '',
  })
  const [p, setP] = useState<Profile>(saved)
  const [justSaved, setJustSaved] = useState(false)
  const set = (patch: Partial<Profile>) => { setP(x => ({ ...x, ...patch })); setJustSaved(false) }
  const dirty = JSON.stringify(p) !== JSON.stringify(saved)
  const emailOk = !p.email || /^\S+@\S+\.\S+$/.test(p.email)
  const webOk = !p.website || /^https?:\/\/\S+\.\S+/.test(p.website)
  const save = () => { setSaved(p); setJustSaved(true) }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card title="Business profile">
        <div className="space-y-3 p-4">
          <p className="text-xs text-muted">This is what customers see when they open your business on WhatsApp. It is saved on this device and sent to WhatsApp once a number is connected.</p>
          <Field label="Business name"><Input value={p.name} onChange={e => set({ name: e.target.value })} /></Field>
          <Field label="About" hint={`${p.about.length} / 139 characters`}><Textarea rows={2} maxLength={139} value={p.about} onChange={e => set({ about: e.target.value })} /></Field>
          <Field label="Address"><Textarea rows={2} value={p.address} onChange={e => set({ address: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email" hint={emailOk ? undefined : 'Enter a valid email address.'}><Input type="email" value={p.email} onChange={e => set({ email: e.target.value })} /></Field>
            <Field label="Website" hint={webOk ? undefined : 'Start with https://'}><Input value={p.website} onChange={e => set({ website: e.target.value })} placeholder="https://" /></Field>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="primary" icon={Save} disabled={!dirty || !p.name.trim() || !emailOk || !webOk} onClick={save}>Save profile</Button>
            {justSaved && !dirty && <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><Check size={14} /> Saved</span>}
          </div>
        </div>
      </Card>
      <Card title="How it looks" className="self-start">
        <div className="p-4 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand text-xl font-semibold text-brand-fg">{(p.name.trim()[0] ?? 'S').toUpperCase()}</span>
          <p className="mt-2 font-semibold">{p.name || 'Business name'}</p>
          <p className="text-xs text-muted">Business account</p>
          <div className="mt-3 space-y-2 border-t border-border pt-3 text-left text-xs">
            <p>{p.about || <span className="text-muted">About text</span>}</p>
            {p.address && <p className="text-muted">{p.address}</p>}
            {p.email && <p className="break-all text-brand">{p.email}</p>}
            {p.website && <p className="break-all text-brand">{p.website}</p>}
          </div>
        </div>
      </Card>
    </div>
  )
}

function CannedTab() {
  const canned = useStore(s => s.cannedMessages)
  const [editing, setEditing] = useState<CannedMessage | 'new' | null>(null)
  const [deleting, setDeleting] = useState<CannedMessage | null>(null)
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">Type the shortcut (for example /details) in Live chat to insert the full reply.</p>
        <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>New canned message</Button>
      </div>
      {canned.length === 0 ? (
        <Card><EmptyState icon={Zap} title="No canned messages" text="Save replies you send often so the team can insert them in one tap." action={<Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>New canned message</Button>} /></Card>
      ) : (
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead><tr><th className={thCls}>Shortcut</th><th className={thCls}>Message</th><th className={thCls} /></tr></thead>
            <tbody>
              {canned.map(c => (
                <tr key={c.id} className={trCls}>
                  <td className={tdCls}><Badge tone="brand">{c.shortcut}</Badge></td>
                  <td className={tdCls}><span className="block min-w-56 text-sm whitespace-pre-wrap">{c.text}</span></td>
                  <td className={tdCls}>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(c)} aria-label={`Edit ${c.shortcut}`} />
                      <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDeleting(c)} aria-label={`Delete ${c.shortcut}`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <CannedForm item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete canned message?"
        footer={<><Button onClick={() => setDeleting(null)}>Keep it</Button><Button variant="danger" icon={Trash2} onClick={() => { if (deleting) useStore.getState().remove('cannedMessages', deleting.id); setDeleting(null) }}>Delete</Button></>}
      >
        <p className="text-sm">The shortcut <strong>{deleting?.shortcut}</strong> will stop working in Live chat.</p>
      </Modal>
    </div>
  )
}

function CannedForm({ item, onClose }: { item?: CannedMessage; onClose: () => void }) {
  const canned = useStore(s => s.cannedMessages)
  const [shortcut, setShortcut] = useState(item?.shortcut ?? '/')
  const [text, setText] = useState(item?.text ?? '')
  const clean = (v: string) => '/' + v.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24)
  const taken = canned.some(c => c.shortcut === shortcut && c.id !== item?.id)
  const error = shortcut.length < 2 ? 'Give the shortcut a name, for example /survey.' : taken ? 'This shortcut is already used.' : !text.trim() ? 'Write the message.' : ''
  const save = () => {
    if (error) return
    const s = useStore.getState()
    if (item) s.update('cannedMessages', item.id, { shortcut, text: text.trim() })
    else s.add('cannedMessages', { shortcut, text: text.trim() })
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={item ? 'Edit canned message' : 'New canned message'} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!error} onClick={save}>Save</Button></>}>
      <div className="space-y-3">
        <Field label="Shortcut" hint="Starts with “/”. Lowercase letters and numbers only."><Input value={shortcut} onChange={e => setShortcut(clean(e.target.value))} autoFocus /></Field>
        <Field label="Message"><Textarea rows={4} value={text} onChange={e => setText(e.target.value)} placeholder="Please share pickup address, drop address and shifting date." /></Field>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    </Modal>
  )
}

function OptOutTab() {
  const [keywords, setKeywords] = useLocal<string[]>(OPT_OUT_KEYWORDS_KEY, DEFAULT_OPT_OUT_KEYWORDS)
  const [numbers, setNumbers] = useLocal<string[]>(OPT_OUT_NUMBERS_KEY, [])
  const leads = useStore(s => s.leads)
  const [kw, setKw] = useState('')
  const [num, setNum] = useState('')
  const kwClean = kw.trim().toUpperCase()
  const numClean = digits(num)
  const numOk = numClean.length === 10 && !numbers.includes(numClean)
  const addKw = () => { if (kwClean && !keywords.includes(kwClean)) setKeywords([...keywords, kwClean]); setKw('') }
  const addNum = () => { if (numOk) { setNumbers([numClean, ...numbers]); setNum('') } }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Opt-out keywords">
        <div className="space-y-3 p-4">
          <p className="text-xs text-muted">When a customer sends one of these words, their number should be added to the opted-out list and left out of campaigns.</p>
          <div className="flex flex-wrap gap-1.5">
            {keywords.length === 0 && <span className="text-xs text-muted">No keywords. Add one below.</span>}
            {keywords.map(k => (
              <span key={k} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-2.5 pr-1 text-xs font-medium">
                {k}
                <button onClick={() => setKeywords(keywords.filter(x => x !== k))} className="cursor-pointer rounded-full p-0.5 text-muted hover:text-rose-600" aria-label={`Remove ${k}`}><X size={12} /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={kw} onChange={e => setKw(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKw() } }} placeholder="e.g. STOP" />
            <Button icon={Plus} disabled={!kwClean || keywords.includes(kwClean)} onClick={addKw}>Add</Button>
          </div>
        </div>
      </Card>
      <Card title={`Opted-out numbers (${numbers.length})`}>
        <div className="space-y-3 p-4">
          <p className="text-xs text-muted">Campaigns skip these numbers. The list is saved on this device.</p>
          <div className="flex gap-2">
            <Input value={num} onChange={e => setNum(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNum() } }} placeholder="10-digit mobile number" inputMode="tel" />
            <Button icon={Plus} disabled={!numOk} onClick={addNum}>Add</Button>
          </div>
          {num && !numOk && <p className="text-xs text-amber-600">{numbers.includes(numClean) ? 'This number is already on the list.' : 'Enter a 10-digit mobile number.'}</p>}
          {numbers.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs text-muted">No one has opted out.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {numbers.map(n => {
                const lead = leads.find(l => digits(l.phone) === n)
                return (
                  <li key={n} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="font-medium">+91 {n}</span>
                    {lead && <Link to={`/leads/${lead.id}`} className="truncate text-xs text-brand hover:underline">{lead.name}</Link>}
                    <button onClick={() => setNumbers(numbers.filter(x => x !== n))} className="ml-auto cursor-pointer rounded p-1 text-muted hover:bg-surface-2 hover:text-rose-600" aria-label={`Remove ${n}`}><Trash2 size={14} /></button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )
}

function ConnectionTab() {
  const wa = useStore(s => s.integrations.find(i => i.id === 'in_wa'))
  const connected = !!wa?.connected
  const number = wa?.config.phone || wa?.config.number || wa?.config.phoneNumber
  return (
    <Card title="WhatsApp Business API">
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand"><Plug size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{wa?.name ?? 'WhatsApp Business API'}</p>
            <p className="text-xs text-muted">{wa?.description ?? 'Send and receive WhatsApp messages from your business number.'}</p>
          </div>
          {connected ? <Badge tone="good">Connected</Badge> : <Badge tone="warn">Not connected</Badge>}
        </div>
        {connected ? (
          <p className="text-sm">{number ? <>Business number: <strong>{number}</strong>. </> : null}The integration is marked as connected. This version of the CRM still has no server, so messages remain simulated.</p>
        ) : (
          <p className="text-sm">No number is connected, so every message, template approval and campaign result in this section is simulated and nothing reaches customers.</p>
        )}
        {wa?.note && <p className="text-xs text-muted">{wa.note}</p>}
        <Link to="/integrations"><Button variant="primary" icon={Plug}>{connected ? 'Manage in Integrations' : 'Connect in Integrations'}</Button></Link>
      </div>
    </Card>
  )
}
