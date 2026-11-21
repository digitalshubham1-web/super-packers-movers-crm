import { useRef, useState } from 'react'
import { Download, RotateCcw, Upload } from 'lucide-react'
import { useStore, type State } from '@/lib/store'
import type { CollectionName, DB, Settings } from '@/lib/types'
import { fmtDateTime } from '@/lib/utils'
import { Button, Card } from '@/components/ui'
import { Confirm, SavedTag, useSaved } from './shared'

const COLLECTIONS: CollectionName[] = [
  'leads', 'activities', 'tasks', 'events', 'users', 'stages', 'sources', 'lostReasons', 'customFields', 'items', 'quotations', 'invoices', 'payments',
  'automations', 'conversations', 'messages', 'templates', 'botFlows', 'waCampaigns', 'cannedMessages', 'aiAgents', 'voiceAgents', 'calls', 'callCampaigns',
  'emails', 'emailTemplates', 'integrations', 'notifications',
]
const NAMES: Partial<Record<CollectionName, string>> = { leads: 'leads', tasks: 'tasks', invoices: 'invoices', quotations: 'quotations', users: 'team members' }
type Backup = { data: DB; settings: Settings; currentUserId: string; theme: 'light' | 'dark'; rrIndex: number; exportedAt?: string }
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Checks a parsed backup file. Returns the cleaned backup or a list of problems in plain words. */
function validate(raw: unknown, current: State): { backup?: Backup; errors: string[] } {
  const errors: string[] = []
  if (!isObj(raw)) return { errors: ['This file is not a CRM backup.'] }
  if (raw.app !== undefined && raw.app !== 'spm-crm') errors.push('This backup was made by a different app.')
  const src = isObj(raw.data) ? raw.data : raw
  const data = {} as Record<string, unknown[]>
  for (const c of COLLECTIONS) {
    const v = src[c]
    if (!Array.isArray(v)) { errors.push(`The “${c}” list is missing.`); continue }
    const bad = v.findIndex(r => !isObj(r) || typeof r.id !== 'string' || !r.id)
    if (bad >= 0) { errors.push(`Record ${bad + 1} in “${c}” has no id.`); continue }
    data[c] = v
  }
  if (errors.length) return { errors: errors.slice(0, 6) }
  const db = data as unknown as DB
  if (!db.users.length) errors.push('The backup has no team members.')
  if (!db.stages.length) errors.push('The backup has no lead stages.')
  else {
    if (db.stages.filter(s => s.isInitial).length !== 1) errors.push('The backup must have exactly one initial stage.')
    if (!db.stages.some(s => s.isWon) || !db.stages.some(s => s.isLost)) errors.push('The backup needs at least one Won and one Lost stage.')
  }
  if (db.leads.some(l => typeof l.name !== 'string' || typeof l.phone !== 'string' || !Array.isArray(l.tags) || !isObj(l.custom))) errors.push('Some leads are missing a name, phone, tags or custom details.')
  const stageIds = new Set(db.stages.map(s => s.id))
  if (db.leads.some(l => !stageIds.has(l.stageId))) errors.push('Some leads point to a stage that is not in the backup.')
  const rs = raw.settings ?? (isObj(raw.data) ? undefined : src.settings)
  if (!isObj(rs) || typeof rs.businessName !== 'string' || !Array.isArray(rs.taskTypes) || !Array.isArray(rs.workDays) || !Array.isArray(rs.autoAssignUserIds)) errors.push('The business settings are missing or incomplete.')
  if (errors.length) return { errors }
  const settings = { ...current.settings, ...(rs as Partial<Settings>) }
  const uidRaw = typeof raw.currentUserId === 'string' ? raw.currentUserId : ''
  return {
    errors,
    backup: {
      data: db, settings,
      currentUserId: db.users.some(u => u.id === uidRaw) ? uidRaw : db.users[0].id,
      theme: raw.theme === 'dark' || raw.theme === 'light' ? raw.theme : current.theme,
      rrIndex: typeof raw.rrIndex === 'number' ? raw.rrIndex : 0,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : undefined,
    },
  }
}

