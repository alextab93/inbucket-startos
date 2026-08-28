import { nodes } from './dom'
import { renderMessageList, selectMessage } from './messages'
import { replaceSelectedMailboxes, selectedMailboxNames, state } from './state'
import { archiveMailboxPath, errorMessage, mailboxPath, request, restoreMailboxPath, setStatus, updateLocation } from './shared'

let handleUnauthorized = () => {}

export const configureMailboxes = (options) => {
  handleUnauthorized = options.handleUnauthorized
}

const normalizeMailboxNames = (mailboxes) => [...new Set(mailboxes.map((mailbox) => mailbox.trim()).filter(Boolean))]

const updateMailboxSummary = (mailboxes) => {
  nodes.activeMailboxSummary.textContent = mailboxes.length === 0 ? 'No mailbox selected' : mailboxes.length === 1 ? mailboxes[0] : `${mailboxes.length} mailboxes`
}

export const loadMailboxes = async (mailboxes = selectedMailboxNames(), selectedId = '') => {
  const names = normalizeMailboxNames(mailboxes)
  updateMailboxSummary(names)
  if (!names.length) {
    state.currentMailbox = ''
    state.currentMessageId = ''
    updateLocation()
    nodes.messageList.replaceChildren()
    nodes.messageContent.hidden = true
    nodes.messageEmpty.hidden = false
    nodes.messageEmpty.textContent = 'Select one or more mailboxes to read messages.'
    setStatus(nodes.mailboxStatus, 'Select one or more saved mailboxes, or add a mailbox name.', 'authenticated')
    return
  }
  replaceSelectedMailboxes(names)
  state.currentMailbox = ''
  state.currentMessageId = ''
  updateLocation()
  nodes.messageContent.hidden = true
  nodes.messageEmpty.hidden = false
  nodes.messageEmpty.textContent = 'Select a message to read it.'
  nodes.messageList.replaceChildren()
  setStatus(nodes.mailboxStatus, `Loading ${names.length === 1 ? names[0] : `${names.length} mailboxes`}.`, 'loading')
  try {
    const results = await Promise.all(names.map(async (mailbox) => {
      const response = await request(mailboxPath(mailbox))
      if (response.status === 401) return { unauthorized: true }
      if (!response.ok) return { mailbox, error: errorMessage(response.status, 'The mailbox') }
      const messages = await response.json()
      if (!Array.isArray(messages)) throw new Error('invalid_response')
      return { mailbox, messages }
    }))
    if (results.some((result) => result.unauthorized)) return handleUnauthorized()
    const failed = results.filter((result) => result.error)
    const messages = results.flatMap((result) => (result.messages || []).map((message) => ({ ...message, mailbox: result.mailbox })))
    renderMessageList(messages)
    const summary = `${messages.length} ${messages.length === 1 ? 'message' : 'messages'} in ${names.length === 1 ? names[0] : `${names.length} mailboxes`}.`
    setStatus(nodes.mailboxStatus, failed.length ? `${summary} ${failed.map((result) => result.error).join(' ')}` : summary, failed.length ? 'error' : 'authenticated')
    await refreshMailboxCatalog()
    if (selectedId) {
      const selected = messages.find((message) => String(message.id) === selectedId)
      if (selected) await selectMessage(selected.mailbox, selected.id)
    }
  } catch {
    setStatus(nodes.mailboxStatus, 'The mailboxes could not be loaded. Please try again.', 'error')
  }
}

const renderMailboxCatalog = (mailboxes) => {
  nodes.mailboxOptions.replaceChildren()
  if (!mailboxes.length) {
    nodes.mailboxOptions.append(Object.assign(document.createElement('p'), { className: 'mailbox-options-empty', textContent: 'No saved mailboxes yet. Add a mailbox to open it.' }))
    return
  }
  for (const mailbox of mailboxes) {
    const label = document.createElement('label')
    label.className = 'mailbox-option'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.value = mailbox
    checkbox.checked = state.selectedMailboxes.has(mailbox)
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.selectedMailboxes.add(mailbox)
      else state.selectedMailboxes.delete(mailbox)
      loadMailboxes()
    })
    const name = document.createElement('span')
    name.textContent = mailbox
    label.append(checkbox, name)
    nodes.mailboxOptions.append(label)
  }
}

const restoreMailbox = async (mailbox, button) => {
  button.disabled = true
  try {
    const response = await request(restoreMailboxPath(mailbox), { method: 'PATCH' })
    if (response.status === 401) return handleUnauthorized()
    if (!response.ok) throw new Error('restore_failed')
    await refreshMailboxCatalog()
  } catch {
    setStatus(nodes.mailboxStatus, `The mailbox ${mailbox} could not be restored. Please try again.`, 'error')
  } finally {
    button.disabled = false
  }
}

