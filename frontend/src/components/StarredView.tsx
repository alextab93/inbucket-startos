import type { MessageSummary, SelectedMessage, StatusValue } from '../types'
import { MessageWorkspace } from './MessageWorkspace'
import { StatusMessage } from './StatusMessage'

interface StarredViewProps {
  active: boolean
  messages: MessageSummary[]
  selected: SelectedMessage | null
  loading: boolean
  status: StatusValue
  onSelectMessage: (mailbox: string, id: string) => void
  onUnauthorized: () => void
  onRead: (mailbox: string, id: string) => void
  starPending: (mailbox: string, id: string) => boolean
  onStarChange: (mailbox: string, id: string, starred: boolean) => Promise<void>
  onDeleted: () => Promise<void>
}

export const StarredView = ({
  active,
  messages,
  selected,
  loading,
  status,
  onSelectMessage,
  onUnauthorized,
  onRead,
  starPending,
  onStarChange,
  onDeleted,
}: StarredViewProps) => {
  const mailboxes = [...new Set(messages.map((message) => message.mailbox))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))

  return (
    <section hidden={!active} aria-labelledby="starred-title">
      <div className="starred-heading">
        <div>
          <h2 id="starred-title" tabIndex={-1}>
            Starred
          </h2>
          <p>Messages you starred across all mailboxes.</p>
        </div>
        <StatusMessage value={status} />
      </div>
      <MessageWorkspace
        messages={messages}
        selected={selected}
        loading={loading}
        listEmptyMessage="No starred messages yet."
        inspectorEmptyMessage="Select a starred message to read it."
        controlsId="starred-message"
        headingId="starred-messages-title"
        heading="Starred messages"
        mailboxOptions={mailboxes}
        onSelectMessage={onSelectMessage}
        onUnauthorized={onUnauthorized}
        onRead={onRead}
        starPending={starPending}
        onStarChange={onStarChange}
        onDeleted={onDeleted}
      />
    </section>
  )
}