export function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [saved, flash] = useSaved()
  const [message, setMessage] = useState('Saved')
  const [errors, setErrors] = useState<string[]>([])
  const [pending, setPending] = useState<{ backup: Backup; fileName: string } | null>(null)
  const [reset, setReset] = useState(false)
  const leadCount = useStore(s => s.leads.length)

  const exportAll = () => {
    const st = useStore.getState()
    const data = Object.fromEntries(COLLECTIONS.map(c => [c, st[c]]))
    const file = { app: 'spm-crm', version: 1, exportedAt: new Date().toISOString(), data, settings: st.settings, currentUserId: st.currentUserId, theme: st.theme, rrIndex: st.rrIndex }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }))
    a.download = `crm-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a); a.click(); a.remove()
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    setMessage('Backup downloaded'); flash()
  }
  const onFile = async (file?: File) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setErrors([]); setPending(null)
    let raw: unknown
    try { raw = JSON.parse(await file.text()) } catch { setErrors(['This file could not be read as JSON. Choose a backup file exported from this CRM.']); return }
    const res = validate(raw, useStore.getState())
    if (!res.backup) { setErrors(res.errors); return }
    setPending({ backup: res.backup, fileName: file.name })
  }
  const applyImport = () => {
    if (!pending) return
    const b = pending.backup
    useStore.setState({ ...b.data, settings: b.settings, currentUserId: b.currentUserId, theme: b.theme, rrIndex: b.rrIndex })
    setPending(null); setMessage('Backup restored'); flash()
  }

  return (
    <Card title={<span className="flex items-center gap-2">Data <SavedTag show={saved} text={message} /></span>}>
      <div className="divide-y divide-border">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0 flex-1"><p className="text-sm font-medium">Export everything</p><p className="text-xs text-muted">Download one JSON backup file with all {leadCount} leads, tasks, billing, messages, team and settings. Your data lives only in this browser, so keep a backup.</p></div>
          <Button icon={Download} onClick={exportAll}>Download backup</Button>
        </div>
        <div className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">Import a backup</p><p className="text-xs text-muted">Replace everything in this browser with the contents of a backup file. The file is checked first, and you confirm before anything changes.</p></div>
            <Button icon={Upload} onClick={() => fileRef.current?.click()}>Choose backup file</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
          </div>
          {errors.length > 0 && (
            <div role="alert" className="mt-3 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-600">
              <p className="font-medium">This file cannot be imported. Nothing was changed.</p>
              <ul className="mt-1 list-disc pl-5 text-xs">{errors.map(e => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0 flex-1"><p className="text-sm font-medium">Reset to sample data</p><p className="text-xs text-muted">Remove everything and load the sample leads, tasks and invoices again.</p></div>
          <Button variant="danger" icon={RotateCcw} onClick={() => setReset(true)}>Reset</Button>
        </div>
      </div>

      <Confirm open={!!pending} onClose={() => setPending(null)} title="Replace all data with this backup?" confirmLabel="Replace my data" onConfirm={applyImport}>
        {pending && <>
          <p><strong>{pending.fileName}</strong>{pending.backup.exportedAt ? ` (exported ${fmtDateTime(pending.backup.exportedAt)})` : ''} passed the checks and contains:</p>
          <ul className="list-disc pl-5">{(Object.keys(NAMES) as CollectionName[]).map(c => <li key={c}>{pending.backup.data[c].length} {NAMES[c]}</li>)}</ul>
          <p className="text-rose-600">Everything currently in this browser ({leadCount} leads and all other records) will be replaced. This cannot be undone, so download a backup first if you may need the current data.</p>
        </>}
      </Confirm>
      <Confirm open={reset} onClose={() => setReset(false)} title="Reset to sample data?" confirmLabel="Reset everything"
        onConfirm={() => { useStore.getState().resetDemo(); setReset(false); setMessage('Sample data loaded'); flash() }}>
        <p>All leads, tasks, invoices, messages, team members and settings in this browser will be deleted and replaced with the sample data. This cannot be undone.</p>
      </Confirm>
    </Card>
  )
}
