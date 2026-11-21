/* Shared helpers for the WhatsApp pages. Nothing here talks to a real WhatsApp service. */
import { useCallback, useState } from 'react'
import { useStore } from '@/lib/store'
import { nowIso } from '@/lib/utils'
import type { Lead } from '@/lib/types'

export function readLocal<T>(key: string, initial: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : initial
  } catch {
    return initial
  }
}
/** useState that is also saved in localStorage under `key`. */
export function useLocal<T>(key: string, initial: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => readLocal(key, initial))
  const set = useCallback((v: T) => {
    setVal(v)
    try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* storage full or blocked */ }
  }, [key])
  return [val, set]
}

export const OPT_OUT_NUMBERS_KEY = 'spm-wa-optout-numbers'
export const OPT_OUT_KEYWORDS_KEY = 'spm-wa-optout-keywords'
export const DEFAULT_OPT_OUT_KEYWORDS = ['STOP', 'UNSUBSCRIBE', 'BAND KARO']
export const digits = (s: string) => s.replace(/\D/g, '').slice(-10)

/** Variable numbers used in a template body, e.g. "Hi {{1}}, your {{2}}" -> [1, 2]. */
export function templateVars(body: string): number[] {
  const set = new Set<number>()
  for (const m of body.matchAll(/\{\{(\d+)\}\}/g)) set.add(Number(m[1]))
  return [...set].sort((a, b) => a - b)
}
export function fillTemplate(body: string, vals: Record<number, string>): string {
  return body.replace(/\{\{(\d+)\}\}/g, (all, n: string) => vals[Number(n)]?.trim() || all)
}
export const SAMPLE_VALUES: Record<number, string> = { 1: 'Rahul', 2: '28 Nov', 3: '₹4,500', 4: 'Gurugram', 5: 'Pune' }
export const sampleFor = (n: number) => SAMPLE_VALUES[n] ?? `Sample ${n}`

/** Simulated send: saves the message, updates the conversation and the lead timeline. */
export function sendWa(conversationId: string, text: string, from: 'agent' | 'bot' = 'agent', at = nowIso()) {
  const { add, update, log, conversations } = useStore.getState()
  const conv = conversations.find(c => c.id === conversationId)
  if (!conv || !text.trim()) return
  add('messages', { conversationId, from, text: text.trim(), at, status: 'sent' })
  update('conversations', conversationId, { lastMessage: text.trim(), lastAt: at, unread: 0 })
  if (conv.leadId) log('whatsapp', `${from === 'bot' ? 'Bot replied on WhatsApp' : 'WhatsApp sent'}: ${text.trim().slice(0, 140)}`, conv.leadId)
}

/** Rule-based reply suggestion from the customer's last message. Not an AI model. */
export function suggestReply(lastText: string, name: string, lead?: Lead): string {
  const t = lastText.toLowerCase()
  const first = name.split(/\s+/)[0] || 'there'
  const route = lead?.moveFrom && lead?.moveTo ? ` for ${lead.moveFrom} to ${lead.moveTo}` : ''
  if (/quot|price|rate|charge|cost|kitna|estimate/.test(t))
    return `Hi ${first}, I am preparing your quotation${route} and will share it here shortly. Could you confirm the floor number and whether a lift is available at both addresses?`
  if (/survey|visit|inspect/.test(t)) return `Sure ${first}, we can do a free survey at your home. Which day and time suits you best?`
  if (/insur|damage|safe|break/.test(t)) return `${first}, all goods are packed in multi-layer packing and transit insurance is available. I will show it as a separate line in your quotation.`
  if (/pay|advance|upi|token/.test(t)) return `${first}, a small advance confirms the booking and the balance is paid on delivery. We accept UPI, bank transfer and cash. I will send the details with the quotation.`
  if (/date|when|kab|tomorrow|today|slot|time/.test(t)) return `${first}, let me check vehicle and team availability for that date and confirm within a few minutes.`
  if (/call|phone|baat/.test(t)) return `Sure ${first}, I will call you. What time works best for you?`
  if (/thank|thanks|dhanyavad|shukriya|ok\b|okay/.test(t)) return `You're welcome, ${first}! Please message here if you need anything else.`
  if (/^(hi|hello|hey|namaste)\b/.test(t)) return `Namaste ${first}! Thank you for contacting Super Packers and Movers. Please share your pickup city, drop city and shifting date.`
  return `Thank you ${first}. Could you share the pickup address, drop address, shifting date and the list of main items so I can prepare your quotation?`
}

/** Phone-style preview of a WhatsApp message. */
export function PhonePreview({ text, footer }: { text: string; footer?: string }) {
  return (
    <div className="mx-auto w-full max-w-[260px] rounded-[1.75rem] border-4 border-border bg-surface-2 p-2">
      <div className="rounded-t-2xl bg-brand px-3 py-2 text-xs font-medium text-brand-fg">Super Packers and Movers</div>
      <div className="min-h-44 rounded-b-2xl bg-bg p-3">
        <div className="max-w-full rounded-lg rounded-tl-none border border-border bg-surface px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words">
          {text || <span className="text-muted">Your message will show here.</span>}
          <div className="mt-1 text-right text-[10px] text-muted">{footer ?? '10:30 AM'}</div>
        </div>
      </div>
    </div>
  )
}
