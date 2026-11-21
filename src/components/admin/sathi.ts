/* Rule-based answers for the "Sathi" helper. Everything here reads the store; nothing calls an AI model. */
import { useStore } from '@/lib/store'
import type { Lead, Stage } from '@/lib/types'
import { docTotals, fmtDate, friendlyDay, inr, invoicePaid } from '@/lib/utils'

export interface ChatLink { label: string; to: string }
export type Proposal =
  | { kind: 'task'; leadId: string; leadName: string; title: string; dueAt: string; type: string }
  | { kind: 'stage'; leadId: string; leadName: string; stageId: string; stageLabel: string; fromLabel: string }
export interface Reply { text: string; links?: ChatLink[]; copy?: string; proposal?: Proposal }

export const STARTERS = ['Summarise my pipeline', 'Which leads should I contact today?', "Show today's new leads", 'What is overdue?', 'Draft a follow-up message']
export const HELP = `Here is what I can do:
• **Summarise my pipeline** – leads and ₹ value in each stage
• **Which leads should I contact today?** – follow-ups due or overdue
• **Show today's new leads**
• **What is overdue?** – tasks past their due time
• **Outstanding invoices** – billed, received and unpaid amounts
• **Top sources** – where leads come from
• **Find Rohan** or **find 98765** – look up a lead by name or phone
• **Draft a follow-up message for Rohan** (add “email” for an email)
• **Create a task to call Rohan tomorrow**
• **Move Rohan to Contacted**`

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const leadLink = (l: Lead, extra?: string): ChatLink => ({ label: extra ? `${l.name} · ${extra}` : l.name, to: `/leads/${l.id}` })
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d }
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }

/** Leads named in the text: full-name matches first, otherwise any name word, otherwise phone digits. */
function leadsIn(text: string, leads: Lead[]): Lead[] {
  const q = ' ' + text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ') + ' '
  const full = leads.filter(l => q.includes(' ' + l.name.toLowerCase() + ' '))
  if (full.length) return full
  const words = new Set(q.trim().split(' ').filter(w => w.length >= 3))
  const byWord = leads.filter(l => l.name.toLowerCase().split(/\s+/).some(w => words.has(w)))
  if (byWord.length) return byWord
  const digits = (text.match(/\d{4,}/g) ?? []).join('')
  return digits ? leads.filter(l => l.phone.replace(/\D/g, '').includes(digits)) : []
}
function stageIn(text: string, stages: Stage[]): Stage | undefined {
  const q = text.toLowerCase()
  const after = (q.split(/\s(?:to|as|into)\s/).pop() ?? q).replace(/[^a-z0-9\s]/g, ' ').replace(/\b(stage|the)\b/g, '').trim()
  const byLabel = [...stages].sort((a, b) => b.label.length - a.label.length)
  return byLabel.find(s => q.includes(s.label.toLowerCase()))
    ?? (after.length >= 3 ? byLabel.find(s => s.label.toLowerCase().includes(after)) : undefined)
    ?? (/\bwon\b|\bdone\b|\bclosed\b/.test(after) ? stages.find(s => s.isWon) : undefined)
    ?? (/\blost\b|\bdead\b/.test(after) ? stages.find(s => s.isLost) : undefined)
    ?? (after.length >= 3 ? byLabel.find(s => s.label.toLowerCase().split(/\s+/).some(w => w.length >= 4 && after.includes(w))) : undefined)
}
function dueFrom(q: string): string {
  const d = new Date()
  const inDays = q.match(/in (\d+) days?/)
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const wd = days.findIndex(x => q.includes(x))
  if (/\btoday\b|\bnow\b/.test(q)) { const t = new Date(); t.setHours(18, 0, 0, 0); return (t.getTime() > Date.now() + 30 * 60000 ? t : new Date(Date.now() + 3600000)).toISOString() }
  if (inDays) d.setDate(d.getDate() + Number(inDays[1]))
  else if (/next week/.test(q)) d.setDate(d.getDate() + 7)
  else if (/day after tomorrow/.test(q)) d.setDate(d.getDate() + 2)
  else if (wd >= 0) d.setDate(d.getDate() + (((wd - d.getDay() + 7) % 7) || 7))
  else d.setDate(d.getDate() + 1)
  d.setHours(11, 0, 0, 0)
  return d.toISOString()
}
const pickOne = (found: Lead[], what: string): Reply | undefined =>
  found.length === 0 ? { text: `Tell me which lead. For example: **${what}**. I could not find a lead with that name or phone number.` }
  : found.length > 1 ? { text: `${found.length} leads match that name. Use the full name so I pick the right one:`, links: found.slice(0, 8).map(l => leadLink(l, l.phone)) }
  : undefined

