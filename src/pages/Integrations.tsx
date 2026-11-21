import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Copy, Plug, Search, Settings2, Unplug } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Integration } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Badge, Button, Card, DemoNotice, EmptyState, Field, Input, Modal, PageHeader } from '@/components/ui'
import { Confirm, copyText } from '@/components/admin/shared'

interface FieldDef { key: string; label: string; placeholder?: string; hint?: string; secret?: boolean }
const telephony = (idLabel: string, keyLabel: string): FieldDef[] => [
  { key: 'accountSid', label: idLabel, placeholder: 'From your provider dashboard' },
  { key: 'apiKey', label: keyLabel, secret: true },
  { key: 'callerId', label: 'Caller ID (the number customers see)', placeholder: '+91 11 4000 0000' },
]
const FIELDS: Record<string, FieldDef[]> = {
  in_wa: [
    { key: 'phoneNumberId', label: 'Phone number ID', placeholder: 'e.g. 104512345678901', hint: 'Found in Meta Business Manager under WhatsApp > API setup.' },
    { key: 'businessNumber', label: 'WhatsApp business number', placeholder: '+91 98100 00001' },
    { key: 'accessToken', label: 'Permanent access token', secret: true },
  ],
  in_fb: [{ key: 'pageName', label: 'Facebook page name', placeholder: 'Super Packers and Movers' }],
  in_gads: [{ key: 'customerId', label: 'Google Ads customer ID', placeholder: '123-456-7890' }, { key: 'webhookKey', label: 'Lead form webhook key', secret: true }],
  in_jd: [{ key: 'registeredMobile', label: 'Mobile number registered with JustDial', placeholder: '98100 00001' }],
  in_im: [{ key: 'registeredMobile', label: 'Mobile number registered with IndiaMART', placeholder: '98100 00001' }, { key: 'crmKey', label: 'IndiaMART CRM key', secret: true }],
  in_sheets: [{ key: 'sheetUrl', label: 'Google Sheet link', placeholder: 'https://docs.google.com/spreadsheets/d/…' }],
  in_gcal: [{ key: 'calendarEmail', label: 'Google account email', placeholder: 'you@gmail.com' }],
  in_meta: [{ key: 'pixelId', label: 'Pixel / dataset ID', placeholder: 'e.g. 123456789012345' }, { key: 'accessToken', label: 'Conversions API access token', secret: true }],
  in_rzp: [{ key: 'keyId', label: 'Key ID', placeholder: 'rzp_live_…' }, { key: 'keySecret', label: 'Key secret', secret: true }],
  in_exotel: telephony('Account SID', 'API key'),
  in_plivo: telephony('Auth ID', 'Auth token'),
  in_twilio: telephony('Account SID', 'Auth token'),
  in_shopify: [{ key: 'storeDomain', label: 'Store address', placeholder: 'your-store.myshopify.com' }, { key: 'adminToken', label: 'Admin API access token', secret: true }],
}
const fieldsFor = (i: Integration): FieldDef[] => FIELDS[i.id] ?? (i.category === 'Telephony' ? telephony('Account SID', 'API key') : [{ key: 'account', label: 'Account name or ID' }])
const isWebsite = (i: Integration) => i.id === 'in_web' || /website/i.test(i.name)
const SAVED_NOTE = 'Saved, not yet verified — live sync needs the server version'
const labelOf = (i: Integration, key: string) => fieldsFor(i).find(f => f.key === key)?.label ?? (key === 'webhook' ? 'Webhook address' : key)

function CopyBlock({ label, text, mono = true }: { label: string; text: string; mono?: boolean }) {
  const [state, setState] = useState<'' | 'ok' | 'fail'>('')
  const copy = async () => { setState((await copyText(text)) ? 'ok' : 'fail'); window.setTimeout(() => setState(''), 2000) }
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        <Button size="sm" variant="ghost" icon={state === 'ok' ? CheckCircle2 : Copy} onClick={copy}>{state === 'ok' ? 'Copied' : state === 'fail' ? 'Select and copy by hand' : 'Copy'}</Button>
      </div>
      <pre className={cn('max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-surface-2 p-3 text-xs', mono && 'font-mono')}>{text}</pre>
    </div>
  )
}

const snippet = (hook: string) => `<form action="${hook}" method="POST">
  <input name="name" placeholder="Your name" required>
  <input name="phone" placeholder="Mobile number" required>
  <input name="city" placeholder="Moving from (city)">
  <button type="submit">Get a free quote</button>
</form>`

