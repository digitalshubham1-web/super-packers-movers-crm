import type { DB, Lead, Settings, Task, Activity, Call, Conversation, WaMessage, Invoice, Quotation, LineItem } from './types'

// Deterministic pseudo-random so the sample data is stable between resets.
let s = 42
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296)
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
const ago = (days: number, hours = 0) => new Date(Date.now() - days * 864e5 - hours * 36e5).toISOString()
const ahead = (days: number, hour = 11) => { const d = new Date(Date.now() + days * 864e5); d.setHours(hour, 0, 0, 0); return d.toISOString() }

const FIRST = ['Aarav', 'Vivaan', 'Ishita', 'Kavya', 'Rohan', 'Meera', 'Arjun', 'Sneha', 'Kabir', 'Ananya', 'Dev', 'Pooja', 'Nikhil', 'Ritu', 'Sahil', 'Tanvi', 'Manish', 'Neha', 'Yash', 'Divya', 'Harsh', 'Simran', 'Varun', 'Aditi']
const LAST = ['Verma', 'Mehta', 'Nair', 'Chauhan', 'Bansal', 'Iyer', 'Kapoor', 'Saxena', 'Reddy', 'Joshi', 'Malhotra', 'Pandey', 'Gill', 'Bhatt', 'Arora', 'Mishra']
const CITIES = ['Gurugram', 'Noida', 'New Delhi', 'Faridabad', 'Ghaziabad', 'Jaipur', 'Chandigarh', 'Lucknow', 'Pune', 'Bengaluru', 'Mumbai', 'Hyderabad']
const SIZES = ['1 BHK', '2 BHK', '3 BHK', 'Villa', 'Office', 'Few items', 'Vehicle only']

