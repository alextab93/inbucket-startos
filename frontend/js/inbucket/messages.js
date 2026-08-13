import DOMPurify from 'dompurify'
import { nodes } from './dom'
import { state } from './state'
import { attachmentPath, attachmentsPath, dateText, deleteMessagePath, errorMessage, formatValue, headerValue, inlineImagePath, messagePath, request, setStatus, updateLocation } from './shared'

let loadMailboxes = async () => {}
let handleUnauthorized = () => {}

export const configureMessages = (options) => {
  loadMailboxes = options.loadMailboxes
  handleUnauthorized = options.handleUnauthorized
}

const renderAttachments = (attachments, mailbox, id) => {
  nodes.messageAttachmentList.replaceChildren()
  for (const attachment of attachments) {
    const item = document.createElement('li')
    const link = document.createElement('a')
    link.href = attachmentPath(mailbox, id, attachment.index)
    link.textContent = attachment.filename || 'attachment'
    const type = document.createElement('span')
    type.textContent = attachment.content_type || 'application/octet-stream'
    item.append(link, type)
    nodes.messageAttachmentList.append(item)
  }
  nodes.messageAttachments.hidden = attachments.length === 0
}

const loadAttachments = async (mailbox, id) => {
  nodes.messageAttachments.hidden = true
  nodes.messageAttachmentList.replaceChildren()
  try {
    const response = await request(attachmentsPath(mailbox, id))
    if (response.status === 401) return handleUnauthorized()
    if (!response.ok) return
    const attachments = await response.json()
    if (state.currentMailbox !== mailbox || state.currentMessageId !== id || !Array.isArray(attachments)) return
    renderAttachments(attachments, mailbox, id)
  } catch {}
}

const renderBody = (message) => {
  nodes.messageBody.replaceChildren()
  const html = message.body && formatValue(message.body.html)
  const text = message.body && formatValue(message.body.text)
  if (html) {
    nodes.messageBody.innerHTML = DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['base', 'button', 'embed', 'form', 'iframe', 'input', 'link', 'meta', 'object', 'style', 'svg', 'math'],
      FORBID_ATTR: ['srcset', 'style'],
    })
    for (const image of nodes.messageBody.querySelectorAll('img[src]')) {
      const source = image.getAttribute('src')
      if (!source || !source.toLowerCase().startsWith('cid:')) continue
      try {
        image.src = inlineImagePath(state.currentMailbox, state.currentMessageId, decodeURIComponent(source.slice(4)))
      } catch {
        image.removeAttribute('src')
      }
    }
    return
  }
  const pre = document.createElement('pre')
  pre.textContent = text || 'This message has no displayable body.'
  nodes.messageBody.append(pre)
}

const renderMessage = (message) => {
  nodes.messageSubject.textContent = formatValue(message.subject) || '(No subject)'
  nodes.messageFrom.textContent = formatValue(message.from) || headerValue(message, 'from') || 'Unknown sender'
  nodes.messageTo.textContent = formatValue(message.to) || headerValue(message, 'to') || 'Unknown recipient'
  nodes.messageDate.textContent = dateText(message.date || headerValue(message, 'date'))
  renderBody(message)
  void loadAttachments(state.currentMailbox, state.currentMessageId)
  nodes.messageSource.textContent = ''
  nodes.messageSource.hidden = true
  nodes.sourceToggle.textContent = 'View source'
  nodes.sourceToggle.setAttribute('aria-expanded', 'false')
  setStatus(nodes.sourceStatus, '')
  nodes.messageEmpty.hidden = true
  nodes.messageContent.hidden = false
}

export const selectMessage = async (mailbox, id) => {
  state.currentMailbox = mailbox
  state.currentMessageId = String(id)
  updateLocation(state.currentMailbox, state.currentMessageId)
  for (const button of nodes.messageList.querySelectorAll('button')) {
    const selected = button.dataset.messageId === state.currentMessageId && button.dataset.mailbox === state.currentMailbox
    button.classList.toggle('selected', selected)
    button.setAttribute('aria-current', selected ? 'true' : 'false')
  }
  nodes.messageContent.hidden = true
  nodes.messageEmpty.hidden = false
  nodes.messageEmpty.textContent = 'Loading message.'
  try {
    const response = await request(messagePath(state.currentMailbox, state.currentMessageId))
    if (response.status === 401) return handleUnauthorized()
    if (!response.ok) return nodes.messageEmpty.textContent = errorMessage(response.status, 'The message')
    renderMessage(await response.json())
  } catch {
    nodes.messageEmpty.textContent = 'The message could not be loaded. Please try again.'
  }
}

export const renderMessageList = (messages) => {
  nodes.messageList.replaceChildren()
  if (!messages.length) {
    nodes.messageList.append(Object.assign(document.createElement('p'), { className: 'message-list-empty', textContent: 'This mailbox has no messages.' }))
    return
  }
  for (const message of messages) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'message-summary'
    button.dataset.messageId = String(message.id)
    button.dataset.mailbox = message.mailbox
    const subject = document.createElement('strong')
    subject.textContent = formatValue(message.subject) || '(No subject)'
    const sender = document.createElement('span')
    sender.textContent = formatValue(message.from) || 'Unknown sender'
    const date = document.createElement('time')
    date.textContent = dateText(message.date)
    button.append(subject, sender, date)
    button.addEventListener('click', () => selectMessage(message.mailbox, message.id))
    nodes.messageList.append(button)
  }
}

export const toggleSource = async () => {
  if (!nodes.messageSource.hidden) {
    nodes.messageSource.hidden = true
    nodes.sourceToggle.textContent = 'View source'
    nodes.sourceToggle.setAttribute('aria-expanded', 'false')
    return
  }
  if (nodes.messageSource.textContent) {
    nodes.messageSource.hidden = false
    nodes.sourceToggle.textContent = 'Hide source'
    nodes.sourceToggle.setAttribute('aria-expanded', 'true')
    return
  }
  nodes.sourceToggle.disabled = true
  setStatus(nodes.sourceStatus, 'Loading message source.', 'loading')
  try {
    const response = await request(messagePath(state.currentMailbox, state.currentMessageId, '/source'))
    if (response.status === 401) return handleUnauthorized()
    if (!response.ok) return setStatus(nodes.sourceStatus, errorMessage(response.status, 'The message source'), 'error')
    nodes.messageSource.textContent = await response.text()
    nodes.messageSource.hidden = false
    nodes.sourceToggle.textContent = 'Hide source'
    nodes.sourceToggle.setAttribute('aria-expanded', 'true')
    setStatus(nodes.sourceStatus, '')
  } catch {
    setStatus(nodes.sourceStatus, 'The message source could not be loaded. Please try again.', 'error')
  } finally {
    nodes.sourceToggle.disabled = false
  }
}

export const deleteMessage = async () => {
  if (!state.currentMailbox || !state.currentMessageId || !window.confirm('Delete this message permanently?')) return
  nodes.deleteMessage.disabled = true
  try {
    const response = await request(deleteMessagePath(state.currentMailbox, state.currentMessageId), { method: 'DELETE' })
    if (response.status === 401) return handleUnauthorized()
    if (!response.ok) return setStatus(nodes.sourceStatus, errorMessage(response.status, 'The message'), 'error')
    state.currentMessageId = ''
    nodes.messageContent.hidden = true
    nodes.messageEmpty.hidden = false
    nodes.messageEmpty.textContent = 'Message deleted.'
    await loadMailboxes()
  } catch {
    setStatus(nodes.sourceStatus, 'The message could not be deleted. Please try again.', 'error')
  } finally {
    nodes.deleteMessage.disabled = false
  }
}
