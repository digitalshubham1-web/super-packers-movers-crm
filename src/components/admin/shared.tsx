import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Button, Modal } from '@/components/ui'

/** Shows a short "Saved" confirmation after a form is saved. */
export function useSaved(): [boolean, () => void] {
  const [saved, setSaved] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const flash = useCallback(() => {
    setSaved(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setSaved(false), 2500)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return [saved, flash]
}

export function SavedTag({ show, text = 'Saved' }: { show: boolean; text?: string }) {
  if (!show) return null
  return <span role="status" className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600"><Check size={12} />{text}</span>
}

export function Confirm({ open, onClose, title, children, confirmLabel = 'Delete', danger = true, onConfirm, disabled }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; disabled?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<>
      <Button onClick={onClose}>Cancel</Button>
      <Button variant={danger ? 'danger' : 'primary'} disabled={disabled} onClick={onConfirm}>{confirmLabel}</Button>
    </>}>
      <div className="space-y-3 text-sm">{children}</div>
    </Modal>
  )
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch { return false }
  }
}

export const COLOURS = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#f97316', '#14b8a6', '#16a34a', '#ef4444', '#db2777', '#2563eb', '#64748b']
