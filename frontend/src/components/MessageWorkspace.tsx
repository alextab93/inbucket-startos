import { useState } from 'react'
import {
  accessibleSummary,
  dateText,
  emptyListText,
  filterMessages,
  formatValue,
  sortMessages,
} from '../formatting'
import type {
  ListSort,
  MessageSummary,
  ReadFilter,
  SelectedMessage,
} from '../types'
import { ListControls } from './ListControls'
import { MessageInspector } from './MessageInspector'

interface MessageWorkspaceProps {
  messages: MessageSummary[]
  selected: SelectedMessage | null
  loading: boolean
  listEmptyMessage: string
  inspectorEmptyMessage: string
  onSelectMessage: (mailbox: string, id: string) => void
  onUnauthorized: () => void
  onRead: (mailbox: string, id: string) => void
  onDeleted: () => Promise<void>
}

export const MessageWorkspace = ({
  messages,
  selected,
  loading,
  listEmptyMessage,
  inspectorEmptyMessage,
  onSelectMessage,
  onUnauthorized,
  onRead,
  onDeleted,
}: MessageWorkspaceProps) => {
  const [search, setSearch] = useState('')
  const [readFilter, setReadFilter] = useState<ReadFilter>('all')
  const [sort, setSort] = useState<ListSort>('newest')
  const visibleMessages = sortMessages(
    filterMessages(messages, search, readFilter),
    sort,
  )

  return (
    <div className="mailbox-layout">
      <section className="message-list-panel" aria-labelledby="mailbox-title">
        <div className="message-list-heading">
          <h2 id="mailbox-title" tabIndex={-1}>
            Messages
          </h2>
          <ListControls
            id="message"
            search={search}
            readFilter={readFilter}
            sort={sort}
            searchLabel="Search messages"
            searchPlaceholder="Search messages"
            triggerLabel="Filter and sort messages"
            onSearchChange={setSearch}
            onReadFilterChange={setReadFilter}
            onSortChange={setSort}
          />
        </div>
        <div className="message-list">
          {loading ? (
            <p className="message-list-empty">Loading messages.</p>
          ) : null}
          {!loading && !messages.length ? (
            <p className="message-list-empty">{listEmptyMessage}</p>
          ) : null}
          {!loading && messages.length > 0 && !visibleMessages.length ? (
            <p className="message-list-empty">
              {emptyListText('messages', search, readFilter)}
            </p>
          ) : null}
          {!loading
            ? visibleMessages.map((message) => {
                const id = String(message.id)
                const read = message.seen === true
                const current =
                  selected?.mailbox === message.mailbox && selected.id === id
                const summary = accessibleSummary(message)
                return (
                  <button
                    key={`${message.mailbox}\u0000${id}`}
                    type="button"
                    className={`message-summary ${read ? 'read' : 'unread'}${current ? ' selected' : ''}`}
                    aria-label={`${read ? 'Read' : 'Unread'}: ${summary}`}
                    aria-current={current ? 'true' : undefined}
                    onClick={() => onSelectMessage(message.mailbox, id)}
                  >
                    <strong>
                      {formatValue(message.subject) || '(No subject)'}
                    </strong>
                    <span>{formatValue(message.from) || 'Unknown sender'}</span>
                    <time>{dateText(message.date)}</time>
                  </button>
                )
              })
            : null}
        </div>
      </section>
      <MessageInspector
        selected={selected}
        emptyMessage={inspectorEmptyMessage}
        onUnauthorized={onUnauthorized}
        onRead={onRead}
        onDeleted={onDeleted}
      />
    </div>
  )
}