export function buildSeed(): { db: DB; settings: Settings } {
  s = 42
  const users: DB['users'] = [
    { id: 'u1', name: 'Suresh Kumar', email: 'owner@superpackers.example', phone: '9810000001', role: 'admin', active: true, available: true, joinedAt: ago(240), color: '#ea580c' },
    { id: 'u2', name: 'Priya Rawat', email: 'priya@superpackers.example', phone: '9810000002', role: 'manager', active: true, available: true, reportsTo: 'u1', joinedAt: ago(180), color: '#0891b2' },
    { id: 'u3', name: 'Amit Tomar', email: 'amit@superpackers.example', phone: '9810000003', role: 'sales', active: true, available: true, reportsTo: 'u2', joinedAt: ago(120), color: '#7c3aed' },
    { id: 'u4', name: 'Farah Khan', email: 'farah@superpackers.example', phone: '9810000004', role: 'sales', active: true, available: false, reportsTo: 'u2', joinedAt: ago(60), color: '#16a34a' },
  ]
  const stages: DB['stages'] = [
    { id: 'st_new', label: 'New enquiry', color: '#0ea5e9', order: 0, isInitial: true },
    { id: 'st_contact', label: 'Contacted', color: '#8b5cf6', order: 1 },
    { id: 'st_survey', label: 'Survey done', color: '#f59e0b', order: 2 },
    { id: 'st_quote', label: 'Quotation sent', color: '#f97316', order: 3 },
    { id: 'st_confirm', label: 'Booking confirmed', color: '#14b8a6', order: 4 },
    { id: 'st_won', label: 'Shifting done', color: '#16a34a', order: 5, isWon: true },
    { id: 'st_lost', label: 'Lost', color: '#ef4444', order: 6, isLost: true },
  ]
  const sources: DB['sources'] = [
    { id: 'src_wa', label: 'WhatsApp', color: '#16a34a' }, { id: 'src_fb', label: 'Facebook Ads', color: '#2563eb' },
    { id: 'src_google', label: 'Google Ads', color: '#f59e0b' }, { id: 'src_web', label: 'Website', color: '#7c3aed' },
    { id: 'src_ref', label: 'Referral', color: '#db2777' }, { id: 'src_jd', label: 'JustDial', color: '#0891b2' },
    { id: 'src_call', label: 'Phone call', color: '#64748b' },
  ]
  const lostReasons: DB['lostReasons'] = [
    { id: 'lr_price', label: 'Price too high' }, { id: 'lr_comp', label: 'Chose a competitor' },
    { id: 'lr_plan', label: 'Plan cancelled' }, { id: 'lr_noresp', label: 'No response' }, { id: 'lr_fake', label: 'Not a real enquiry' },
  ]
  const customFields: DB['customFields'] = [
    { id: 'cf_floor', label: 'Pickup floor', type: 'text', active: true },
    { id: 'cf_lift', label: 'Lift available', type: 'yesno', active: true },
    { id: 'cf_vehicle', label: 'Vehicle shifting', type: 'dropdown', options: ['None', 'Bike', 'Car', 'Both'], active: true },
  ]

  const openStages = ['st_new', 'st_new', 'st_contact', 'st_contact', 'st_survey', 'st_quote', 'st_quote', 'st_confirm', 'st_won', 'st_lost']
  const leads: Lead[] = []
  const activities: Activity[] = []
  for (let i = 0; i < 48; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`
    const stageId = pick(openStages)
    const created = ago(i < 6 ? 0 : int(1, 45), int(0, 20))
    const from = pick(CITIES); let to = pick(CITIES); if (to === from) to = pick(CITIES)
    const owner = pick(['u2', 'u3', 'u3', 'u4', 'u4'])
    const src = pick(['src_wa', 'src_wa', 'src_wa', 'src_fb', 'src_fb', 'src_google', 'src_web', 'src_ref', 'src_jd', 'src_call'])
    const size = pick(SIZES)
    const value = stageId === 'st_new' ? 0 : int(6, 60) * 1000
    const lead: Lead = {
      id: 'l' + (i + 1), no: 1001 + (47 - i), name, phone: '9' + int(100000000, 999999999), email: rnd() > 0.5 ? name.toLowerCase().replace(' ', '.') + '@mail.example' : undefined,
      city: from, stageId, sourceId: src, ownerId: owner, rating: int(1, 5), value, tags: rnd() > 0.7 ? [pick(['urgent', 'corporate', 'repeat', 'insurance'])] : [],
      moveFrom: from, moveTo: to, moveDate: ahead(int(2, 30)).slice(0, 10), homeSize: size,
      nextFollowUpAt: ['st_won', 'st_lost'].includes(stageId) ? undefined : ahead(int(-2, 5), int(10, 17)),
      lostReasonId: stageId === 'st_lost' ? pick(lostReasons).id : undefined,
      custom: { cf_floor: pick(['Ground', '1st', '2nd', '3rd', '5th']), cf_lift: rnd() > 0.5, cf_vehicle: pick(['None', 'Bike', 'Car']) },
      createdAt: created, updatedAt: created,
    }
    leads.push(lead)
    activities.push({ id: 'a' + i + 'a', leadId: lead.id, type: 'system', text: `Lead created from ${sources.find(x => x.id === src)!.label}`, at: created })
    activities.push({ id: 'a' + i + 'b', leadId: lead.id, type: 'owner', text: `Assigned to ${users.find(u => u.id === owner)!.name}`, at: created })
    if (stageId !== 'st_new') activities.push({ id: 'a' + i + 'c', leadId: lead.id, type: 'call', text: `Called the customer. ${size} move from ${from} to ${to}.`, userId: owner, at: ago(0, int(1, 30)) })
    if (['st_quote', 'st_confirm', 'st_won'].includes(stageId)) activities.push({ id: 'a' + i + 'd', leadId: lead.id, type: 'quotation', text: `Quotation shared on WhatsApp`, userId: owner, at: ago(0, int(1, 20)) })
  }
  leads.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).forEach((l, i) => (l.no = 1000 + leads.length - i))

  const active = leads.filter(l => !['st_won', 'st_lost'].includes(l.stageId))
  const tasks: Task[] = active.slice(0, 22).map((l, i): Task => ({
    id: 't' + i, title: pick(['Call back for confirmation', 'Send quotation', 'Schedule home survey', 'Follow up on quotation', 'Collect advance payment']),
    description: `${l.homeSize} move, ${l.moveFrom} to ${l.moveTo}.`, type: 'Follow up', leadId: l.id, assigneeId: l.ownerId!, dueAt: ahead(int(-4, 6), int(10, 17)),
    status: i % 7 === 0 ? 'done' : 'pending', priority: pick(['low', 'medium', 'medium', 'high', 'urgent']), reminderMin: 10,
    createdBy: i % 5 === 0 ? 'ai' : i % 4 === 0 ? 'automation' : 'user', createdAt: ago(int(1, 6)),
  }))

  const calls: Call[] = leads.slice(0, 30).map((l, i): Call => ({
    id: 'c' + i, leadId: l.id, name: l.name, phone: l.phone, userId: l.ownerId, byAi: i % 9 === 0,
    direction: i % 4 === 0 ? 'incoming' : 'outgoing', outcome: pick(['connected', 'connected', 'connected', 'no_answer', 'missed', 'busy']),
    durationSec: int(20, 420), at: ago(int(0, 6), int(0, 20)), summary: 'Discussed the move date, item list and floor details. Customer asked for a written quotation.',
  })).map(c => (c.outcome === 'connected' ? c : { ...c, durationSec: 0, summary: undefined }))

  const conversations: Conversation[] = leads.slice(0, 14).map((l, i) => ({
    id: 'cv' + i, leadId: l.id, name: l.name, phone: l.phone, ownerId: l.ownerId,
    status: i % 6 === 0 ? 'requesting' : i % 4 === 0 ? 'intervened' : 'active', unread: i < 5 ? int(1, 3) : 0,
    lastMessage: 'Please share the quotation.', lastAt: ago(0, i * 2 + 1), botPaused: i % 4 === 0,
  }))
  const messages: WaMessage[] = conversations.flatMap((c, i) => {
    const l = leads.find(x => x.id === c.leadId)!
    const base = i * 2 + 1
    return [
      { id: c.id + 'm1', conversationId: c.id, from: 'customer' as const, text: 'Hello, I need packers and movers service.', at: ago(0, base + 0.5) },
      { id: c.id + 'm2', conversationId: c.id, from: 'bot' as const, text: 'Namaste! Welcome to Super Packers and Movers. Please share your pickup city, drop city and shifting date.', at: ago(0, base + 0.45), status: 'read' as const },
      { id: c.id + 'm3', conversationId: c.id, from: 'customer' as const, text: `${l.moveFrom} to ${l.moveTo}, ${l.homeSize}. Date around ${l.moveDate}.`, at: ago(0, base + 0.3) },
      { id: c.id + 'm4', conversationId: c.id, from: 'bot' as const, text: 'Thank you. Our team will check the details and send you a quotation shortly.', at: ago(0, base + 0.25), status: 'read' as const },
      { id: c.id + 'm5', conversationId: c.id, from: 'customer' as const, text: 'Please share the quotation.', at: ago(0, base) },
    ]
  })

  const items: DB['items'] = [
    { id: 'it1', name: 'Home shifting - 1 BHK (local)', sku: 'HS-1BHK', kind: 'service', category: 'Home shifting', unit: 'job', price: 8500, taxPercent: 18, active: true },
    { id: 'it2', name: 'Home shifting - 2 BHK (local)', sku: 'HS-2BHK', kind: 'service', category: 'Home shifting', unit: 'job', price: 14000, taxPercent: 18, active: true },
    { id: 'it3', name: 'Home shifting - 3 BHK (local)', sku: 'HS-3BHK', kind: 'service', category: 'Home shifting', unit: 'job', price: 21000, taxPercent: 18, active: true },
    { id: 'it4', name: 'Car transport (intercity)', sku: 'CAR-IC', kind: 'service', category: 'Vehicle', unit: 'vehicle', price: 9000, taxPercent: 18, active: true },
    { id: 'it5', name: 'Bike transport (intercity)', sku: 'BIKE-IC', kind: 'service', category: 'Vehicle', unit: 'vehicle', price: 3500, taxPercent: 18, active: true },
    { id: 'it6', name: 'Packing carton (large)', sku: 'BOX-L', kind: 'goods', category: 'Packing material', unit: 'pc', price: 90, taxPercent: 12, stock: 420, active: true },
    { id: 'it7', name: 'Bubble wrap roll', sku: 'BW-50', kind: 'goods', category: 'Packing material', unit: 'roll', price: 650, taxPercent: 12, stock: 38, active: true },
    { id: 'it8', name: 'Transit insurance', sku: 'INS', kind: 'service', category: 'Add-ons', unit: 'job', price: 1500, taxPercent: 18, active: true },
  ]
  const mkLines = (n: number): LineItem[] => Array.from({ length: n }, (_, k) => { const it = items[(k * 3 + n) % items.length]; return { id: 'ln' + k + n, itemId: it.id, description: it.name, qty: it.kind === 'goods' ? int(5, 20) : 1, rate: it.price, taxPercent: it.taxPercent } })
  const quoted = leads.filter(l => ['st_quote', 'st_confirm', 'st_won'].includes(l.stageId)).slice(0, 8)
  const quotations: Quotation[] = quoted.map((l, i) => ({
    id: 'q' + i, number: `QT-${String(i + 1).padStart(4, '0')}`, leadId: l.id, customerName: l.name, customerPhone: l.phone, lines: mkLines(2 + (i % 2)), discount: i % 3 === 0 ? 500 : 0,
    status: l.stageId === 'st_quote' ? 'sent' : 'accepted', issueDate: ago(int(2, 12)), validUntil: ahead(10), createdAt: ago(int(2, 12)),
  }))
  const invoiced = leads.filter(l => ['st_confirm', 'st_won'].includes(l.stageId)).slice(0, 6)
  const invoices: Invoice[] = invoiced.map((l, i) => ({
    id: 'inv' + i, number: `INV-${String(i + 1).padStart(4, '0')}`, leadId: l.id, customerName: l.name, customerPhone: l.phone, customerAddress: `${l.moveFrom}`,
    lines: mkLines(2 + (i % 2)), discount: 0, status: i % 3 === 0 ? 'paid' : i % 3 === 1 ? 'partial' : 'issued', issueDate: ago(int(1, 20)), dueDate: ahead(int(-3, 10)), createdAt: ago(int(1, 20)),
  }))
  const payments: DB['payments'] = invoices.flatMap((inv, i): DB['payments'] => {
    const total = inv.lines.reduce((t, l) => t + l.qty * l.rate * (1 + l.taxPercent / 100), 0)
    if (inv.status === 'paid') return [{ id: 'p' + i, invoiceId: inv.id, amount: Math.round(total), mode: 'upi' as const, reference: 'UPI' + int(10000, 99999), at: ago(int(0, 5)) }]
    if (inv.status === 'partial') return [{ id: 'p' + i, invoiceId: inv.id, amount: Math.round(total * 0.4), mode: 'cash' as const, at: ago(int(0, 5)) }]
    return []
  })

  const db: DB = {
    leads, activities, tasks, users, stages, sources, lostReasons, customFields, items, quotations, invoices, payments, calls, conversations, messages,
    events: [
      { id: 'e1', title: 'Home survey - DLF Phase 3', start: ahead(1, 11), end: ahead(1, 12), userId: 'u3', leadId: leads[2].id },
      { id: 'e2', title: 'Team stand-up', start: ahead(0, 10), end: ahead(0, 10), userId: 'u1' },
      { id: 'e3', title: 'Loading day - 3 BHK to Pune', start: ahead(3, 8), end: ahead(3, 14), userId: 'u4', leadId: leads[5].id },
    ],
    automations: [
      { id: 'au1', name: 'Share new leads across the team', trigger: 'new_lead', delayMin: 0, action: 'assign', actionConfig: { mode: 'round_robin' }, active: true, runs: 212, createdAt: ago(60) },
      { id: 'au2', name: 'WhatsApp welcome message', trigger: 'new_lead', delayMin: 0, action: 'whatsapp', actionConfig: { templateId: 'tp1' }, active: true, runs: 198, createdAt: ago(60) },
      { id: 'au3', name: 'Follow-up task after one day', trigger: 'new_lead', delayMin: 1440, action: 'task', actionConfig: { title: 'Follow up with new lead', priority: 'medium' }, active: false, runs: 0, createdAt: ago(20) },
    ],
    templates: [
      { id: 'tp1', name: 'welcome_enquiry', category: 'UTILITY', language: 'English', body: 'Hi {{1}}, thank you for contacting Super Packers and Movers. Please share your pickup city, drop city and shifting date so we can send a quotation.', status: 'approved', createdAt: ago(50), updatedAt: ago(30), lastUsedAt: ago(0, 2) },
      { id: 'tp2', name: 'quotation_follow_up', category: 'MARKETING', language: 'English', body: 'Hi {{1}}, we shared your shifting quotation. Would you like to confirm the booking for {{2}}?', status: 'approved', createdAt: ago(40), updatedAt: ago(22) },
      { id: 'tp3', name: 'feedback_request', category: 'MARKETING', language: 'English', body: 'Hi {{1}}, we hope your move went smoothly. Could you rate our service? Your feedback helps us improve.', status: 'pending', createdAt: ago(3), updatedAt: ago(3) },
      { id: 'tp4', name: 'payment_reminder', category: 'UTILITY', language: 'Hindi', body: 'Namaste {{1}}, aapke invoice {{2}} ka balance {{3}} baaki hai. Kripya payment complete karein.', status: 'approved', createdAt: ago(25), updatedAt: ago(25) },
    ],
    botFlows: [
      { id: 'bf1', name: 'Main enquiry bot', trigger: 'First message', steps: [
        { id: 's1', kind: 'Text + Buttons', label: 'Welcome', text: 'Namaste! What do you need help with?', options: ['Home shifting', 'Office shifting', 'Vehicle transport'] },
        { id: 's2', kind: 'Ask a question', label: 'Pickup city', text: 'Which city are you moving from?' },
        { id: 's3', kind: 'Ask a question', label: 'Drop city', text: 'Which city are you moving to?' },
        { id: 's4', kind: 'Ask a question', label: 'Shifting date', text: 'When do you plan to shift?' },
        { id: 's5', kind: 'Create Lead', label: 'Save as lead' },
        { id: 's6', kind: 'Assign Agent', label: 'Hand over to team' },
      ], active: true, runs: 119, updatedAt: ago(1) },
      { id: 'bf2', name: 'Quotation keyword', trigger: 'Keyword Match', keywords: ['quote', 'price', 'rate'], steps: [
        { id: 's1', kind: 'Text Message', label: 'Reply', text: 'Our team will share your quotation within 30 minutes.' },
        { id: 's2', kind: 'Request Intervention', label: 'Alert the team' },
      ], active: false, runs: 53, updatedAt: ago(5) },
    ],
    waCampaigns: [
      { id: 'wc1', name: 'Diwali offer - old customers', templateId: 'tp2', audience: 'Stage: Shifting done', recipients: 180, sent: 180, delivered: 171, read: 122, replied: 19, status: 'completed', createdAt: ago(18) },
      { id: 'wc2', name: 'Quotation reminder', templateId: 'tp2', audience: 'Stage: Quotation sent', recipients: 42, sent: 0, delivered: 0, read: 0, replied: 0, status: 'scheduled', scheduledAt: ahead(1, 10), createdAt: ago(1) },
    ],
    cannedMessages: [
      { id: 'cm1', shortcut: '/details', text: 'Please share pickup address, drop address, shifting date and the list of items.' },
      { id: 'cm2', shortcut: '/survey', text: 'We can do a free home survey. Which day and time suits you?' },
      { id: 'cm3', shortcut: '/thanks', text: 'Thank you for choosing Super Packers and Movers!' },
    ],
    aiAgents: [{
      id: 'ai1', name: 'Disha - WhatsApp assistant', channel: 'whatsapp', actAsUserId: 'u1', contextMessages: 20, replyDelaySec: 5, active: true, repliesSent: 301, failed: 3,
      instructions: 'You are Disha, the moving assistant of Super Packers and Movers. Greet the customer, collect pickup city, drop city, shifting date, home size, floor and lift details. Never quote a price; the team sends the quotation. Hand over to a human when the customer asks for one.',
      tools: { read_lead: true, update_lead: true, update_stage: true, add_note: true, create_lead: true, create_task: true, set_reminder: true, list_files: true, send_file: true, check_calendar: false, schedule_meeting: false },
      files: [{ id: 'f1', name: 'Company profile.pdf', sent: 134 }],
    }],
    voiceAgents: [{
      id: 'va1', name: 'New lead caller', direction: 'outbound', voice: 'Asha (female, warm)', language: 'Hinglish', greeting: 'Namaste, main Super Packers and Movers se bol rahi hoon.',
      prompt: 'Call new enquiries, confirm the pickup and drop cities, shifting date and home size, then tell them a team member will share the quotation.',
      hoursStart: '09:30', hoursEnd: '19:00', dailyLimit: 150, maxCallSec: 240, recordCalls: true, active: false,
    }],
    callCampaigns: [
      { id: 'cc1', name: 'Quotation follow-ups', kind: 'team', callerIds: ['u3', 'u4'], leadIds: leads.filter(l => l.stageId === 'st_quote').map(l => l.id), doneLeadIds: [], status: 'active', createdAt: ago(1) },
    ],
    emails: [
      { id: 'em1', folder: 'inbox', from: 'facility@corporate.example', to: 'owner@superpackers.example', subject: 'Office relocation enquiry - 40 workstations', body: 'Hello,\n\nWe are relocating our office from Udyog Vihar to Cyber City next month. Please share your availability for a site survey.\n\nRegards,\nFacility team', at: ago(0, 3), read: false },
      { id: 'em2', folder: 'inbox', from: leads[1].email ?? 'customer@mail.example', to: 'owner@superpackers.example', subject: 'Re: Your shifting quotation', body: 'Thanks for the quotation. Can you include car transport as well?', at: ago(1), read: true, leadId: leads[1].id },
      { id: 'em3', folder: 'sent', from: 'owner@superpackers.example', to: leads[1].email ?? 'customer@mail.example', subject: 'Your shifting quotation', body: 'Dear customer,\n\nPlease find your quotation attached.\n\nTeam Super Packers and Movers', at: ago(2), read: true, leadId: leads[1].id },
    ],
    emailTemplates: [
      { id: 'et1', name: 'Welcome email', subject: 'Thanks for contacting Super Packers and Movers', body: 'Hi {{name}},\n\nThank you for your enquiry. Our team will call you shortly to understand your requirement.\n\nRegards,\nSuper Packers and Movers' },
      { id: 'et2', name: 'Quotation follow-up', subject: 'Your shifting quotation', body: 'Hi {{name}},\n\nJust checking if you had a chance to review the quotation we shared.\n\nRegards,\nSuper Packers and Movers' },
    ],
    integrations: [
      { id: 'in_wa', name: 'WhatsApp Business API', category: 'Messaging', description: 'Send and receive WhatsApp messages, templates and campaigns from your business number.', connected: false, config: {} },
      { id: 'in_web', name: 'Website lead form', category: 'Lead Capture', description: 'Capture enquiries from your website form straight into the CRM.', connected: true, config: { webhook: 'https://example.invalid/hooks/website' }, note: 'Sample connection' },
      { id: 'in_fb', name: 'Facebook Lead Ads', category: 'Lead Capture', description: 'Import leads from your Facebook and Instagram lead forms as they arrive.', connected: false, config: {} },
      { id: 'in_gads', name: 'Google Ads lead forms', category: 'Lead Capture', description: 'Capture leads from Google Ads lead-form assets.', connected: false, config: {} },
      { id: 'in_jd', name: 'JustDial', category: 'Lead Capture', description: 'Receive JustDial leads the moment they come in.', connected: false, config: {} },
      { id: 'in_im', name: 'IndiaMART', category: 'Lead Capture', description: 'Auto-import leads from your IndiaMART seller account.', connected: false, config: {} },
      { id: 'in_sheets', name: 'Google Sheets', category: 'Productivity', description: 'New rows become leads, and leads sync back to the sheet.', connected: false, config: {} },
      { id: 'in_gcal', name: 'Google Calendar', category: 'Productivity', description: 'See Google Calendar events in the CRM calendar and schedule surveys.', connected: false, config: {} },
      { id: 'in_meta', name: 'Meta Ads conversions', category: 'Advertising', description: 'Tell Meta which leads became customers so your ads optimise for bookings.', connected: false, config: {} },
      { id: 'in_rzp', name: 'Razorpay', category: 'Payments', description: 'Collect invoice payments online with a payment link.', connected: false, config: {} },
      { id: 'in_exotel', name: 'Exotel', category: 'Telephony', description: 'Connect your Exotel account for click-to-call and call recording.', connected: false, config: {} },
      { id: 'in_plivo', name: 'Plivo', category: 'Telephony', description: 'Connect your Plivo account for voice calling.', connected: false, config: {} },
      { id: 'in_twilio', name: 'Twilio', category: 'Telephony', description: 'Connect your Twilio number for voice calling.', connected: false, config: {} },
      { id: 'in_shopify', name: 'Shopify', category: 'Commerce', description: 'Store customers become leads and orders land on their timeline.', connected: false, config: {} },
    ],
    notifications: [
      { id: 'n1', title: 'New lead assigned', body: `${leads[0].name} was assigned to you`, read: false, link: `/leads/${leads[0].id}`, at: ago(0, 1) },
      { id: 'n2', title: 'Task overdue', body: 'Call back for confirmation is overdue', read: false, link: '/tasks', at: ago(0, 4) },
      { id: 'n3', title: 'Payment received', body: 'A payment was recorded on INV-0001', read: true, link: '/billing/invoices', at: ago(1) },
    ],
  }
  const settings: Settings = {
    businessName: 'Super Packers and Movers', businessPhone: '+91 98100 00001', businessEmail: 'owner@superpackers.example', businessAddress: 'Sector 14, Gurugram, Haryana 122001', gstin: '',
    currency: 'INR', timezone: 'Asia/Kolkata', workStart: '09:00', workEnd: '19:00', workDays: [1, 2, 3, 4, 5, 6],
    invoicePrefix: 'INV-', quotationPrefix: 'QT-', defaultTax: 18, invoiceTerms: 'Payment is due before unloading. Goods are carried at owner’s risk unless transit insurance is taken.',
    autoAssign: true, autoAssignUserIds: ['u3', 'u4'], credits: 500, notifyTaskDue: true, notifyNewLead: true, taskTypes: ['Follow up', 'Call', 'Survey', 'Payment', 'Other'],
  }
  return { db, settings }
}
