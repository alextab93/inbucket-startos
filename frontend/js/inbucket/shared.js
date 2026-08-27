export const request = (path, options = {}) => fetch(path, { credentials: 'include', ...options })

export const setStatus = (node, message, state = '') => {
  node.textContent = message
  node.dataset.state = state
}

export const formatValue = (value) => {
  if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join(', ')
  if (value && typeof value === 'object') return value.address || value.email || value.name || ''
  return value === undefined || value === null ? '' : String(value)
}

export const headerValue = (message, name) => {
  if (!message.header || typeof message.header !== 'object') return ''
  const key = Object.keys(message.header).find((candidate) => candidate.toLowerCase() === name.toLowerCase())
  return key ? formatValue(message.header[key]) : ''
}

export const dateText = (value) => {
  if (!value) return 'Unknown date'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? String(value) : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
}

export const errorMessage = (status, subject) => {
  if (status === 404) return `${subject} was not found.`
  if (status === 502) return 'Inbucket is temporarily unavailable. Please try again.'
  return `${subject} could not be loaded. Please try again.`
}

export const updateLocation = (mailbox = '', message = '') => {
  const url = new URL(window.location.href)
  url.hash = ''
  if (mailbox) url.searchParams.set('mailbox', mailbox)
  else url.searchParams.delete('mailbox')
  if (message) url.searchParams.set('message', message)
  else url.searchParams.delete('message')
  window.history.replaceState(null, '', `${url.pathname}${url.search}`)
}

export const mailboxPath = (mailbox) => `/v1/inbucket/mailbox?name=${encodeURIComponent(mailbox)}`
export const archiveMailboxPath = (mailbox) => `/v1/inbucket/mailbox/archive?name=${encodeURIComponent(mailbox)}`
export const restoreMailboxPath = (mailbox) => `${archiveMailboxPath(mailbox)}&archived=false`
export const messagePath = (mailbox, id, suffix = '') => `/v1/inbucket/mailboxes/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(id)}${suffix}`
export const readMessagePath = (mailbox, id) => messagePath(mailbox, id, '/read')
export const inlineImagePath = (mailbox, id, cid) => `${messagePath(mailbox, id, '/inline-image')}?cid=${encodeURIComponent(cid)}`
export const attachmentsPath = (mailbox, id) => messagePath(mailbox, id, '/attachments')
export const attachmentPath = (mailbox, id, index) => `${attachmentsPath(mailbox, id)}/${encodeURIComponent(index)}`
export const deleteMessagePath = (mailbox, id) => `/v1/inbucket/message?name=${encodeURIComponent(mailbox)}&id=${encodeURIComponent(id)}`
