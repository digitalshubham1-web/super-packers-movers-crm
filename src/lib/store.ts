import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ActivityType, CollectionName, DB, Lead, RecordOf, Settings } from './types'
import { buildSeed } from './seed'
import { nowIso, uid } from './utils'

/**
 * One store for the whole app, saved in the browser (localStorage).
 * Read:   const leads = useStore(s => s.leads)
 * Write:  const { add, update, remove } = useStore.getState()  (or useStore(s => s.add))
 */
interface Actions {
  /** Add a record. `id` is generated when missing. Returns the saved record. */
  add: <K extends CollectionName>(col: K, item: Omit<RecordOf<K>, 'id'> & { id?: string }) => RecordOf<K>
  update: <K extends CollectionName>(col: K, id: string, patch: Partial<RecordOf<K>>) => void
  remove: <K extends CollectionName>(col: K, id: string) => void
  /** Add an entry to a lead's timeline (and the global activity feed). */
  log: (type: ActivityType, text: string, leadId?: string) => void
  /** Create a lead with the right number, initial stage, round-robin owner, timeline entries and automations. */
  createLead: (data: Partial<Lead> & { name: string; phone: string }) => Lead
  /** Change a lead's stage and record it on the timeline. */
  setLeadStage: (leadId: string, stageId: string, lostReasonId?: string) => void
  setLeadOwner: (leadId: string, ownerId: string | undefined) => void
  notify: (title: string, body: string, link?: string) => void
  setSettings: (patch: Partial<Settings>) => void
  setTheme: (t: 'light' | 'dark') => void
  setCurrentUser: (id: string) => void
  resetDemo: () => void
}
export interface State extends DB { settings: Settings; currentUserId: string; theme: 'light' | 'dark'; rrIndex: number }

const seed = buildSeed()

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...seed.db,
      settings: seed.settings,
      currentUserId: 'u1',
      theme: 'light',
      rrIndex: 0,

      add: (col, item) => {
        const rec = { ...item, id: item.id ?? uid() } as RecordOf<typeof col>
        set(s => ({ [col]: [rec, ...(s[col] as unknown[])] }) as Partial<State>)
        return rec
      },
      update: (col, id, patch) =>
        set(s => ({ [col]: (s[col] as { id: string }[]).map(r => (r.id === id ? { ...r, ...patch } : r)) }) as Partial<State>),
      remove: (col, id) => set(s => ({ [col]: (s[col] as { id: string }[]).filter(r => r.id !== id) }) as Partial<State>),

      log: (type, text, leadId) =>
        set(s => ({ activities: [{ id: uid(), type, text, leadId, userId: s.currentUserId, at: nowIso() }, ...s.activities] })),

      createLead: data => {
        const s = get()
        const initial = s.stages.find(x => x.isInitial) ?? s.stages[0]
        let ownerId = data.ownerId
        let rrIndex = s.rrIndex
        const pool = s.settings.autoAssignUserIds.filter(id => s.users.find(u => u.id === id && u.active))
        const autoRule = s.automations.find(a => a.active && a.trigger === 'new_lead' && a.action === 'assign')
        if (!ownerId && s.settings.autoAssign && autoRule && pool.length) { ownerId = pool[rrIndex % pool.length]; rrIndex++ }
        const lead: Lead = {
          rating: 0, value: 0, tags: [], custom: {}, sourceId: s.sources[0]?.id ?? '', ...data,
          id: uid(), no: Math.max(1000, ...s.leads.map(l => l.no)) + 1, stageId: data.stageId ?? initial.id, ownerId,
          createdAt: nowIso(), updatedAt: nowIso(),
        }
        const src = s.sources.find(x => x.id === lead.sourceId)?.label ?? 'manual entry'
        const owner = s.users.find(u => u.id === ownerId)
        const acts = [
          ...(owner ? [{ id: uid(), type: 'owner' as const, text: `Assigned to ${owner.name}${data.ownerId ? '' : ' (auto-assign)'}`, leadId: lead.id, at: nowIso() }] : []),
          { id: uid(), type: 'system' as const, text: `Lead created from ${src}`, leadId: lead.id, userId: s.currentUserId, at: nowIso() },
        ]
        // Run the simple "new lead" automations that can work without outside services.
        const extraTasks = s.automations
          .filter(a => a.active && a.trigger === 'new_lead' && a.action === 'task' && (!a.filterSourceId || a.filterSourceId === lead.sourceId))
          .map(a => ({
            id: uid(), title: a.actionConfig.title || 'Follow up with new lead', type: 'Follow up', leadId: lead.id, assigneeId: ownerId ?? s.currentUserId,
            dueAt: new Date(Date.now() + Math.max(a.delayMin, 60) * 60000).toISOString(), status: 'pending' as const,
            priority: (a.actionConfig.priority as 'medium') || 'medium', createdBy: 'automation' as const, createdAt: nowIso(),
          }))
        set({
          leads: [lead, ...s.leads], activities: [...acts, ...s.activities], tasks: [...extraTasks, ...s.tasks], rrIndex,
          automations: s.automations.map(a => (a.active && a.trigger === 'new_lead' ? { ...a, runs: a.runs + 1 } : a)),
        })
        return lead
      },

      setLeadStage: (leadId, stageId, lostReasonId) => {
        const s = get()
        const st = s.stages.find(x => x.id === stageId)
        set({ leads: s.leads.map(l => (l.id === leadId ? { ...l, stageId, lostReasonId: st?.isLost ? lostReasonId : undefined, updatedAt: nowIso() } : l)) })
        get().log('stage', `Stage changed to ${st?.label ?? stageId}`, leadId)
      },
      setLeadOwner: (leadId, ownerId) => {
        const s = get()
        set({ leads: s.leads.map(l => (l.id === leadId ? { ...l, ownerId, updatedAt: nowIso() } : l)) })
        get().log('owner', ownerId ? `Assigned to ${s.users.find(u => u.id === ownerId)?.name}` : 'Owner removed', leadId)
      },
      notify: (title, body, link) => set(s => ({ notifications: [{ id: uid(), title, body, link, read: false, at: nowIso() }, ...s.notifications] })),
      setSettings: patch => set(s => ({ settings: { ...s.settings, ...patch } })),
      setTheme: theme => set({ theme }),
      setCurrentUser: currentUserId => set({ currentUserId }),
      resetDemo: () => { const f = buildSeed(); set({ ...f.db, settings: f.settings, currentUserId: 'u1', rrIndex: 0 }) },
    }),
    { name: 'spm-crm-v1' },
  ),
)

// Small selector helpers
export const useCurrentUser = () => useStore(s => s.users.find(u => u.id === s.currentUserId) ?? s.users[0])
export const useLead = (id?: string) => useStore(s => s.leads.find(l => l.id === id))