const renderArchivedMailboxCatalog = (mailboxes) => {
  nodes.archivedMailboxOptions.replaceChildren()
  if (!mailboxes.length) {
    nodes.archivedMailboxOptions.append(Object.assign(document.createElement('p'), { className: 'mailbox-options-empty', textContent: 'No archived mailboxes.' }))
    return
  }
  for (const mailbox of mailboxes) {
    const row = document.createElement('div')
    row.className = 'archived-mailbox-option'
    const details = document.createElement('div')
    const name = document.createElement('strong')
    name.textContent = mailbox.name
    const count = document.createElement('p')
    count.textContent = mailbox.message_count === null ? 'Message count unavailable.' : `${mailbox.message_count} ${mailbox.message_count === 1 ? 'message' : 'messages'}.`
    details.append(name, count)
    const button = document.createElement('button')
    button.className = 'button button-secondary'
    button.type = 'button'
    button.textContent = 'Restore'
    button.addEventListener('click', () => restoreMailbox(mailbox.name, button))
    row.append(details, button)
    nodes.archivedMailboxOptions.append(row)
  }
}

export const refreshMailboxCatalog = async () => {
  if (nodes.mailboxView.hidden) return
  try {
    const response = await request('/v1/inbucket/mailboxes')
    if (response.status === 401) return handleUnauthorized()
    if (!response.ok) return
    const mailboxes = await response.json()
    if (!Array.isArray(mailboxes) || !mailboxes.every((mailbox) => typeof mailbox === 'string')) return
    renderMailboxCatalog(mailboxes)
    const archivedResponse = await request('/v1/inbucket/mailboxes?archived=true')
    if (archivedResponse.status === 401) return handleUnauthorized()
    if (!archivedResponse.ok) return
    const archivedMailboxes = await archivedResponse.json()
    if (Array.isArray(archivedMailboxes) && archivedMailboxes.every((mailbox) => mailbox && typeof mailbox.name === 'string' && (typeof mailbox.message_count === 'number' || mailbox.message_count === null))) renderArchivedMailboxCatalog(archivedMailboxes)
  } catch {
  }
}

export const selectAllMailboxes = () => {
  for (const checkbox of nodes.mailboxOptions.querySelectorAll('input[type="checkbox"]')) state.selectedMailboxes.add(checkbox.value)
  loadMailboxes()
}

export const clearMailboxes = () => {
  replaceSelectedMailboxes([])
  renderMailboxCatalog([...nodes.mailboxOptions.querySelectorAll('input[type="checkbox"]')].map((checkbox) => checkbox.value))
  loadMailboxes()
}

const performSelectedMailboxAction = async (method, action, completed) => {
  const mailboxes = selectedMailboxNames()
  if (!mailboxes.length) return setStatus(nodes.mailboxStatus, `Select at least one mailbox to ${action}.`, 'error')
  if (method === 'DELETE' && !window.confirm(`Permanently delete all messages in ${mailboxes.length === 1 ? mailboxes[0] : `${mailboxes.length} selected mailboxes`} and remove them from saved mailboxes?`)) return
  const button = method === 'DELETE' ? nodes.deleteMailboxes : nodes.archiveMailboxes
  button.disabled = true
  try {
    const results = await Promise.all(mailboxes.map(async (mailbox) => {
      const response = await request(method === 'DELETE' ? mailboxPath(mailbox) : archiveMailboxPath(mailbox), { method })
      return { mailbox, status: response.status, ok: response.ok }
    }))
    if (results.some((result) => result.status === 401)) return handleUnauthorized()
    const completedMailboxes = results.filter((result) => result.ok).map((result) => result.mailbox)
    replaceSelectedMailboxes(mailboxes.filter((mailbox) => !completedMailboxes.includes(mailbox)))
    await refreshMailboxCatalog()
    await loadMailboxes()
    const failed = results.filter((result) => !result.ok)
    setStatus(nodes.mailboxStatus, failed.length ? `${completed} ${completedMailboxes.length} mailboxes. ${failed.length} mailboxes could not be ${action}.` : `${completed} ${completedMailboxes.length} mailboxes.`, failed.length ? 'error' : 'authenticated')
  } catch {
    setStatus(nodes.mailboxStatus, `The selected mailboxes could not be ${action}. Please try again.`, 'error')
  } finally {
    button.disabled = false
  }
}

export const deleteSelectedMailboxes = () => performSelectedMailboxAction('DELETE', 'deleted', 'Deleted')
export const archiveSelectedMailboxes = () => performSelectedMailboxAction('PATCH', 'archived', 'Archived')
