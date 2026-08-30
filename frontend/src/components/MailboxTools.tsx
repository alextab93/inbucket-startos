import { useEffect, useRef, useState, type FormEvent } from 'react'

type ToolName = 'add' | 'manage'

interface MailboxToolsProps {
  mailboxes: string[]
  selectedMailboxes: string[]
  liveAllMailboxes: boolean
  actionPending: boolean
  onAdd: (mailbox: string) => Promise<void>
  onSelectionChange: (mailboxes: string[]) => void
  onLiveAllMailboxesChange: (enabled: boolean) => void
  onArchive: () => void
  onDelete: () => void
}

export const MailboxTools = ({
  mailboxes,
  selectedMailboxes,
  liveAllMailboxes,
  actionPending,
  onAdd,
  onSelectionChange,
  onLiveAllMailboxesChange,
  onArchive,
  onDelete,
}: MailboxToolsProps) => {
  const [openTool, setOpenTool] = useState<ToolName | null>(null)
  const [mailboxName, setMailboxName] = useState('')
  const addRef = useRef<HTMLDetailsElement>(null)
  const manageRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    if (!openTool) return
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        addRef.current?.contains(target) ||
        manageRef.current?.contains(target)
      )
        return
      setOpenTool(null)
    }
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const details = openTool === 'add' ? addRef.current : manageRef.current
      setOpenTool(null)
      details?.querySelector('summary')?.focus()
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeWithEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeWithEscape)
    }
  }, [openTool])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const mailbox = mailboxName.trim()
    if (!mailbox) return
    setMailboxName('')
    setOpenTool(null)
    await onAdd(mailbox)
    addRef.current?.querySelector('summary')?.focus()
  }

  const toggleMailbox = (mailbox: string, selected: boolean) => {
    const next = new Set(selectedMailboxes)
    if (selected) next.add(mailbox)
    else next.delete(mailbox)
    onSelectionChange([...next])
  }

  return (
    <>
      <label className="mailbox-live-toggle">
        <input
          type="checkbox"
          checked={liveAllMailboxes}
          disabled={actionPending}
          onChange={(event) =>
            onLiveAllMailboxesChange(event.currentTarget.checked)
          }
        />
        <span>Live all active mailboxes</span>
      </label>
      <details
        ref={addRef}
        className="mailbox-tool mailbox-add-tool"
        open={openTool === 'add'}
        onToggle={(event) =>
          setOpenTool(
            event.currentTarget.open
              ? 'add'
              : (current) => (current === 'add' ? null : current),
          )
        }
      >
        <summary>Add mailbox</summary>
        <form className="mailbox-form" onSubmit={submit}>
          <label htmlFor="mailbox-name">Mailbox name</label>
          <div>
            <input
              id="mailbox-name"
              name="mailbox"
              autoComplete="off"
              required
              value={mailboxName}
              onChange={(event) => setMailboxName(event.currentTarget.value)}
            />
            <button className="button button-primary" type="submit">
              Add and open
            </button>
          </div>
        </form>
      </details>
      <details
        ref={manageRef}
        className="mailbox-tool mailbox-manage-tool"
        open={openTool === 'manage'}
        onToggle={(event) =>
          setOpenTool(
            event.currentTarget.open
              ? 'manage'
              : (current) => (current === 'manage' ? null : current),
          )
        }
      >
        <summary aria-label="Manage saved mailboxes">Mailboxes</summary>
        <section
          className="mailbox-selector"
          aria-labelledby="saved-mailboxes-title"
        >
          <div className="mailbox-selector-heading">
            <h2 id="saved-mailboxes-title">Saved mailboxes</h2>
            <div className="mailbox-selector-actions">
              <button
                className="button button-secondary"
                type="button"
                disabled={actionPending}
                onClick={() => onSelectionChange(mailboxes)}
              >
                Select all
              </button>
              <button
                className="button button-secondary"
                type="button"
                disabled={actionPending}
                onClick={() => onSelectionChange([])}
              >
                Clear
              </button>
              <button
                className="button button-secondary"
                type="button"
                disabled={actionPending}
                onClick={onArchive}
              >
                Archive selected
              </button>
              <button
                className="button button-danger"
                type="button"
                disabled={actionPending}
                onClick={onDelete}
              >
                Delete selected
              </button>
            </div>
          </div>
          <div
            className="mailbox-options"
            role="group"
            aria-labelledby="saved-mailboxes-title"
          >
            {mailboxes.length ? (
              mailboxes.map((mailbox) => (
                <label className="mailbox-option" key={mailbox}>
                  <input
                    type="checkbox"
                    value={mailbox}
                    checked={selectedMailboxes.includes(mailbox)}
                    disabled={actionPending}
                    onChange={(event) =>
                      toggleMailbox(mailbox, event.currentTarget.checked)
                    }
                  />
                  <span title={mailbox}>{mailbox}</span>
                </label>
              ))
            ) : (
              <p className="mailbox-options-empty">
                No saved mailboxes yet. Add a mailbox to open it.
              </p>
            )}
          </div>
        </section>
      </details>
    </>
  )
}
