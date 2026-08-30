import { useEffect, useState } from 'react'
import { api, isAbort, isUnauthorized } from '../api'
import {
  dateText,
  emptyListText,
  filterMessages,
  formatValue,
  sortMessages,
} from '../formatting'
import type {
  ListSort,
  MonitorSummary,
  ReadFilter,
  StatusValue,
} from '../types'
import { ListControls } from './ListControls'
import { StatusMessage } from './StatusMessage'

interface MonitorViewProps {
  active: boolean
  onUnauthorized: () => void
  onOpenMessage: (message: MonitorSummary) => Promise<void>
}

export const MonitorView = ({
  active,
  onUnauthorized,
  onOpenMessage,
}: MonitorViewProps) => {
  const [messages, setMessages] = useState<MonitorSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<StatusValue>({ message: '' })
  const [search, setSearch] = useState('')
  const [readFilter, setReadFilter] = useState<ReadFilter>('all')
  const [sort, setSort] = useState<ListSort>('newest')

  useEffect(() => {
    if (!active) return
    let controller: AbortController | null = null
    let disposed = false

    const refresh = async (initial = false) => {
      controller?.abort()
      controller = new AbortController()
      const current = controller
      if (initial) {
        setLoading(true)
        setStatus({ message: 'Loading monitored messages.', state: 'loading' })
      }
      try {
        const result = await api.monitorMessages(current.signal)
        if (!Array.isArray(result) || disposed || controller !== current) return
        setMessages(result)
        setStatus({
          message: `Updated ${new Intl.DateTimeFormat('en', {
            timeStyle: 'medium',
          }).format(new Date())}.`,
          state: 'authenticated',
        })
      } catch (error) {
        if (isAbort(error) || disposed) return
        if (isUnauthorized(error)) return onUnauthorized()
        setStatus({
          message: 'The monitor could not be loaded. Please try again.',
          state: 'error',
        })
      } finally {
        if (!disposed && controller === current) setLoading(false)
      }
    }

    void refresh(true)
    const interval = window.setInterval(() => void refresh(), 3000)
    return () => {
      disposed = true
      controller?.abort()
      window.clearInterval(interval)
    }
  }, [active, onUnauthorized])

  const visibleMessages = sortMessages(
    filterMessages(messages, search, readFilter),
    sort,
  )

  return (
    <section
      className="monitor-view"
      aria-labelledby="monitor-title"
      hidden={!active}
      aria-busy={loading}
    >
      <div className="monitor-heading">
        <div>
          <h2 id="monitor-title" tabIndex={-1}>
            Realtime monitor
          </h2>
          <p>
            Recent deliveries from the Inbucket monitor. Message bodies are not
            stored here.
          </p>
        </div>
        <StatusMessage value={status} />
      </div>
      <div className="monitor-tools">
        <ListControls
          id="monitor"
          search={search}
          readFilter={readFilter}
          mailbox=""
          mailboxOptions={[]}
          sort={sort}
          searchLabel="Search monitored messages"
          searchPlaceholder="Search monitored messages"
          triggerLabel="Filter and sort monitored messages"
          onSearchChange={setSearch}
          onReadFilterChange={setReadFilter}
          onMailboxChange={() => undefined}
          onSortChange={setSort}
        />
      </div>
      <div className="monitor-message-list">
        {loading && !messages.length ? (
          <p className="monitor-message-empty">Loading monitored messages.</p>
        ) : null}
        {!loading && !messages.length ? (
          <p className="monitor-message-empty">
            No messages have arrived since monitoring began.
          </p>
        ) : null}
        {messages.length > 0 && visibleMessages.length === 0 ? (
          <p className="monitor-message-empty">
            {emptyListText('monitored messages', search, readFilter)}
          </p>
        ) : null}
        {visibleMessages.map((message) => {
          const read = message.seen === true
          const date = dateText(message.date)
          const sender = formatValue(message.from) || 'Unknown sender'
          const subject = formatValue(message.subject) || '(No subject)'
          const summary = `${subject}, ${sender}, ${message.mailbox}, ${date}`
          return (
            <button
              key={`${message.mailbox}\u0000${message.id}`}
              type="button"
              className={`monitor-message ${read ? 'read' : 'unread'}`}
              aria-label={`${read ? 'Read' : 'Unread'}: ${summary}`}
              onClick={() => void onOpenMessage(message)}
            >
              <span>{date}</span>
              <span>{sender}</span>
              <span>{message.mailbox}</span>
              <span className="monitor-message-subject">{subject}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
