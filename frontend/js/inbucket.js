import { nodes } from './inbucket/dom'
import { configureMailboxTools } from './inbucket/mailbox-tools'
import { archiveSelectedMailboxes, clearMailboxes, configureMailboxes, deleteSelectedMailboxes, loadMailboxes, refreshMailboxCatalog, selectAllMailboxes } from './inbucket/mailboxes'
import { closeMessageFilter, configureMessages, deleteMessage, toggleSource } from './inbucket/messages'
import { closeMonitorFilter, configureMonitor, refreshMonitorMessages } from './inbucket/monitor'
import { replaceSelectedMailboxes, state } from './inbucket/state'
import { request, setStatus, updateLocation } from './inbucket/shared'

const showAccessScreen = (message, stateName = 'signed-out') => {
  closeMessageFilter()
  closeMonitorFilter()
  nodes.mailboxView.hidden = true
  nodes.appNavigation.hidden = true
  nodes.signOut.hidden = true
  nodes.accessScreen.hidden = false
  nodes.loginForm.hidden = false
  setStatus(nodes.accessMessage, message, stateName)
}

const showMailboxView = () => {
  nodes.accessScreen.hidden = true
  nodes.mailboxView.hidden = false
  nodes.appNavigation.hidden = false
  nodes.signOut.hidden = false
}

const handleUnauthorized = () => {
  state.currentMailbox = ''
  state.currentMessageId = ''
  replaceSelectedMailboxes([])
  nodes.messageList.replaceChildren()
  nodes.messageContent.hidden = true
  nodes.messageEmpty.hidden = false
  showAccessScreen('Your session has expired. Sign in again to continue.', 'expired')
}

const showView = (view) => {
  closeMessageFilter()
  closeMonitorFilter()
  nodes.monitorView.hidden = view !== 'monitor'
  nodes.archiveView.hidden = view !== 'archive'
  nodes.mailboxesView.hidden = view !== 'mailboxes'
  for (const [name, tab] of [['monitor', nodes.monitorTab], ['archive', nodes.archiveTab], ['mailboxes', nodes.mailboxesTab]]) {
    if (view === name) tab.setAttribute('aria-current', 'page')
    else tab.removeAttribute('aria-current')
  }
  if (view === 'monitor') refreshMonitorMessages()
  if (view === 'archive') refreshMailboxCatalog()
}

const login = async (event) => {
  event.preventDefault()
  const button = nodes.loginForm.querySelector('button[type="submit"]')
  button.disabled = true
  setStatus(nodes.accessMessage, 'Signing in.', 'loading')
  try {
    const response = await request('/v1/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: nodes.username.value, password: nodes.password.value }),
    })
    nodes.password.value = ''
    if (response.status === 401) return setStatus(nodes.accessMessage, 'The username or password is incorrect.', 'error')
    if (!response.ok) throw new Error('login_unavailable')
    nodes.loginForm.reset()
    showMailboxView()
    await refreshMailboxCatalog()
    setStatus(nodes.mailboxStatus, 'Select one or more saved mailboxes, or add a mailbox name.')
  } catch {
    setStatus(nodes.accessMessage, 'Sign-in is temporarily unavailable. Please try again.', 'error')
  } finally {
    button.disabled = false
  }
}

const authenticate = async () => {
  const url = new URL(window.location.href)
  const mailbox = url.searchParams.get('mailbox') || ''
  const selectedId = url.searchParams.get('message') || ''
  try {
    const response = await request('/v1/session')
    if (response.status === 401) return showAccessScreen('Sign in to browse Inbucket mailboxes.')
    if (!response.ok) throw new Error('session_unavailable')
    showMailboxView()
    await refreshMailboxCatalog()
    if (mailbox) await loadMailboxes([mailbox], selectedId)
    else setStatus(nodes.mailboxStatus, 'Select one or more saved mailboxes, or add a mailbox name.')
  } catch {
    showAccessScreen('The application is unavailable. Please try again later.', 'error')
  }
}

const signOut = async () => {
  nodes.signOut.disabled = true
  try {
    const response = await request('/v1/session', { method: 'DELETE' })
    if (!response.ok && response.status !== 401) throw new Error('sign_out_failed')
    updateLocation()
    showAccessScreen('You have signed out.')
  } catch {
    setStatus(nodes.mailboxStatus, 'Sign-out could not be completed. Please try again.', 'error')
  } finally {
    nodes.signOut.disabled = false
  }
}

configureMailboxes({ handleUnauthorized })
configureMailboxTools()
configureMessages({ loadMailboxes, handleUnauthorized })
configureMonitor({ handleUnauthorized, showView })

nodes.mailboxForm.addEventListener('submit', (event) => {
  event.preventDefault()
  const mailbox = nodes.mailboxName.value.trim()
  if (!mailbox) return
  nodes.mailboxName.value = ''
  nodes.mailboxForm.closest('details').removeAttribute('open')
  state.selectedMailboxes.add(mailbox)
  loadMailboxes()
})
nodes.selectAllMailboxes.addEventListener('click', selectAllMailboxes)
nodes.clearMailboxes.addEventListener('click', clearMailboxes)
nodes.deleteMailboxes.addEventListener('click', deleteSelectedMailboxes)
nodes.archiveMailboxes.addEventListener('click', archiveSelectedMailboxes)
nodes.loginForm.addEventListener('submit', login)
nodes.deleteMessage.addEventListener('click', deleteMessage)
nodes.mailboxesTab.addEventListener('click', () => showView('mailboxes'))
nodes.monitorTab.addEventListener('click', () => showView('monitor'))
nodes.archiveTab.addEventListener('click', () => showView('archive'))
nodes.sourceToggle.addEventListener('click', toggleSource)
nodes.signOut.addEventListener('click', signOut)

authenticate()
window.setInterval(refreshMailboxCatalog, 15000)
window.setInterval(refreshMonitorMessages, 3000)
