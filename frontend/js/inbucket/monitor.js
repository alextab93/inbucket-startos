import { nodes } from './dom'
import { loadMailboxes } from './mailboxes'
import { selectMessage } from './messages'
import { state } from './state'
import { dateText, formatValue, request, setStatus } from './shared'

let handleUnauthorized = () => {}
let showView = () => {}

export const configureMonitor = (options) => {
  handleUnauthorized = options.handleUnauthorized
  showView = options.showView
}

const renderMonitorMessages = (messages) => {
  nodes.monitorMessageList.replaceChildren()
  if (!messages.length) {
    nodes.monitorMessageList.append(Object.assign(document.createElement('p'), { className: 'monitor-message-empty', textContent: 'No messages have arrived since monitoring began.' }))
    return
  }
  for (const message of messages) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'monitor-message'
    const date = document.createElement('span')
    date.textContent = dateText(message.date)
    const sender = document.createElement('span')
    sender.textContent = formatValue(message.from) || 'Unknown sender'
    const mailbox = document.createElement('span')
    mailbox.textContent = message.mailbox
    const subject = document.createElement('span')
    subject.textContent = formatValue(message.subject) || '(No subject)'
    button.append(date, sender, mailbox, subject)
    button.addEventListener('click', async () => {
      showView('mailboxes')
      state.selectedMailboxes.add(message.mailbox)
      await loadMailboxes()
      await selectMessage(message.mailbox, message.id)
    })
    nodes.monitorMessageList.append(button)
  }
}

export const refreshMonitorMessages = async () => {
  if (nodes.monitorView.hidden) return
  try {
    const response = await request('/v1/inbucket/monitor/messages')
    if (response.status === 401) return handleUnauthorized()
    if (!response.ok) throw new Error('monitor_unavailable')
    const messages = await response.json()
    if (!Array.isArray(messages)) throw new Error('invalid_response')
    renderMonitorMessages(messages)
    setStatus(nodes.monitorStatus, `Updated ${new Intl.DateTimeFormat('en', { timeStyle: 'medium' }).format(new Date())}.`, 'authenticated')
  } catch {
    setStatus(nodes.monitorStatus, 'The monitor could not be loaded. Please try again.', 'error')
  }
}
