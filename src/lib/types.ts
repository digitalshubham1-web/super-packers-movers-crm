// Shared data model. Every record has a string `id`.

export type Role = 'admin' | 'manager' | 'sales'
export interface User {
  id: string; name: string; email: string; phone: string; role: Role
  active: boolean; available: boolean; reportsTo?: string; joinedAt: string; color: string
}

export interface Stage { id: string; label: string; color: string; order: number; isWon?: boolean; isLost?: boolean; isInitial?: boolean }
export interface Option { id: string; label: string; color?: string }

export type FieldType = 'text' | 'textarea' | 'number' | 'currency' | 'email' | 'phone' | 'url' | 'date' | 'dropdown' | 'yesno' | 'rating'
export interface CustomField { id: string; label: string; type: FieldType; options?: string[]; required?: boolean; active: boolean }

export interface Lead {
  id: string; no: number; name: string; phone: string; email?: string; altPhone?: string
  company?: string; city?: string; state?: string; address?: string
  stageId: string; sourceId: string; ownerId?: string
  rating: number; value: number; tags: string[]
  // Moving-specific details
  moveFrom?: string; moveTo?: string; moveDate?: string; homeSize?: string
  nextFollowUpAt?: string; lostReasonId?: string; doNotCall?: boolean
  custom: Record<string, string | number | boolean>
  createdAt: string; updatedAt: string
}

export type ActivityType = 'note' | 'call' | 'whatsapp' | 'email' | 'stage' | 'owner' | 'task' | 'system' | 'invoice' | 'quotation'
export interface Activity { id: string; leadId?: string; type: ActivityType; text: string; userId?: string; at: string }

export type TaskStatus = 'pending' | 'done' | 'cancelled'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export interface Task {
  id: string; title: string; description?: string; type: string; leadId?: string; assigneeId: string
  dueAt: string; status: TaskStatus; priority: Priority; reminderMin?: number
  createdBy: 'user' | 'automation' | 'ai'; createdAt: string; completedAt?: string
}

export interface CalEvent { id: string; title: string; start: string; end: string; leadId?: string; userId: string; notes?: string }

export interface Item { id: string; name: string; sku?: string; kind: 'goods' | 'service'; category?: string; unit: string; price: number; taxPercent: number; stock?: number; active: boolean }
export interface LineItem { id: string; itemId?: string; description: string; qty: number; rate: number; taxPercent: number }
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected'
export interface Quotation {
  id: string; number: string; leadId?: string; customerName: string; customerPhone?: string
  lines: LineItem[]; discount: number; notes?: string; status: QuotationStatus
  issueDate: string; validUntil?: string; invoiceId?: string; createdAt: string
}
export type InvoiceStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'cancelled'
export interface Invoice {
  id: string; number: string; leadId?: string; quotationId?: string
  customerName: string; customerPhone?: string; customerAddress?: string; gstin?: string
  lines: LineItem[]; discount: number; notes?: string; status: InvoiceStatus
  issueDate: string; dueDate?: string; createdAt: string
}
export interface Payment { id: string; invoiceId: string; amount: number; mode: 'cash' | 'upi' | 'bank' | 'card' | 'cheque'; reference?: string; at: string }

export type AutomationAction = 'assign' | 'tag' | 'stage' | 'task' | 'notify' | 'email' | 'whatsapp' | 'ai_call'
export interface Automation {
  id: string; name: string; trigger: 'new_lead' | 'stage_changed' | 'task_overdue' | 'no_reply'
  filterSourceId?: string; filterStageId?: string; delayMin: number
  action: AutomationAction; actionConfig: Record<string, string>; active: boolean; runs: number; createdAt: string
}

