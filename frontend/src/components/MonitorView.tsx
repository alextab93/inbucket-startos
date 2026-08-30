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
  Tag,
} from '../types'
import { ListControls } from './ListControls'
import { TagBadges } from './MessageTags'
import { StatusMessage } from './StatusMessage'

interface MonitorViewProps {
  active: boolean
  onUnauthorized: () => void
  onOpenMessage: (message: MonitorSummary) => Promise<void>
  tags: Tag[]
}

export const MonitorView = ({
  active,
  onUnauthorized,
  onOpenMessage,
  tags,
}: MonitorViewProps) => {
  const [messages, setMessages] = useState<MonitorSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<StatusValue>({ message: '' })
  const [search, setSearch] = useState('')
  const [readFilter, setReadFilter] = useState<ReadFilter>('all')
  const [mailbox, setMailbox] = useState('')
  const [tag, setTag] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
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
        setMessages([])
        setStatus({ message: 'Loading monitored messages.', state: 'loading' })
      }
      try {
        const result = await api.monitorMessages(
          dateFrom,
          dateTo,
          current.signal,
        )
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
  }, [active, dateFrom, dateTo, onUnauthorized])

  useEffect(() => {
    if (tag && !tags.some((value) => String(value.id) === tag)) setTag('')
  }, [tag, tags])

  const mailboxes = [...new Set(messages.map((message) => message.mailbox))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
  const visibleMessages = sortMessages(
    filterMessages(
      messages,
      search,
      readFilter,
      mailbox,
      tag,
      dateFrom,
      dateTo,
    ),
    sort,
  )

  return (
    <section
      className="monitor-view"
      aria-labelledby="monitor-title"
      hidden={!active}
      aria-busy={loading}
    >
      <div className="message-list-heading monitor-list-heading">
        <h2 id="monitor-title" tabIndex={-1}>
          Realtime
        </h2>
        <ListControls
          id="monitor"
          search={search}
          readFilter={readFilter}
          mailbox={mailbox}
          mailboxOptions={mailboxes}
          tag={tag}
          tags={tags}
          dateFrom={dateFrom}
          dateTo={dateTo}
          sort={sort}
          searchLabel="Search monitored messages"
          searchPlaceholder="Search monitored messages"
          triggerLabel="Filter and sort monitored messages"
          onSearchChange={setSearch}
          onReadFilterChange={setReadFilter}
          onMailboxChange={setMailbox}
          onTagChange={setTag}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onDateRangeClear={() => {
            setDateFrom('')
            setDateTo('')
          }}
          onSortChange={setSort}
        />
      </div>
      <div className="monitor-status-row">
        <p>Recent deliveries. Message bodies are not stored here.</p>
        <StatusMessage value={status} />
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
            {emptyListText('monitored messages', search, readFilter, mailbox)}
          </p>
        ) : null}
        {visibleMessages.map((message) => {
          const read = message.seen === true
          const date = dateText(message.date)
          const sender = formatValue(message.from) || 'Unknown sender'
          const subject = formatValue(message.subject) || '(No subject)'
          const tags = message.tags?.map((tag) => tag.name).join(', ')
          const summary = `${subject}, ${sender}, ${message.mailbox}, ${date}${tags ? `, tags: ${tags}` : ''}`
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
              <span className="monitor-message-subject">
                <span>{subject}</span>
                <TagBadges tags={message.tags || []} maxVisible={1} />
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
