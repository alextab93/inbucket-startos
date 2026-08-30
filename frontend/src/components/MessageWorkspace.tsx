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
import { StarButton } from './StarButton'
import { MessageInspector } from './MessageInspector'

interface MessageWorkspaceProps {
  messages: MessageSummary[]
  selected: SelectedMessage | null
  loading: boolean
  listEmptyMessage: string
  inspectorEmptyMessage: string
  controlsId?: string
  headingId?: string
  heading?: string
  mailboxOptions?: string[]
  onSelectMessage: (mailbox: string, id: string) => void
  onUnauthorized: () => void
  onRead: (mailbox: string, id: string) => void
  starPending: (mailbox: string, id: string) => boolean
  onStarChange: (mailbox: string, id: string, starred: boolean) => Promise<void>
  onDeleted: () => Promise<void>
}

export const MessageWorkspace = ({
  messages,
  selected,
  loading,
  listEmptyMessage,
  inspectorEmptyMessage,
  controlsId = 'message',
  headingId = 'mailbox-title',
  heading = 'Messages',
  mailboxOptions = [],
  onSelectMessage,
  onUnauthorized,
  onRead,
  starPending,
  onStarChange,
  onDeleted,
}: MessageWorkspaceProps) => {
  const [search, setSearch] = useState('')
  const [readFilter, setReadFilter] = useState<ReadFilter>('all')
  const [mailbox, setMailbox] = useState('')
  const [sort, setSort] = useState<ListSort>('newest')
  const visibleMessages = sortMessages(
    filterMessages(messages, search, readFilter, mailbox),
    sort,
  )
  const selectedMessage = selected
    ? messages.find(
        (message) =>
          message.mailbox === selected.mailbox &&
          String(message.id) === selected.id,
      )
    : undefined

  return (
    <div className="mailbox-layout">
      <section className="message-list-panel" aria-labelledby={headingId}>
        <div className="message-list-heading">
          <h2 id={headingId} tabIndex={-1}>
            {heading}
          </h2>
          <ListControls
            id={controlsId}
            search={search}
            readFilter={readFilter}
            mailbox={mailbox}
            mailboxOptions={mailboxOptions}
            sort={sort}
            searchLabel="Search messages"
            searchPlaceholder="Search messages"
            triggerLabel="Filter and sort messages"
            onSearchChange={setSearch}
            onReadFilterChange={setReadFilter}
            onMailboxChange={setMailbox}
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
              {emptyListText('messages', search, readFilter, mailbox)}
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
                  <div
                    key={`${message.mailbox}\u0000${id}`}
                    className={`message-summary ${read ? 'read' : 'unread'}${current ? ' selected' : ''}`}
                  >
                    <button
                      type="button"
                      className="message-summary-open"
                      aria-label={`${read ? 'Read' : 'Unread'}: ${summary}`}
                      aria-current={current ? 'true' : undefined}
                      onClick={() => onSelectMessage(message.mailbox, id)}
                    >
                      <strong>
                        {formatValue(message.subject) || '(No subject)'}
                      </strong>
                      <span>
                        {formatValue(message.from) || 'Unknown sender'}
                      </span>
                      <time>{dateText(message.date)}</time>
                    </button>
                    <StarButton
                      starred={message.starred === true}
                      label={formatValue(message.subject) || '(No subject)'}
                      pending={starPending(message.mailbox, id)}
                      className="message-summary-star"
                      onChange={(starred) =>
                        void onStarChange(message.mailbox, id, starred)
                      }
                    />
                  </div>
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
        starred={selectedMessage?.starred === true}
        starPending={
          selected ? starPending(selected.mailbox, selected.id) : false
        }
        onStarChange={onStarChange}
        onDeleted={onDeleted}
      />
    </div>
  )
}
