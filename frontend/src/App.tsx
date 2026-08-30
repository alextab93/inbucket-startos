import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, isAbort, isUnauthorized, visibleError } from './api'
import { AccessScreen } from './components/AccessScreen'
import { AppHeader } from './components/AppHeader'
import { ArchivedView } from './components/ArchivedView'
import { MailboxTools } from './components/MailboxTools'
import { MessageWorkspace } from './components/MessageWorkspace'
import { MonitorView } from './components/MonitorView'
import { StatusMessage } from './components/StatusMessage'
import { StarredView } from './components/StarredView'
import type {
  ArchivedMailbox,
  AuthenticationState,
  MessageSummary,
  MonitorSummary,
  SelectedMessage,
  Session,
  StatusValue,
  ViewName,
} from './types'

const defaultMailboxStatus: StatusValue = {
  message: 'Select one or more saved mailboxes, or add a mailbox name.',
  state: 'authenticated',
}

const normalizeMailboxNames = (mailboxes: string[]): string[] => [
  ...new Set(mailboxes.map((mailbox) => mailbox.trim()).filter(Boolean)),
]

const messageKey = (mailbox: string, id: string): string =>
  `${mailbox}\u0000${id}`

const replaceLocation = (mailbox = '', message = '') => {
  const url = new URL(window.location.href)
  url.hash = ''
  if (mailbox) url.searchParams.set('mailbox', mailbox)
  else url.searchParams.delete('mailbox')
  if (message) url.searchParams.set('message', message)
  else url.searchParams.delete('message')
  window.history.replaceState(null, '', `${url.pathname}${url.search}`)
}

const validActiveMailboxes = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((mailbox) => typeof mailbox === 'string')

const validArchivedMailboxes = (value: unknown): value is ArchivedMailbox[] =>
  Array.isArray(value) &&
  value.every(
    (mailbox) =>
      mailbox &&
      typeof mailbox === 'object' &&
      typeof mailbox.name === 'string' &&
      (typeof mailbox.message_count === 'number' ||
        mailbox.message_count === null),
  )