export function answer(input: string): Reply {
  const st = useStore.getState()
  const q = input.toLowerCase().trim()
  const me = st.users.find(u => u.id === st.currentUserId) ?? st.users[0]
  const stageOf = (id: string) => st.stages.find(s => s.id === id)
  const isOpen = (l: Lead) => { const s = stageOf(l.stageId); return !s?.isWon && !s?.isLost }
  const ownerName = (id?: string) => st.users.find(u => u.id === id)?.name ?? 'Unassigned'
  const now = Date.now()
  if (!q) return { text: HELP }

  // 1. Proposals — nothing changes until the user presses Approve.
  if (/\b(task|reminder|remind)\b/.test(q) && /\b(create|add|make|set|new|remind|schedule)\b/.test(q)) {
    const found = leadsIn(q, st.leads)
    const stop = pickOne(found, 'create a task to call Rohan Mehta tomorrow')
    if (stop) return stop
    const lead = found[0]
    const m = input.match(/(?:task|reminder|remind me)\s+(?:to|for)\s+(.+)/i)
    let title = (m?.[1] ?? '').replace(/\b(day after tomorrow|tomorrow|today|now|next week|in \d+ days?|on )\b/gi, '').replace(/\b(on\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, '').replace(/\s+/g, ' ').replace(/[.?!\s]+$/, '').trim()
    const first = lead.name.split(' ')[0]
    if (title && !title.toLowerCase().includes(lead.name.toLowerCase())) title = title.replace(new RegExp(`\\b${first}\\b`, 'i'), lead.name)
    if (title.length < 3) title = `Follow up with ${lead.name}`
    title = title[0].toUpperCase() + title.slice(1)
    const types = st.settings.taskTypes
    const type = (/^call\b/i.test(title) && types.find(t => /call/i.test(t))) || (/survey/i.test(title) && types.find(t => /survey/i.test(t))) || (/pay/i.test(title) && types.find(t => /pay/i.test(t))) || types[0] || 'Follow up'
    const dueAt = dueFrom(q)
    return { text: `I can create this task. Please check it and approve.`, proposal: { kind: 'task', leadId: lead.id, leadName: lead.name, title, dueAt, type } }
  }
  if (/\b(move|shift|change|mark|set|update)\b/.test(q) && /\s(to|as|into)\s/.test(q) && !/\btask\b/.test(q)) {
    const stage = stageIn(q, st.stages)
    const found = leadsIn(q.split(/\s(?:to|as|into)\s/)[0], st.leads)
    if (stage || found.length) {
      const stop = pickOne(found, 'move Rohan Mehta to Contacted')
      if (stop) return stop
      const lead = found[0]
      if (!stage) return { text: `Which stage should **${lead.name}** move to? Your stages are: ${[...st.stages].sort((a, b) => a.order - b.order).map(s => s.label).join(', ')}.` }
      if (lead.stageId === stage.id) return { text: `**${lead.name}** is already in “${stage.label}”.`, links: [leadLink(lead)] }
      return { text: 'I can make this change. Please check it and approve.', proposal: { kind: 'stage', leadId: lead.id, leadName: lead.name, stageId: stage.id, stageLabel: stage.label, fromLabel: stageOf(lead.stageId)?.label ?? 'no stage' } }
    }
  }

  // 2. Draft a follow-up message
  if (/\b(draft|write|compose)\b/.test(q) || /\bmessage (for|to)\b/.test(q)) {
    let found = leadsIn(q.replace(/\b(draft|write|compose|follow|message|email|whatsapp|mail|for|the)\b/g, ' '), st.leads)
    let picked = ''
    if (found.length > 1) return pickOne(found, '')!
    if (!found.length) {
      const due = st.leads.filter(l => isOpen(l) && l.nextFollowUpAt).sort((a, b) => +new Date(a.nextFollowUpAt!) - +new Date(b.nextFollowUpAt!))
      const best = due.find(l => l.ownerId === me.id) ?? due[0]
      if (!best) return { text: 'There is no open lead with a follow-up date. Tell me who it is for, e.g. **draft a follow-up message for Rohan Mehta**.' }
      found = [best]; picked = `You did not name a lead, so I picked **${best.name}**, whose follow-up is due ${friendlyDay(best.nextFollowUpAt!)}. Say “draft a message for <name>” for someone else.\n\n`
    }
    const l = found[0]
    const first = l.name.split(' ')[0]
    const route = l.moveFrom && l.moveTo ? ` from ${l.moveFrom} to ${l.moveTo}` : l.moveFrom ? ` from ${l.moveFrom}` : ''
    const size = l.homeSize ? `${l.homeSize} ` : ''
    const date = l.moveDate ? ` planned for ${fmtDate(l.moveDate)}` : ''
    const stage = stageOf(l.stageId)?.label.toLowerCase() ?? ''
    const ask = /quot/.test(stage) ? 'Did you get a chance to go through the quotation we shared? I am happy to explain any item or adjust it to your budget.'
      : /survey/.test(stage) ? 'Our survey is complete and your quotation is being prepared. Is there anything else you would like us to include?'
      : /confirm|book/.test(stage) ? 'Your booking is confirmed. Please let us know if the date or the item list has changed so that we can plan the vehicle and team.'
      : 'Could you confirm the shifting date and the main items to be moved, so that we can share an exact quotation? We can also arrange a free home survey.'
    const biz = st.settings.businessName
    if (/\b(e-?mail|mail)\b/.test(q)) {
      const body = `Subject: Your ${size}shifting${route}\n\nDear ${first},\n\nThank you for your enquiry with ${biz}. I am following up on your ${size}move${route}${date}.\n\n${ask}\n\nYou can reply to this email or call us on ${st.settings.businessPhone}.\n\nRegards,\n${me.name}\n${biz}`
      return { text: `${picked}Email draft for **${l.name}**${l.email ? ` (${l.email})` : ' (no email saved on this lead)'}. It is filled in from the lead’s details, not written by AI. Nothing has been sent.`, copy: body, links: [leadLink(l, 'open lead')] }
    }
    const body = `Namaste ${first}, this is ${me.name} from ${biz}. Following up on your ${size}move${route}${date}. ${ask} Thank you!`
    return { text: `${picked}WhatsApp draft for **${l.name}** (${l.phone}). It is filled in from the lead’s details, not written by AI. Nothing has been sent.`, copy: body, links: [leadLink(l, 'open lead')] }
  }

  // 3. Find a lead
  const findM = q.match(/^(?:find|search|search for|look ?up|show|open|who is|details of|details for|lead)\s+(.+)/)
  if (findM && !/\b(new leads?|overdue|pipeline|today|invoice|source|revenue)\b/.test(q)) {
    const term = findM[1].replace(/\b(lead|leads|named|called|the|with|phone|number|name|for)\b/g, ' ').replace(/[?.!]/g, '').replace(/\s+/g, ' ').trim()
    const digits = term.replace(/\D/g, '')
    const found = st.leads.filter(l => (term.length >= 2 && l.name.toLowerCase().includes(term)) || (digits.length >= 4 && l.phone.replace(/\D/g, '').includes(digits)))
    if (!term) return { text: 'Who should I look for? Try **find Rohan** or **find 98765**.' }
    if (!found.length) return { text: `No lead matches “${term}”. Check the spelling, or try part of the phone number.` }
    if (found.length === 1) {
      const l = found[0]
      return {
        text: `**${l.name}** (#${l.no})\nPhone: ${l.phone}\nStage: ${stageOf(l.stageId)?.label ?? '—'}\nOwner: ${ownerName(l.ownerId)}\nValue: ${inr(l.value)}${l.moveFrom ? `\nMove: ${l.homeSize ? l.homeSize + ', ' : ''}${l.moveFrom}${l.moveTo ? ' to ' + l.moveTo : ''}${l.moveDate ? ' on ' + fmtDate(l.moveDate) : ''}` : ''}\nNext follow-up: ${l.nextFollowUpAt ? friendlyDay(l.nextFollowUpAt) : 'not set'}`,
        links: [leadLink(l, 'open lead')],
      }
    }
    return { text: `${plural(found.length, 'lead')} match “${term}”${found.length > 8 ? ' (showing 8)' : ''}:`, links: found.slice(0, 8).map(l => leadLink(l, `${l.phone} · ${stageOf(l.stageId)?.label ?? ''}`)) }
  }

  // 4. New leads today
  if (/new (leads?|enquir)|leads? (created |added |received )?today|today'?s (new )?(leads?|enquir)/.test(q)) {
    const from = startOfToday().getTime()
    const list = st.leads.filter(l => +new Date(l.createdAt) >= from).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    if (!list.length) return { text: 'No new leads have come in today yet.' }
    return { text: `**${plural(list.length, 'new lead')}** today${list.length > 10 ? ' (showing the latest 10)' : ''}:`, links: list.slice(0, 10).map(l => leadLink(l, `${st.sources.find(s => s.id === l.sourceId)?.label ?? 'Unknown source'} · ${ownerName(l.ownerId)}`)) }
  }

  // 5. Overdue tasks
  if (/overdue|late\b|missed|pending tasks?|past due/.test(q)) {
    const tasks = st.tasks.filter(t => t.status === 'pending' && +new Date(t.dueAt) < now).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt))
    const mine = tasks.filter(t => t.assigneeId === me.id)
    const missed = st.leads.filter(l => isOpen(l) && l.nextFollowUpAt && +new Date(l.nextFollowUpAt) < startOfToday().getTime()).length
    if (!tasks.length) return { text: `No tasks are overdue. ${missed ? `${plural(missed, 'lead')} still ${missed === 1 ? 'has' : 'have'} a follow-up date before today.` : 'No follow-ups are overdue either.'}` }
    const show = (mine.length ? mine : tasks).slice(0, 8)
    return {
      text: `**${plural(tasks.length, 'task')}** ${tasks.length === 1 ? 'is' : 'are'} overdue across the team; ${mine.length} assigned to you.${missed ? ` ${plural(missed, 'lead')} also ${missed === 1 ? 'has' : 'have'} a follow-up date before today.` : ''}\n${mine.length ? 'Yours' : 'Oldest'} first:`,
      links: [...show.map(t => ({ label: `${t.title} · due ${friendlyDay(t.dueAt)} · ${ownerName(t.assigneeId)}`, to: t.leadId ? `/leads/${t.leadId}` : '/tasks' })), { label: 'Open all tasks', to: '/tasks' }],
    }
  }

  // 6. Leads to contact today
  if (/contact|follow.?ups?|call today|who should i|whom should i|reach out|to call/.test(q)) {
    const end = endOfToday().getTime()
    const due = st.leads.filter(l => isOpen(l) && !l.doNotCall && l.nextFollowUpAt && +new Date(l.nextFollowUpAt) <= end).sort((a, b) => +new Date(a.nextFollowUpAt!) - +new Date(b.nextFollowUpAt!))
    const mine = due.filter(l => l.ownerId === me.id)
    const team = !mine.length && me.role !== 'sales'
    const list = team ? due : mine
    if (!list.length) return { text: `No follow-ups are due today or overdue for you${me.role === 'sales' ? '' : ' or the team'}.` }
    const od = list.filter(l => +new Date(l.nextFollowUpAt!) < now).length
    return {
      text: `${team ? `No leads are assigned to you, ${me.name.split(' ')[0]}, so here is the whole team. ` : ''}**${plural(list.length, 'lead')}** to contact today, ${od} already overdue${list.length > 10 ? ' (showing the 10 most urgent)' : ''}:`,
      links: list.slice(0, 10).map(l => leadLink(l, `${friendlyDay(l.nextFollowUpAt!)}${team ? ' · ' + ownerName(l.ownerId) : ''}`)),
    }
  }

  // 7. Revenue and invoices
  if (/revenue|invoice|outstanding|payment|unpaid|collect|balance|receivable|money/.test(q)) {
    const live = st.invoices.filter(i => i.status !== 'draft' && i.status !== 'cancelled')
    const rows = live.map(i => ({ i, total: docTotals(i).total, paid: invoicePaid(i, st.payments) }))
    const billed = rows.reduce((s, r) => s + r.total, 0)
    const received = rows.reduce((s, r) => s + r.paid, 0)
    const unpaid = rows.filter(r => r.total - r.paid > 0.5).sort((a, b) => (b.total - b.paid) - (a.total - a.paid))
    if (!live.length) return { text: 'No invoices have been issued yet.', links: [{ label: 'Open invoices', to: '/billing/invoices' }] }
    return {
      text: `Across ${plural(live.length, 'issued invoice')}:\nBilled: **${inr(billed)}**\nReceived: **${inr(received)}**\nOutstanding: **${inr(billed - received)}** on ${plural(unpaid.length, 'invoice')}${unpaid.length ? '\nLargest balances:' : ''}`,
      links: [...unpaid.slice(0, 6).map(r => ({ label: `${r.i.number} · ${r.i.customerName} · ${inr(r.total - r.paid)} due${r.i.dueDate && +new Date(r.i.dueDate) < now ? ' · past due date' : ''}`, to: `/billing/invoices/${r.i.id}` })), { label: 'Open all invoices', to: '/billing/invoices' }],
    }
  }

  // 8. Top sources
  if (/sources?\b|where .*(come|from)|channel/.test(q)) {
    const rows = st.sources.map(s => {
      const ls = st.leads.filter(l => l.sourceId === s.id)
      return { label: s.label, n: ls.length, won: ls.filter(l => stageOf(l.stageId)?.isWon).length }
    }).filter(r => r.n).sort((a, b) => b.n - a.n)
    if (!rows.length) return { text: 'There are no leads yet, so there is nothing to compare.' }
    return { text: `Leads by source (${st.leads.length} in total):\n` + rows.map((r, i) => `${i + 1}. **${r.label}** – ${plural(r.n, 'lead')} (${Math.round((r.n / st.leads.length) * 100)}%), ${r.won} won`).join('\n'), links: [{ label: 'Open lead reports', to: '/reports/leads' }] }
  }

  // 9. Pipeline summary
  if (/pipeline|summar|stages?\b|funnel|overview|how many leads/.test(q)) {
    const stages = [...st.stages].sort((a, b) => a.order - b.order)
    const lines = stages.map(s => { const ls = st.leads.filter(l => l.stageId === s.id); return `• **${s.label}** – ${plural(ls.length, 'lead')}, ${inr(ls.reduce((t, l) => t + l.value, 0))}` })
    const open = st.leads.filter(isOpen)
    const won = st.leads.filter(l => stageOf(l.stageId)?.isWon)
    return {
      text: `Pipeline for the whole team: **${plural(st.leads.length, 'lead')}**.\n${lines.join('\n')}\n\nOpen: ${plural(open.length, 'lead')} worth **${inr(open.reduce((t, l) => t + l.value, 0))}**\nWon: ${plural(won.length, 'lead')} worth **${inr(won.reduce((t, l) => t + l.value, 0))}**`,
      links: [{ label: 'Open leads', to: '/leads' }],
    }
  }

  // A bare name or number: treat as a search.
  const loose = leadsIn(q, st.leads)
  if (loose.length && q.split(' ').length <= 3) return answer('find ' + q)

  return { text: `I did not understand that. I answer from your CRM data using fixed rules, so please word it like one of these.\n\n${HELP}` }
}

/** Runs an approved proposal against the store and says what happened. */
export function applyProposal(p: Proposal): string {
  const st = useStore.getState()
  const lead = st.leads.find(l => l.id === p.leadId)
  if (!lead) return 'That lead no longer exists, so nothing was changed.'
  if (p.kind === 'task') {
    st.add('tasks', { title: p.title, type: p.type, leadId: lead.id, assigneeId: lead.ownerId ?? st.currentUserId, dueAt: p.dueAt, status: 'pending', priority: 'medium', createdBy: 'user', createdAt: new Date().toISOString() })
    st.log('task', `Task created: ${p.title} (due ${friendlyDay(p.dueAt)})`, lead.id)
    return `Done. Task **${p.title}** is on the Tasks page, due ${friendlyDay(p.dueAt)}, assigned to ${st.users.find(u => u.id === (lead.ownerId ?? st.currentUserId))?.name ?? 'you'}.`
  }
  const stage = st.stages.find(s => s.id === p.stageId)
  if (!stage) return 'That stage no longer exists, so nothing was changed.'
  st.setLeadStage(lead.id, stage.id)
  return `Done. **${lead.name}** is now in “${stage.label}”.${stage.isLost ? ' Open the lead to record why it was lost.' : ''}`
}
