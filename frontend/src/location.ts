import type { ViewName } from './types'

export interface AppLocation {
  view: ViewName
  mailbox: string
  message: string
}

export type HistoryMode = 'push' | 'replace'

const viewNames: ViewName[] = ['mailboxes', 'starred', 'monitor', 'archive']

export const readLocation = (): AppLocation => {
  const url = new URL(window.location.href)
  const requestedView = url.searchParams.get('view')
  const view = viewNames.includes(requestedView as ViewName)
    ? (requestedView as ViewName)
    : 'mailboxes'
  const supportsMessage = view === 'mailboxes' || view === 'starred'
  let mailbox = supportsMessage
    ? url.searchParams.get('mailbox')?.trim() || ''
    : ''
  let message = mailbox ? url.searchParams.get('message')?.trim() || '' : ''
  if (view === 'starred' && !message) {
    mailbox = ''
    message = ''
  }

  return { view, mailbox, message }
}

export const writeLocation = (
  location: AppLocation,
  mode: HistoryMode = 'replace',
) => {
  const url = new URL(window.location.href)
  url.hash = ''
  if (location.view === 'mailboxes') url.searchParams.delete('view')
  else url.searchParams.set('view', location.view)

  const supportsMessage =
    location.view === 'mailboxes' || location.view === 'starred'
  if (supportsMessage && location.mailbox)
    url.searchParams.set('mailbox', location.mailbox)
  else url.searchParams.delete('mailbox')
  if (supportsMessage && location.mailbox && location.message)
    url.searchParams.set('message', location.message)
  else url.searchParams.delete('message')

  const target = `${url.pathname}${url.search}`
  if (mode === 'push') window.history.pushState(null, '', target)
  else window.history.replaceState(null, '', target)
}
