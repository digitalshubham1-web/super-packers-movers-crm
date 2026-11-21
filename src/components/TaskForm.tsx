import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { addDays, addHours, set as setTime } from 'date-fns'
import type { Priority, Task, TaskStatus } from '@/lib/types'
import { useStore } from '@/lib/store'
import { friendlyDay, nowIso, toLocalInput } from '@/lib/utils'
import { Button, Drawer, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { LeadPicker, cap, priorities } from '@/components/work/shared'

type Props = { open: boolean; onClose: () => void; task?: Task; leadId?: string }

/** Create (no `task`) or edit a task in a right-side drawer. `leadId` pre-links a new task to a lead. */
export default function TaskForm({ open, onClose, task, leadId }: Props) {
  if (!open) return null
  return <TaskFormInner key={task?.id ?? 'new-' + (leadId ?? '')} onClose={onClose} task={task} leadId={leadId} />
}

const at = (d: Date, h: number) => setTime(d, { hours: h, minutes: 0, seconds: 0, milliseconds: 0 })

function TaskFormInner({ onClose, task, leadId }: Omit<Props, 'open'>) {
  const users = useStore(s => s.users)
  const taskTypes = useStore(s => s.settings.taskTypes)
  const currentUserId = useStore(s => s.currentUserId)
  const activeUsers = users.filter(u => u.active || u.id === task?.assigneeId)
  const types = task && !taskTypes.includes(task.type) ? [task.type, ...taskTypes] : taskTypes

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [type, setType] = useState(task?.type ?? types[0] ?? 'Follow up')
  const [lead, setLead] = useState(task?.leadId ?? leadId ?? '')
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? currentUserId)
  const [due, setDue] = useState(toLocalInput(task?.dueAt ?? addHours(new Date(), 1).toISOString()))
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium')
  const [reminder, setReminder] = useState(task?.reminderMin === undefined ? (task ? '' : '10') : String(task.reminderMin))
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'pending')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const presets: [string, () => Date][] = [
    ['In 1 hour', () => addHours(new Date(), 1)],
    ['Today 6 pm', () => at(new Date(), 18)],
    ['Tomorrow 10 am', () => at(addDays(new Date(), 1), 10)],
  ]

  const save = () => {
    if (!title.trim()) return setError('Please enter a title.')
    const dueDate = new Date(due)
    if (!due || isNaN(dueDate.getTime())) return setError('Please choose a due date and time.')
    const { add, update, log, notify } = useStore.getState()
    const data = {
      title: title.trim(), description: description.trim() || undefined, type, leadId: lead || undefined, assigneeId,
      dueAt: dueDate.toISOString(), priority, reminderMin: reminder === '' ? undefined : Number(reminder),
    }
    const assignee = users.find(u => u.id === assigneeId)
    if (task) {
      const completedAt = status === 'done' ? task.completedAt ?? nowIso() : undefined
      update('tasks', task.id, { ...data, status, completedAt })
      if (status !== task.status) log('task', `Task ${status === 'done' ? 'completed' : status === 'cancelled' ? 'cancelled' : 'reopened'}: ${data.title}`, data.leadId)
      if (assigneeId !== task.assigneeId && assignee) notify('Task assigned to ' + assignee.name, `${data.title} · due ${friendlyDay(data.dueAt)}`, '/tasks')
    } else {
      add('tasks', { ...data, status: 'pending', createdBy: 'user', createdAt: nowIso() })
      log('task', `Task created: ${data.title} (due ${friendlyDay(data.dueAt)}${assignee ? ', for ' + assignee.name : ''})`, data.leadId)
      notify(assignee && assignee.id !== currentUserId ? 'Task assigned to ' + assignee.name : 'New task for you', `${data.title} · due ${friendlyDay(data.dueAt)}`, '/tasks')
    }
    onClose()
  }

  const del = () => {
    if (!task) return
    const { remove, log } = useStore.getState()
    remove('tasks', task.id)
    log('task', `Task deleted: ${task.title}`, task.leadId)
    onClose()
  }

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={task ? 'Edit task' : 'New task'}
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <div>{task && <Button variant="ghost" icon={Trash2} onClick={() => setConfirmDelete(true)}>Delete</Button>}</div>
            <div className="flex gap-2">
              <Button onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={save}>{task ? 'Save changes' : 'Create task'}</Button>
            </div>
          </div>
        }
      >
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); save() }}>
          <Field label="Title *">
            <Input autoFocus value={title} onChange={e => { setTitle(e.target.value); setError('') }} placeholder="e.g. Call to confirm the moving date" />
          </Field>
          <Field label="Description">
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Anything the assignee should know" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <Select value={type} onChange={e => setType(e.target.value)}>
                {types.map(t => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Assigned to">
              <Select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                {activeUsers.map(u => <option key={u.id} value={u.id}>{u.name}{u.id === currentUserId ? ' (me)' : ''}</option>)}
              </Select>
            </Field>
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium text-muted">Linked lead</span>
            <LeadPicker value={lead} onChange={setLead} />
          </div>
          <div>
            <Field label="Due date and time *">
              <Input type="datetime-local" value={due} onChange={e => { setDue(e.target.value); setError('') }} />
            </Field>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {presets.map(([label, fn]) => (
                <Button key={label} type="button" size="sm" onClick={() => { setDue(toLocalInput(fn().toISOString())); setError('') }}>{label}</Button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Priority">
              <Select value={priority} onChange={e => setPriority(e.target.value as Priority)}>
                {priorities.map(p => <option key={p} value={p}>{cap(p)}</option>)}
              </Select>
            </Field>
            <Field label="Reminder">
              <Select value={reminder} onChange={e => setReminder(e.target.value)}>
                <option value="">No reminder</option>
                <option value="0">At due time</option>
                <option value="10">10 minutes before</option>
                <option value="30">30 minutes before</option>
                <option value="60">1 hour before</option>
              </Select>
            </Field>
          </div>
          {task && (
            <Field label="Status">
              <Select value={status} onChange={e => setStatus(e.target.value as TaskStatus)}>
                <option value="pending">Pending</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </Field>
          )}
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button type="submit" className="hidden" />
        </form>
      </Drawer>
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this task?"
        footer={<><Button onClick={() => setConfirmDelete(false)}>Keep task</Button><Button variant="danger" onClick={del}>Delete task</Button></>}
      >
        <p className="text-sm">"{task?.title}" will be removed for everyone. This cannot be undone.</p>
      </Modal>
    </>
  )
}