export interface Conversation {
  id: string; leadId?: string; name: string; phone: string; ownerId?: string
  status: 'active' | 'requesting' | 'intervened'; unread: number; lastMessage: string; lastAt: string; botPaused?: boolean
}
export interface WaMessage { id: string; conversationId: string; from: 'customer' | 'agent' | 'bot'; text: string; at: string; status?: 'sent' | 'delivered' | 'read' | 'failed' }
export interface WaTemplate { id: string; name: string; category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'; language: string; body: string; status: 'approved' | 'pending' | 'rejected' | 'draft'; createdAt: string; updatedAt: string; lastUsedAt?: string }
export interface FlowStep { id: string; kind: string; label: string; text?: string; options?: string[] }
export interface BotFlow { id: string; name: string; trigger: string; keywords?: string[]; steps: FlowStep[]; active: boolean; runs: number; updatedAt: string }
export interface WaCampaign { id: string; name: string; templateId: string; audience: string; recipients: number; sent: number; delivered: number; read: number; replied: number; status: 'draft' | 'scheduled' | 'live' | 'completed' | 'failed'; scheduledAt?: string; createdAt: string }
export interface CannedMessage { id: string; shortcut: string; text: string }

export interface AiAgent {
  id: string; name: string; channel: 'whatsapp'; instructions: string; actAsUserId?: string
  contextMessages: number; replyDelaySec: number; tools: Record<string, boolean>
  files: { id: string; name: string; sent: number }[]; active: boolean; repliesSent: number; failed: number
}
export interface VoiceAgent {
  id: string; name: string; direction: 'inbound' | 'outbound'; voice: string; language: string
  prompt: string; greeting: string; hoursStart: string; hoursEnd: string; dailyLimit: number
  maxCallSec: number; recordCalls: boolean; active: boolean; number?: string
}

export interface Call {
  id: string; leadId?: string; name: string; phone: string; userId?: string; byAi?: boolean
  direction: 'incoming' | 'outgoing'; outcome: 'connected' | 'missed' | 'no_answer' | 'busy'
  durationSec: number; at: string; summary?: string
}
export interface CallCampaign {
  id: string; name: string; kind: 'team' | 'ai'; callerIds: string[]; voiceAgentId?: string; leadIds: string[]
  doneLeadIds: string[]; status: 'active' | 'paused' | 'completed' | 'cancelled'; createdAt: string
}

export interface Email { id: string; folder: 'inbox' | 'sent' | 'drafts' | 'archive'; from: string; to: string; subject: string; body: string; at: string; read: boolean; leadId?: string }
export interface EmailTemplate { id: string; name: string; subject: string; body: string }

export interface Integration { id: string; name: string; category: 'Lead Capture' | 'Messaging' | 'Commerce' | 'Telephony' | 'Payments' | 'Advertising' | 'Productivity'; description: string; connected: boolean; config: Record<string, string>; note?: string }

export interface Notification { id: string; title: string; body: string; read: boolean; link?: string; at: string }

export interface Settings {
  businessName: string; businessPhone: string; businessEmail: string; businessAddress: string; gstin: string
  currency: string; timezone: string; workStart: string; workEnd: string; workDays: number[]
  invoicePrefix: string; quotationPrefix: string; defaultTax: number; invoiceTerms: string
  autoAssign: boolean; autoAssignUserIds: string[]; credits: number
  notifyTaskDue: boolean; notifyNewLead: boolean; taskTypes: string[]
}

export interface DB {
  leads: Lead[]; activities: Activity[]; tasks: Task[]; events: CalEvent[]
  users: User[]; stages: Stage[]; sources: Option[]; lostReasons: Option[]; customFields: CustomField[]
  items: Item[]; quotations: Quotation[]; invoices: Invoice[]; payments: Payment[]
  automations: Automation[]
  conversations: Conversation[]; messages: WaMessage[]; templates: WaTemplate[]; botFlows: BotFlow[]; waCampaigns: WaCampaign[]; cannedMessages: CannedMessage[]
  aiAgents: AiAgent[]; voiceAgents: VoiceAgent[]
  calls: Call[]; callCampaigns: CallCampaign[]
  emails: Email[]; emailTemplates: EmailTemplate[]
  integrations: Integration[]; notifications: Notification[]
}
export type CollectionName = keyof DB
export type RecordOf<K extends CollectionName> = DB[K][number]