export default function Integrations() {
  const integrations = useStore(s => s.integrations)
  const sources = useStore(s => s.sources)
  const [cat, setCat] = useState('All')
  const [q, setQ] = useState('')
  const [connectId, setConnectId] = useState<string | null>(null)
  const [manageId, setManageId] = useState<string | null>(null)
  const [disconnectId, setDisconnectId] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [test, setTest] = useState({ name: '', phone: '', city: '' })
  const [testError, setTestError] = useState('')
  const [captured, setCaptured] = useState<{ id: string; name: string; no: number; owner?: string } | null>(null)

  const categories = useMemo(() => ['All', ...Array.from(new Set(integrations.map(i => i.category)))], [integrations])
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return integrations.filter(i => (cat === 'All' || i.category === cat) && (!s || i.name.toLowerCase().includes(s) || i.description.toLowerCase().includes(s) || i.category.toLowerCase().includes(s)))
  }, [integrations, cat, q])
  const connectedCount = integrations.filter(i => i.connected).length
  const connecting = integrations.find(i => i.id === connectId)
  const managing = integrations.find(i => i.id === manageId)
  const disconnecting = integrations.find(i => i.id === disconnectId)

  const hookFor = (i: Integration) => i.config.webhook || `https://your-crm-server.example/hooks/website/${i.id}`
  const openConnect = (i: Integration) => { setValues({ ...i.config }); setError(''); setConnectId(i.id) }
  const openManage = (i: Integration) => { setTest({ name: '', phone: '', city: '' }); setTestError(''); setCaptured(null); setManageId(i.id) }

  const saveConnect = () => {
    if (!connecting) return
    const defs = fieldsFor(connecting)
    const config: Record<string, string> = {}
    if (isWebsite(connecting)) config.webhook = hookFor(connecting)
    else {
      for (const f of defs) {
        if (f.secret) continue // secrets are never written to browser storage
        const v = (values[f.key] ?? '').trim()
        if (!v) { setError(`Please fill in “${f.label}”.`); return }
        config[f.key] = v
      }
    }
    useStore.getState().update('integrations', connecting.id, { connected: true, config, note: SAVED_NOTE })
    setValues({}); setConnectId(null)
  }
  const disconnect = () => {
    if (!disconnecting) return
    useStore.getState().update('integrations', disconnecting.id, { connected: false, config: {}, note: undefined })
    setDisconnectId(null); setManageId(null)
  }
  const submitTest = () => {
    const name = test.name.trim(), phone = test.phone.replace(/\D/g, '')
    if (!name) { setTestError('Type a name.'); return }
    if (phone.length < 10) { setTestError('Type a mobile number with at least 10 digits.'); return }
    const st = useStore.getState()
    const src = st.sources.find(s => /website/i.test(s.label)) ?? st.sources[0]
    const city = test.city.trim() || undefined
    const lead = st.createLead({ name, phone, city, moveFrom: city, ...(src ? { sourceId: src.id } : {}) })
    if (st.settings.notifyNewLead) st.notify('New website lead', `${lead.name} filled in the website form`, `/leads/${lead.id}`)
    setCaptured({ id: lead.id, name: lead.name, no: lead.no, owner: st.users.find(u => u.id === lead.ownerId)?.name })
    setTest({ name: '', phone: '', city: '' }); setTestError('')
  }
  const websiteSource = sources.find(s => /website/i.test(s.label)) ?? sources[0]

  return (
    <div>
      <PageHeader title="Integrations" icon={Plug} subtitle={`${connectedCount} of ${integrations.length} connected`} />
      <DemoNotice>
        Connections are <strong>recorded here only</strong>. This browser-only version has no server, so it does not send data to or receive data from WhatsApp, Facebook, Google, JustDial, IndiaMART, Razorpay, Shopify or any telephony provider.
        Your account details are kept so the server version can verify them and start live sync. Secret keys and tokens are never saved in this browser.
      </DemoNotice>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input className="pl-9" value={q} onChange={e => setQ(e.target.value)} placeholder="Search integrations" aria-label="Search integrations" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map(c => (
            <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c}
              className={cn('rounded-full border px-3 py-1 text-xs font-medium cursor-pointer', cat === c ? 'border-brand bg-brand-soft text-brand' : 'border-border bg-surface text-muted hover:text-text')}>
              {c}{c !== 'All' && <span className="ml-1 opacity-70">{integrations.filter(i => i.category === c).length}</span>}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <Card><EmptyState icon={Plug} title="No integrations match" text="Try another word or category." action={<Button onClick={() => { setQ(''); setCat('All') }}>Clear filters</Button>} /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map(i => (
            <div key={i.id} className="flex flex-col rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold">{i.name}</h3>
                <Badge tone="brand">{i.category}</Badge>
              </div>
              <p className="mt-1.5 flex-1 text-xs text-muted">{i.description}</p>
              <div className="mt-3 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  {i.connected ? <Badge tone="good"><CheckCircle2 size={12} />Connected</Badge> : <Badge>Not connected</Badge>}
                  {i.connected && i.note && <p className="mt-1 text-xs text-muted">{i.note}</p>}
                </div>
                {i.connected
                  ? <Button size="sm" icon={Settings2} onClick={() => openManage(i)}>Manage</Button>
                  : <Button size="sm" variant="primary" icon={Plug} onClick={() => openConnect(i)}>Connect</Button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!connecting} onClose={() => { setValues({}); setConnectId(null) }} title={connecting ? `Connect ${connecting.name}` : ''}
        footer={<><Button onClick={() => { setValues({}); setConnectId(null) }}>Cancel</Button><Button variant="primary" onClick={saveConnect}>Save connection</Button></>}>
        {connecting && (
          <div className="space-y-4">
            {isWebsite(connecting) ? <>
              <p className="text-sm">Point your website’s enquiry form at this address. Each submission becomes a lead with the source “{websiteSource?.label ?? 'Website'}”.</p>
              <CopyBlock label="Webhook address" text={hookFor(connecting)} />
              <CopyBlock label="HTML form to paste into your website" text={snippet(hookFor(connecting))} />
              <p className="text-xs text-muted">The address above is a placeholder. The server version gives you a real address that accepts submissions; until then, use the test form under Manage to see how a captured lead looks.</p>
            </> : <>
              {fieldsFor(connecting).map(f => (
                <Field key={f.key} label={f.label} hint={f.secret ? 'Not saved. This browser version never stores secret keys; you will enter it again in the server version.' : f.hint}>
                  <Input type={f.secret ? 'password' : 'text'} autoComplete="off" placeholder={f.placeholder} value={values[f.key] ?? ''} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} />
                </Field>
              ))}
              <p className="text-xs text-muted">After saving, this shows as “Connected” with the note “{SAVED_NOTE}”. Nothing is sent to {connecting.name}.</p>
            </>}
            {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
          </div>
        )}
      </Modal>

      <Modal open={!!managing && !disconnecting} onClose={() => setManageId(null)} title={managing ? `Manage ${managing.name}` : ''} wide={!!managing && isWebsite(managing)}
        footer={managing && <><Button variant="danger" icon={Unplug} onClick={() => setDisconnectId(managing.id)}>Disconnect</Button><Button onClick={() => { const m = managing; setManageId(null); openConnect(m) }}>Edit details</Button><Button variant="primary" onClick={() => setManageId(null)}>Done</Button></>}>
        {managing && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2"><Badge tone="good"><CheckCircle2 size={12} />Connected</Badge>{managing.note && <span className="text-xs text-muted">{managing.note}</span>}</div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted">Saved details</p>
              {Object.keys(managing.config).length === 0 ? <p className="text-sm text-muted">No details saved.</p> : (
                <dl className="divide-y divide-border rounded-lg border border-border text-sm">
                  {Object.entries(managing.config).map(([k, v]) => (
                    <div key={k} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 px-3 py-2"><dt className="text-muted">{labelOf(managing, k)}</dt><dd className="break-all font-medium">{v}</dd></div>
                  ))}
                </dl>
              )}
              {fieldsFor(managing).some(f => f.secret) && !isWebsite(managing) && <p className="mt-1.5 text-xs text-muted">Secret keys and tokens were not saved.</p>}
            </div>
            {isWebsite(managing) && <>
              <CopyBlock label="HTML form to paste into your website" text={snippet(hookFor(managing))} />
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold">Try the website form</h3>
                <p className="mt-0.5 text-xs text-muted">This form works. Submitting it creates a real lead in this CRM with the source “{websiteSource?.label ?? 'Website'}”, exactly as a website enquiry would once the server version is receiving them.</p>
                <form className="mt-3 grid gap-3 sm:grid-cols-3" onSubmit={e => { e.preventDefault(); submitTest() }}>
                  <Field label="Name"><Input value={test.name} onChange={e => setTest(t => ({ ...t, name: e.target.value }))} placeholder="Rohan Mehta" /></Field>
                  <Field label="Mobile number"><Input inputMode="tel" value={test.phone} onChange={e => setTest(t => ({ ...t, phone: e.target.value }))} placeholder="98765 43210" /></Field>
                  <Field label="Moving from (city)"><Input value={test.city} onChange={e => setTest(t => ({ ...t, city: e.target.value }))} placeholder="Gurugram" /></Field>
                  <div className="sm:col-span-3"><Button type="submit" variant="primary">Get a free quote</Button></div>
                </form>
                {testError && <p role="alert" className="mt-2 text-sm text-rose-600">{testError}</p>}
                {captured && (
                  <p role="status" className="mt-3 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-600">
                    Lead #{captured.no} “{captured.name}” was created{captured.owner ? ` and assigned to ${captured.owner}` : ''}.{' '}
                    <Link className="font-semibold underline" to={`/leads/${captured.id}`}>Open the lead</Link>
                  </p>
                )}
              </div>
            </>}
          </div>
        )}
      </Modal>

      <Confirm open={!!disconnecting} onClose={() => setDisconnectId(null)} title={`Disconnect ${disconnecting?.name ?? ''}?`} confirmLabel="Disconnect" onConfirm={disconnect}>
        <p>The saved details for {disconnecting?.name} will be removed from this CRM. Leads and messages already here are not affected.</p>
      </Confirm>
    </div>
  )
}
