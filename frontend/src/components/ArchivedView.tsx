import { useState } from 'react'
import { isUnauthorized, visibleError } from '../api'
import type { ArchivedMailbox, StatusValue } from '../types'
import { StatusMessage } from './StatusMessage'

interface ArchivedViewProps {
  active: boolean
  mailboxes: ArchivedMailbox[]
  loading: boolean
  catalogError: string
  onRestore: (mailbox: string) => Promise<void>
  onUnauthorized: () => void
}

export const ArchivedView = ({
  active,
  mailboxes,
  loading,
  catalogError,
  onRestore,
  onUnauthorized,
}: ArchivedViewProps) => {
  const [restoring, setRestoring] = useState<string | null>(null)
  const [restoreStatus, setRestoreStatus] = useState<StatusValue>({
    message: '',
  })

  const restore = async (mailbox: string) => {
    setRestoring(mailbox)
    setRestoreStatus({ message: `Restoring ${mailbox}.`, state: 'loading' })
    try {
      await onRestore(mailbox)
      setRestoreStatus({
        message: `Restored ${mailbox}.`,
        state: 'authenticated',
      })
    } catch (error) {
      if (isUnauthorized(error)) return onUnauthorized()
      setRestoreStatus({
        message: visibleError(error, `The mailbox ${mailbox}`),
        state: 'error',
      })
    } finally {
      setRestoring(null)
    }
  }

  return (
    <section
      className="archive-view"
      aria-labelledby="archived-mailboxes-title"
      hidden={!active}
      aria-busy={loading}
    >
      <h2 id="archived-mailboxes-title" tabIndex={-1}>
        Archived mailboxes
      </h2>
      <p>
        Archived mailboxes remain in Inbucket but are hidden from the main
        mailbox selector. Restore is non-destructive. Delete selected
        permanently purges messages and requires confirmation.
      </p>
      <StatusMessage
        value={{
          message:
            catalogError || (loading ? 'Loading archived mailboxes.' : ''),
          state: catalogError ? 'error' : loading ? 'loading' : undefined,
        }}
      />
      <StatusMessage value={restoreStatus} />
      <div className="archived-mailbox-options">
        {!loading && !catalogError && !mailboxes.length ? (
          <p className="mailbox-options-empty">No archived mailboxes.</p>
        ) : null}
        {mailboxes.map((mailbox) => (
          <div className="archived-mailbox-option" key={mailbox.name}>
            <div>
              <strong>{mailbox.name}</strong>
              <p>
                {mailbox.message_count === null
                  ? 'Message count unavailable.'
                  : `${mailbox.message_count} ${
                      mailbox.message_count === 1 ? 'message' : 'messages'
                    }.`}
              </p>
            </div>
            <button
              className="button button-secondary"
              type="button"
              disabled={restoring === mailbox.name}
              onClick={() => void restore(mailbox.name)}
            >
              Restore
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
