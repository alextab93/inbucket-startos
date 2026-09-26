import type {
  NotificationDestination,
  NotificationDestinationMethod,
} from '../../types'
import {
  destinationMethodName,
  destinationMethodSummary,
  destinationTestPreview,
} from './destinationPresentation'

interface DestinationListProps {
  destinations: NotificationDestination[]
  expandedId: number | null
  testingMethod: string
  onToggle: (id: number | null) => void
  onTest: (
    destination: NotificationDestination,
    method: NotificationDestinationMethod,
  ) => void
  onEdit: (destination: NotificationDestination) => void
  onDelete: (destination: NotificationDestination) => void
}

export const DestinationList = ({
  destinations,
  expandedId,
  testingMethod,
  onToggle,
  onTest,
  onEdit,
  onDelete,
}: DestinationListProps) => {
  if (!destinations.length) {
    return (
      <p className="notification-empty">
        No destinations yet. Create one to send notifications outside Inbucket.
      </p>
    )
  }

  return (
    <ul className="notification-destination-list">
      {destinations.map((destination) => {
        const expanded = expandedId === destination.id
        const panelId = `notification-destination-${destination.id}`
        return (
          <li key={destination.id} className={expanded ? 'is-open' : ''}>
            <button
              className="notification-destination-summary"
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => onToggle(expanded ? null : destination.id)}
            >
              <span className="notification-destination-identity">
                <strong>{destination.name}</strong>
                <span className="notification-destination-badges">
                  {destination.methods.map((method) => (
                    <span key={method.kind}>
                      {destinationMethodName(method.kind)}
                    </span>
                  ))}
                </span>
              </span>
              <span
                className="notification-destination-chevron"
                aria-hidden="true"
              />
            </button>
            {expanded ? (
              <div id={panelId} className="notification-destination-body">
                <p>
                  Review each configured method and send a safe test before using
                  this destination in a rule.
                </p>
                <div className="notification-destination-methods">
                  {destination.methods.map((method) => {
                    const label = destinationMethodName(method.kind)
                    const testKey = `${destination.id}:${method.kind}`
                    const testing = testingMethod === testKey
                    return (
                      <section
                        key={method.kind}
                        className="notification-destination-method"
                        aria-labelledby={`${panelId}-${method.kind}`}
                      >
                        <div className="notification-destination-method-heading">
                          <div>
                            <h4 id={`${panelId}-${method.kind}`}>{label}</h4>
                            <p>{destinationMethodSummary(method)}</p>
                            {method.kind === 'webhook' ? (
                              <span>
                                {method.headers.length
                                  ? `${method.headers.length} custom ${method.headers.length === 1 ? 'header' : 'headers'}`
                                  : 'No custom headers'}
                                {' · '}
                                {method.body
                                  ? 'Configured request body'
                                  : 'Generated JSON body'}
                              </span>
                            ) : null}
                          </div>
                          <button
                            className="button button-secondary"
                            type="button"
                            aria-label={`Send ${label} test`}
                            disabled={Boolean(testingMethod)}
                            onClick={() => onTest(destination, method)}
                          >
                            {testing ? 'Sending test' : 'Send test'}
                          </button>
                        </div>
                        <div className="notification-test-preview">
                          <strong>
                            {method.kind === 'webhook'
                              ? 'Request body preview'
                              : 'Message preview'}
                          </strong>
                          {method.kind !== 'webhook' ? (
                            <span>Inbucket test notification</span>
                          ) : null}
                          <pre>
                            {destinationTestPreview(destination, method)}
                          </pre>
                        </div>
                      </section>
                    )
                  })}
                </div>
                <div className="notification-destination-actions">
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => onEdit(destination)}
                  >
                    Edit
                  </button>
                  <button
                    className="button button-danger"
                    type="button"
                    onClick={() => onDelete(destination)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