export const App = () => {
  const [authentication, setAuthentication] =
    useState<AuthenticationState>('checking')
  const [accessStatus, setAccessStatus] = useState<StatusValue>({
    message: 'Checking for an active session.',
    state: 'loading',
  })
  const [session, setSession] = useState<Session | null>(null)
  const [view, setView] = useState<ViewName>('mailboxes')
  const [signingOut, setSigningOut] = useState(false)
  const [mailboxes, setMailboxes] = useState<string[]>([])
  const [archivedMailboxes, setArchivedMailboxes] = useState<ArchivedMailbox[]>(
    [],
  )
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [archivedCatalogError, setArchivedCatalogError] = useState('')
  const [selectedMailboxes, setSelectedMailboxes] = useState<string[]>([])
  const [messages, setMessages] = useState<MessageSummary[]>([])
  const [mailboxLoading, setMailboxLoading] = useState(false)
  const [mailboxStatus, setMailboxStatus] =
    useState<StatusValue>(defaultMailboxStatus)
  const [selectedMessage, setSelectedMessage] =
    useState<SelectedMessage | null>(null)
  const [inspectorEmptyMessage, setInspectorEmptyMessage] = useState(
    'Select a message to read it.',
  )
  const [mailboxActionPending, setMailboxActionPending] = useState(false)
  const [starredMessages, setStarredMessages] = useState<MessageSummary[]>([])
  const [starredSelectedMessage, setStarredSelectedMessage] =
    useState<SelectedMessage | null>(null)
  const [starredLoading, setStarredLoading] = useState(false)
  const [starredStatus, setStarredStatus] = useState<StatusValue>({
    message: '',
  })
  const [starPendingKeys, setStarPendingKeys] = useState<string[]>([])
  const mainRef = useRef<HTMLElement>(null)
  const mailboxLoadController = useRef<AbortController | null>(null)
  const starredLoadController = useRef<AbortController | null>(null)

  const expireSession = useCallback(() => {
    mailboxLoadController.current?.abort()
    starredLoadController.current?.abort()
    setSession(null)
    setAuthentication('expired')
    setAccessStatus({
      message: 'Your session has expired. Sign in again to continue.',
      state: 'expired',
    })
    setView('mailboxes')
    setSelectedMailboxes([])
    setMessages([])
    setStarredMessages([])
    setStarredSelectedMessage(null)
    setStarPendingKeys([])
    setSelectedMessage(null)
    setInspectorEmptyMessage('Select a message to read it.')
    replaceLocation()
  }, [])

  const loadStarred = useCallback(async () => {
    starredLoadController.current?.abort()
    const controller = new AbortController()
    starredLoadController.current = controller
    setStarredLoading(true)
    setStarredStatus({ message: 'Loading starred messages.', state: 'loading' })
    try {
      const result = await api.starredMessages(controller.signal)
      if (!Array.isArray(result)) throw new ApiError(422, 'invalid_response')
      setStarredMessages(result)
      setStarredStatus({
        message: `${result.length} starred ${result.length === 1 ? 'message' : 'messages'}.`,
        state: 'authenticated',
      })
    } catch (error) {
      if (isAbort(error)) return
      if (isUnauthorized(error)) return expireSession()
      setStarredStatus({
        message: 'Starred messages could not be loaded. Please try again.',
        state: 'error',
      })
    } finally {
      if (starredLoadController.current === controller) {
        starredLoadController.current = null
        setStarredLoading(false)
      }
    }
  }, [expireSession])

  const refreshCatalogs = useCallback(
    async (signal?: AbortSignal, showLoading = false) => {
      if (showLoading) setCatalogLoading(true)
      const [activeResult, archivedResult] = await Promise.allSettled([
        api.activeMailboxes(signal),
        api.archivedMailboxes(signal),
      ])
      if (signal?.aborted) return

      for (const result of [activeResult, archivedResult]) {
        if (result.status === 'rejected' && isUnauthorized(result.reason)) {
          expireSession()
          return
        }
      }

      if (
        activeResult.status === 'fulfilled' &&
        validActiveMailboxes(activeResult.value)
      ) {
        setMailboxes(activeResult.value)
        setCatalogError('')
      } else if (
        activeResult.status === 'rejected' &&
        !isAbort(activeResult.reason)
      ) {
        setCatalogError(
          'The saved mailbox catalog could not be loaded. Please try again.',
        )
      } else if (activeResult.status === 'fulfilled') {
        setCatalogError('The saved mailbox catalog response was invalid.')
      }

      if (
        archivedResult.status === 'fulfilled' &&
        validArchivedMailboxes(archivedResult.value)
      ) {
        setArchivedMailboxes(archivedResult.value)
        setArchivedCatalogError('')
      } else if (
        archivedResult.status === 'rejected' &&
        !isAbort(archivedResult.reason)
      ) {
        setArchivedCatalogError(
          'The archived mailbox catalog could not be loaded. Please try again.',
        )
      } else if (archivedResult.status === 'fulfilled') {
        setArchivedCatalogError(
          'The archived mailbox catalog response was invalid.',
        )
      }

      if (showLoading) setCatalogLoading(false)
    },
    [expireSession],
  )

  const loadMailboxes = useCallback(
    async (requestedMailboxes: string[], requestedMessageId = '') => {
      const names = normalizeMailboxNames(requestedMailboxes)
      mailboxLoadController.current?.abort()
      const controller = new AbortController()
      mailboxLoadController.current = controller
      setSelectedMailboxes(names)
      setSelectedMessage(null)
      setInspectorEmptyMessage('Select a message to read it.')
      setMessages([])
      replaceLocation(names.length === 1 ? names[0] : '')

      if (!names.length) {
        setMailboxLoading(false)
        setMailboxStatus(defaultMailboxStatus)
        setInspectorEmptyMessage(
          'Select one or more mailboxes to read messages.',
        )
        return
      }

      setMailboxLoading(true)
      setMailboxStatus({
        message: `Loading ${names.length === 1 ? names[0] : `${names.length} mailboxes`}.`,
        state: 'loading',
      })

      const results = await Promise.all(
        names.map(async (mailbox) => {
          try {
            const value = await api.mailbox(mailbox, controller.signal)
            if (!Array.isArray(value))
              throw new ApiError(422, 'invalid_response')
            return { mailbox, messages: value }
          } catch (error) {
            return { mailbox, error }
          }
        }),
      )

      if (
        controller.signal.aborted ||
        mailboxLoadController.current !== controller
      )
        return
      const unauthorized = results.find(
        (result) => 'error' in result && isUnauthorized(result.error),
      )
      if (unauthorized) {
        expireSession()
        return
      }

      const failed = results.filter(
        (result): result is { mailbox: string; error: unknown } =>
          'error' in result,
      )
      const loadedMessages = results.flatMap((result) =>
        'messages' in result && result.messages
          ? result.messages.map((message) => ({
              ...message,
              mailbox: result.mailbox,
            }))
          : [],
      )
      setMessages(loadedMessages)
      setMailboxLoading(false)
      const summary = `${loadedMessages.length} ${
        loadedMessages.length === 1 ? 'message' : 'messages'
      } in ${names.length === 1 ? names[0] : `${names.length} mailboxes`}.`
      setMailboxStatus({
        message: failed.length
          ? `${summary} ${failed
              .map((result) =>
                visibleError(result.error, `The mailbox ${result.mailbox}`),
              )
              .join(' ')}`
          : summary,
        state: failed.length ? 'error' : 'authenticated',
      })
      void refreshCatalogs()

      if (requestedMessageId) {
        const selected = loadedMessages.find(
          (message) => String(message.id) === requestedMessageId,
        )
        if (selected) {
          const value = { mailbox: selected.mailbox, id: String(selected.id) }
          setSelectedMessage(value)
          replaceLocation(value.mailbox, value.id)
        }
      }
    },
    [expireSession, refreshCatalogs],
  )

  useEffect(() => {
    const controller = new AbortController()
    const restore = async () => {
      try {
        const restoredSession = await api.session(controller.signal)
        if (controller.signal.aborted) return
        setSession(restoredSession)
        setAuthentication('authenticated')
        setAccessStatus({ message: '' })
        await refreshCatalogs(controller.signal, true)
        if (controller.signal.aborted) return
        const url = new URL(window.location.href)
        const mailbox = url.searchParams.get('mailbox') || ''
        const message = url.searchParams.get('message') || ''
        if (mailbox) await loadMailboxes([mailbox], message)
        else setMailboxStatus(defaultMailboxStatus)
      } catch (error) {
        if (isAbort(error)) return
        if (isUnauthorized(error)) {
          setAuthentication('signed-out')
          setAccessStatus({
            message: 'Sign in to browse Inbucket mailboxes.',
            state: 'signed-out',
          })
        } else {
          setAuthentication('unavailable')
          setAccessStatus({
            message: 'The application is unavailable. Please try again later.',
            state: 'error',
          })
        }
      }
    }
    void restore()
    return () => {
      controller.abort()
      mailboxLoadController.current?.abort()
      starredLoadController.current?.abort()
    }
  }, [loadMailboxes, refreshCatalogs])

  useEffect(() => {
    if (authentication !== 'authenticated') return
    const interval = window.setInterval(() => void refreshCatalogs(), 15000)
    return () => window.clearInterval(interval)
  }, [authentication, refreshCatalogs])

  useEffect(() => {
    if (authentication === 'authenticated' && view === 'starred') {
      void loadStarred()
    }
  }, [authentication, loadStarred, view])

  useEffect(() => {
    if (authentication !== 'authenticated') return
    const targetId =
      view === 'monitor'
        ? 'monitor-title'
        : view === 'starred'
          ? 'starred-title'
          : view === 'archive'
            ? 'archived-mailboxes-title'
            : 'mailbox-title'
    document.getElementById(targetId)?.focus()
  }, [authentication, view])

  const login = async (username: string, password: string) => {
    setAuthentication('authenticating')
    setAccessStatus({ message: 'Signing in.', state: 'loading' })
    try {
      const authenticatedSession = await api.login(username, password)
      setSession(authenticatedSession)
      setAuthentication('authenticated')
      setAccessStatus({ message: '' })
      await refreshCatalogs(undefined, true)
      const url = new URL(window.location.href)
      const mailbox = url.searchParams.get('mailbox') || ''
      const message = url.searchParams.get('message') || ''
      if (mailbox) await loadMailboxes([mailbox], message)
      else setMailboxStatus(defaultMailboxStatus)
      mainRef.current?.focus()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAuthentication('signed-out')
        setAccessStatus({
          message: 'The username or password is incorrect.',
          state: 'error',
        })
      } else {
        setAuthentication('unavailable')
        setAccessStatus({
          message: 'Sign-in is temporarily unavailable. Please try again.',
          state: 'error',
        })
      }
    }
  }

  const signOut = async () => {
    setSigningOut(true)
    try {
      await api.logout()
      setSession(null)
      setAuthentication('signed-out')
      setAccessStatus({ message: 'You have signed out.', state: 'signed-out' })
      setView('mailboxes')
      setSelectedMailboxes([])
      setMessages([])
      setStarredMessages([])
      setStarredSelectedMessage(null)
      setStarPendingKeys([])
      setSelectedMessage(null)
      replaceLocation()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setSession(null)
        setAuthentication('signed-out')
        setAccessStatus({
          message: 'You have signed out.',
          state: 'signed-out',
        })
        replaceLocation()
      } else {
        setMailboxStatus({
          message: 'Sign-out could not be completed. Please try again.',
          state: 'error',
        })
      }
    } finally {
      setSigningOut(false)
    }
  }

  const selectMessage = (mailbox: string, id: string) => {
    const selected = { mailbox, id }
    setSelectedMessage(selected)
    setInspectorEmptyMessage('Select a message to read it.')
    replaceLocation(mailbox, id)
  }

  const markRead = useCallback((mailbox: string, id: string) => {
    setMessages((current) =>
      current.map((message) =>
        message.mailbox === mailbox && String(message.id) === id
          ? { ...message, seen: true }
          : message,
      ),
    )
    setStarredMessages((current) =>
      current.map((message) =>
        message.mailbox === mailbox && String(message.id) === id
          ? { ...message, seen: true }
          : message,
      ),
    )
  }, [])

  const changeStarred = useCallback(
    async (mailbox: string, id: string, starred: boolean) => {
      const key = messageKey(mailbox, id)
      if (starPendingKeys.includes(key)) return
      setStarPendingKeys((current) =>
        current.includes(key) ? current : [...current, key],
      )
      setMessages((current) =>
        current.map((message) =>
          message.mailbox === mailbox && String(message.id) === id
            ? { ...message, starred }
            : message,
        ),
      )
      try {
        const result = await api.setStarred(mailbox, id, starred)
        if (result.starred !== starred || (starred && !result.message)) {
          throw new ApiError(422, 'invalid_response')
        }
        if (starred && result.message) {
          setStarredMessages((current) => [
            result.message as MessageSummary,
            ...current.filter(
              (message) =>
                message.mailbox !== mailbox || String(message.id) !== id,
            ),
          ])
        } else {
          if (view === 'starred')
            document.getElementById('starred-title')?.focus()
          setStarredMessages((current) =>
            current.filter(
              (message) =>
                message.mailbox !== mailbox || String(message.id) !== id,
            ),
          )
          setStarredSelectedMessage((current) =>
            current?.mailbox === mailbox && current.id === id ? null : current,
          )
        }
        setMailboxStatus((current) =>
          current.message === 'The star could not be updated. Please try again.'
            ? { message: 'Star updated.', state: 'authenticated' }
            : current,
        )
        if (view === 'starred') {
          setStarredStatus({
            message: starred
              ? 'Message starred.'
              : 'Message removed from Starred.',
            state: 'authenticated',
          })
        }
      } catch (error) {
        setMessages((current) =>
          current.map((message) =>
            message.mailbox === mailbox && String(message.id) === id
              ? { ...message, starred: !starred }
              : message,
          ),
        )
        if (isUnauthorized(error)) expireSession()
        else {
          const status = {
            message: 'The star could not be updated. Please try again.',
            state: 'error',
          } as const
          if (view === 'starred') setStarredStatus(status)
          else setMailboxStatus(status)
        }
      } finally {
        setStarPendingKeys((current) =>
          current.filter((candidate) => candidate !== key),
        )
      }
    },
    [expireSession, starPendingKeys, view],
  )

  const starPending = useCallback(
    (mailbox: string, id: string) =>
      starPendingKeys.includes(messageKey(mailbox, id)),
    [starPendingKeys],
  )

  const messageDeleted = async () => {
    setSelectedMessage(null)
    replaceLocation(selectedMailboxes.length === 1 ? selectedMailboxes[0] : '')
    await loadMailboxes(selectedMailboxes)
    setInspectorEmptyMessage('Message deleted.')
  }

  const starredMessageDeleted = async () => {
    if (!starredSelectedMessage) return
    const deleted = starredSelectedMessage
    setStarredSelectedMessage(null)
    setStarredMessages((current) =>
      current.filter(
        (message) =>
          message.mailbox !== deleted.mailbox ||
          String(message.id) !== deleted.id,
      ),
    )
    setStarredStatus({ message: 'Message deleted.', state: 'authenticated' })
  }

  const performMailboxAction = async (action: 'archive' | 'delete') => {
    if (!selectedMailboxes.length) {
      setMailboxStatus({
        message: `Select at least one mailbox to ${
          action === 'delete' ? 'delete' : 'archive'
        }.`,
        state: 'error',
      })
      return
    }
    if (
      action === 'delete' &&
      !window.confirm(
        `Permanently delete all messages in ${
          selectedMailboxes.length === 1
            ? selectedMailboxes[0]
            : `${selectedMailboxes.length} selected mailboxes`
        } and remove them from saved mailboxes?`,
      )
    ) {
      return
    }

    setMailboxActionPending(true)
    const results = await Promise.all(
      selectedMailboxes.map(async (mailbox) => {
        try {
          if (action === 'delete') await api.purgeMailbox(mailbox)
          else await api.archiveMailbox(mailbox)
          return { mailbox, completed: true as const }
        } catch (error) {
          return { mailbox, completed: false as const, error }
        }
      }),
    )
    const unauthorized = results.find(
      (result) => !result.completed && isUnauthorized(result.error),
    )
    if (unauthorized) {
      setMailboxActionPending(false)
      expireSession()
      return
    }

    const completed = results.filter((result) => result.completed)
    const failed = results.filter((result) => !result.completed)
    const remaining = failed.map((result) => result.mailbox)
    setSelectedMailboxes(remaining)
    await refreshCatalogs(undefined, true)
    await loadMailboxes(remaining)
    const pastTense = action === 'delete' ? 'Deleted' : 'Archived'
    const failureVerb = action === 'delete' ? 'deleted' : 'archived'
    setMailboxStatus({
      message: failed.length
        ? `${pastTense} ${completed.length} mailboxes. ${failed.length} mailboxes could not be ${failureVerb}.`
        : `${pastTense} ${completed.length} mailboxes.`,
      state: failed.length ? 'error' : 'authenticated',
    })
    setMailboxActionPending(false)
  }

  const restoreMailbox = async (mailbox: string) => {
    await api.restoreMailbox(mailbox)
    await refreshCatalogs(undefined, true)
  }

  const openMonitorMessage = async (message: MonitorSummary) => {
    setView('mailboxes')
    const names = normalizeMailboxNames([...selectedMailboxes, message.mailbox])
    await loadMailboxes(names, String(message.id))
  }

  const selectStarredMessage = (mailbox: string, id: string) => {
    setStarredSelectedMessage({ mailbox, id })
  }

  const authenticated = authentication === 'authenticated' && Boolean(session)
  const activeMailboxSummary =
    selectedMailboxes.length === 0
      ? 'No mailbox selected'
      : selectedMailboxes.length === 1
        ? selectedMailboxes[0]
        : `${selectedMailboxes.length} mailboxes`
  const displayedMailboxStatus: StatusValue = catalogError
    ? { message: catalogError, state: 'error' }
    : catalogLoading
      ? { message: 'Loading saved mailboxes.', state: 'loading' }
      : mailboxStatus

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <AppHeader
        authenticated={authenticated}
        view={view}
        signingOut={signingOut}
        onViewChange={setView}
        onSignOut={() => void signOut()}
      />
      <main
        ref={mainRef}
        id="main-content"
        className="container inbucket-main"
        tabIndex={-1}
      >
        {!authenticated ? (
          <AccessScreen
            authentication={authentication}
            status={accessStatus}
            onLogin={login}
          />
        ) : (
          <div>
            <MonitorView
              active={view === 'monitor'}
              onUnauthorized={expireSession}
              onOpenMessage={openMonitorMessage}
            />
            <StarredView
              active={view === 'starred'}
              messages={starredMessages}
              selected={starredSelectedMessage}
              loading={starredLoading}
              status={starredStatus}
              onSelectMessage={selectStarredMessage}
              onUnauthorized={expireSession}
              onRead={markRead}
              starPending={starPending}
              onStarChange={changeStarred}
              onDeleted={starredMessageDeleted}
            />
            <ArchivedView
              active={view === 'archive'}
              mailboxes={archivedMailboxes}
              loading={catalogLoading}
              catalogError={archivedCatalogError}
              onRestore={restoreMailbox}
              onUnauthorized={expireSession}
            />
            <div hidden={view !== 'mailboxes'}>
              <div className="mailbox-toolbar">
                <div className="mailbox-context">
                  <strong>{activeMailboxSummary}</strong>
                  <StatusMessage
                    value={displayedMailboxStatus}
                    className="mailbox-status"
                  />
                </div>
                <MailboxTools
                  mailboxes={mailboxes}
                  selectedMailboxes={selectedMailboxes}
                  actionPending={mailboxActionPending}
                  onAdd={async (mailbox) =>
                    loadMailboxes(
                      normalizeMailboxNames([...selectedMailboxes, mailbox]),
                    )
                  }
                  onSelectionChange={(names) => void loadMailboxes(names)}
                  onArchive={() => void performMailboxAction('archive')}
                  onDelete={() => void performMailboxAction('delete')}
                />
              </div>
              <MessageWorkspace
                messages={messages}
                selected={selectedMessage}
                loading={mailboxLoading}
                listEmptyMessage={
                  selectedMailboxes.length
                    ? 'This mailbox has no messages.'
                    : 'Select one or more mailboxes to read messages.'
                }
                inspectorEmptyMessage={inspectorEmptyMessage}
                onSelectMessage={selectMessage}
                onUnauthorized={expireSession}
                onRead={markRead}
                starPending={starPending}
                onStarChange={changeStarred}
                onDeleted={messageDeleted}
              />
            </div>
          </div>
        )}
      </main>
    </>
  )
}
