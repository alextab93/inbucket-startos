import { nodes } from './dom'
import { createListControls } from './list-controls'
import { loadMailboxes } from './mailboxes'
import { selectMessage } from './messages'
import { state } from './state'
import { dateText, formatValue, request, setStatus } from './shared'

let handleUnauthorized = () => {}
let showView = () => {}
let monitorControls

const messageTimestamp = (message) => {
  if (message['posix-millis'] !== undefined) {
    const timestamp = Number(message['posix-millis'])
    if (Number.isFinite(timestamp)) return String(timestamp)
  }
  const timestamp = Date.parse(message.date)
  return Number.isFinite(timestamp) ? String(timestamp) : ''
}

const messageSize = (message) => {
  if (message.size === undefined || message.size === null) return ''
  const size = Number(message.size)
  return Number.isFinite(size) ? String(size) : ''
}

export const configureMonitor = (options) => {
  handleUnauthorized = options.handleUnauthorized
  showView = options.showView
  monitorControls = createListControls({
    control: nodes.monitorFilterControl,
    trigger: nodes.monitorFilterTrigger,
    panel: nodes.monitorFilterPanel,
    search: nodes.monitorSearch,
    readFilter: nodes.monitorFilterRead,
    unreadFilter: nodes.monitorFilterUnread,
    sortInputs: nodes.monitorFilterPanel.querySelectorAll(
      'input[name="monitor-sort"]',
    ),
    container: nodes.monitorMessageList,
    itemSelector: '.monitor-message',
    emptyClass: 'monitor-filter-empty',
    noun: 'monitored messages',
  })
}

export const closeMonitorFilter = () => monitorControls?.close()

const renderMonitorMessages = (messages) => {
  nodes.monitorMessageList.replaceChildren()
  if (!messages.length) {
    nodes.monitorMessageList.append(Object.assign(document.createElement('p'), { className: 'monitor-message-empty', textContent: 'No messages have arrived since monitoring began.' }))
    return
  }
  messages.forEach((message, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'monitor-message'
    const read = message.seen === true
    button.classList.add(read ? 'read' : 'unread')
    button.dataset.read = read ? 'true' : 'false'
    button.dataset.timestamp = messageTimestamp(message)
    button.dataset.size = messageSize(message)
    button.dataset.renderOrder = String(index)
    const date = document.createElement('span')
    date.textContent = dateText(message.date)
    const sender = document.createElement('span')
    sender.textContent = formatValue(message.from) || 'Unknown sender'
    const mailbox = document.createElement('span')
    mailbox.textContent = message.mailbox
    const subject = document.createElement('span')
    subject.className = 'monitor-message-subject'
    subject.textContent = formatValue(message.subject) || '(No subject)'
    const accessibleSummary = `${subject.textContent}, ${sender.textContent}, ${mailbox.textContent}, ${date.textContent}`
    button.dataset.searchText = [
      date.textContent,
      sender.textContent,
      mailbox.textContent,
      subject.textContent,
      formatValue(message.to),
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
    button.setAttribute(
      'aria-label',
      `${read ? 'Read' : 'Unread'}: ${accessibleSummary}`,
    )
    button.append(date, sender, mailbox, subject)
    button.addEventListener('click', async () => {
      showView('mailboxes')
      state.selectedMailboxes.add(message.mailbox)
      await loadMailboxes()
      await selectMessage(message.mailbox, message.id)
    })
    nodes.monitorMessageList.append(button)
  })
  monitorControls?.apply()
}

export const refreshMonitorMessages = async () => {
  if (nodes.mailboxView.hidden || nodes.monitorView.hidden) return
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
