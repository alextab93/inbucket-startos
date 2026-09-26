import { useEffect, useRef, useState } from 'react'
import { ApiError, api, isUnauthorized, visibleError } from '../../api'
import type {
  RuleConditions,
  RuleLuaState,
  MessageRule,
  NotificationDestination,
  NotificationDestinationDefaults,
  NotificationDestinationMethod,
  Tag,
} from '../../types'
import { showToast } from '../../toast'
import { StatusMessage } from '../StatusMessage'
import { MatchPreviewModal } from './MatchPreviewModal'
import { RuleBridgeStatus } from './RuleBridgeStatus'
import { DestinationList } from './DestinationList'
import { DestinationEditor } from './DestinationEditor'
import { RuleList } from './RuleList'
import { RuleBasicsStep } from './RuleBasicsStep'
import { RuleActionsStep } from './RuleActionsStep'
import { RuleMatchStep } from './RuleMatchStep'
import { destinationMethodName } from './destinationPresentation'
import {
  blankRule,
  blankTimeWindow,
  ruleForEditing,
  rulePayload,
  splitCommaSeparated,
  type EditableRule,
  type RulePreview,
} from './ruleForm'

interface RulesViewProps {
  active: boolean
  onUnauthorized: () => void
  mailboxes: string[]
}

const defaultNtfyHost = 'https://ntfy.sh'

const defaultsFromMethods = (
  current: NotificationDestinationDefaults,
  methods: NotificationDestinationMethod[],
): NotificationDestinationDefaults => {
  const ntfy = methods.find((method) => method.kind === 'ntfy')
  const webhook = methods.find((method) => method.kind === 'webhook')
  return {
    ntfy_host: ntfy?.kind === 'ntfy' ? ntfy.host : current.ntfy_host,
    webhook_url:
      webhook?.kind === 'webhook' ? webhook.url : current.webhook_url,
  }
}

export const RulesView = ({
  active,
  onUnauthorized,
  mailboxes,
}: RulesViewProps) => {
  const [rules, setRules] = useState<MessageRule[]>([])
  const [destinations, setDestinations] = useState<NotificationDestination[]>(
    [],
  )
  const [editingDestinationId, setEditingDestinationId] = useState<
    number | null
  >(null)
  const [destinationMethods, setDestinationMethods] = useState<
    NotificationDestinationMethod[]
  >([])
  const [destinationName, setDestinationName] = useState('')
  const [destinationKind, setDestinationKind] = useState<
    'email' | 'ntfy' | 'webhook'
  >('ntfy')
  const [destinationDefaults, setDestinationDefaults] =
    useState<NotificationDestinationDefaults>({})
  const [destinationHost, setDestinationHost] = useState(defaultNtfyHost)
  const [destinationTopic, setDestinationTopic] = useState('')
  const [destinationUrl, setDestinationUrl] = useState('')
  const [destinationMethod, setDestinationMethod] = useState<
    'POST' | 'PUT' | 'PATCH' | 'DELETE'
  >('POST')
  const [destinationBody, setDestinationBody] = useState('')
  const [destinationHeaders, setDestinationHeaders] = useState('[]')
  const [destinationRecipients, setDestinationRecipients] = useState('')
  const [expandedDestinationId, setExpandedDestinationId] = useState<
    number | null
  >(null)
  const [destinationEditorOpen, setDestinationEditorOpen] = useState(false)
  const [testingDestinationMethod, setTestingDestinationMethod] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [lua, setLua] = useState<RuleLuaState | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [rule, setRule] = useState<EditableRule>(blankRule)
  const [ruleStep, setRuleStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<RulePreview | null>(null)
  const previewTriggerRef = useRef<HTMLButtonElement>(null)
  const previewCloseRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!preview) return
    previewCloseRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setPreview(null)
      previewTriggerRef.current?.focus()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [preview])
  const load = async () => {
    setLoading(true)
    try {
      const [ruleResponse, destinationResponse, tagResponse] =
        await Promise.all([
          api.rules(),
          api.notificationDestinations(),
          api.tags(),
        ])
      setRules(ruleResponse.rules)
      setDestinations(destinationResponse.destinations)
      setDestinationDefaults(destinationResponse.defaults)
      if (
        destinationResponse.destinations.length === 0 &&
        editingDestinationId === null
      ) {
        setDestinationEditorOpen(true)
      }
      if (editingDestinationId === null && destinationMethods.length === 0) {
        setDestinationHost(
          destinationResponse.defaults.ntfy_host || defaultNtfyHost,
        )
        setDestinationUrl(destinationResponse.defaults.webhook_url || '')
      }
      setTags(tagResponse)
      setLua(ruleResponse.lua)
      setError('')
    } catch (loadError) {
      if (isUnauthorized(loadError)) return onUnauthorized()
      setError(visibleError(loadError, 'Rules'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (active) void load()
  }, [active])

  const updateRule = (change: Partial<EditableRule>) =>
    setRule((current) => ({ ...current, ...change }))

  const updateConditions = (change: Partial<RuleConditions>) =>
    setRule((current) => ({
      ...current,
      conditions: { ...current.conditions, ...change },
    }))

  const updateTimeWindow = (
    index: number,
    change: Partial<RuleConditions['time_windows'][number]>,
  ) => {
    const windows = rule.conditions.time_windows.length
      ? [...rule.conditions.time_windows]
      : [blankTimeWindow()]
    windows[index] = { ...windows[index], ...change }
    updateConditions({ time_windows: windows })
  }

  const addTimeWindow = () =>
    updateConditions({
      time_windows: [...rule.conditions.time_windows, blankTimeWindow()],
    })

  const removeTimeWindow = (index: number) =>
    updateConditions({
      time_windows: rule.conditions.time_windows.filter(
        (_window, current) => current !== index,
      ),
    })

  const save = async () => {
    setSaving(true)
    setStatus('')
    setError('')
    const payload = rulePayload(rule)
    try {
      const saved = editingId
        ? await api.updateMessageRule(editingId, payload)
        : await api.createMessageRule(payload)
      setRules((current) => {
        const next = current.filter((candidate) => candidate.id !== saved.id)
        return [...next, saved].sort(
          (left, right) =>
            right.priority - left.priority ||
            left.name.localeCompare(right.name),
        )
      })
      setEditingId(null)
      setRule(blankRule())
      setRuleStep(1)
      setPreview(null)
      setStatus('Rule saved.')
      const response = await api.rules()
      setLua(response.lua)
    } catch (saveError) {
      if (isUnauthorized(saveError)) return onUnauthorized()
      setError(visibleError(saveError, 'The rule'))
    } finally {
      setSaving(false)
    }
  }

  const inspect = async () => {
    setSaving(true)
    setError('')
    try {
      setPreview(await api.previewMessageRule(rulePayload(rule)))
    } catch (previewError) {
      if (isUnauthorized(previewError)) return onUnauthorized()
      const message =
        previewError instanceof ApiError && previewError.fields
          ? Object.entries(previewError.fields)
              .flatMap(([field, messages]) =>
                messages.map((detail) => `${field}: ${detail}`),
              )
              .join(' ')
          : visibleError(previewError, 'The notification preview')
      setError(message)
      showToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const duplicate = async (id: number) => {
    try {
      const copied = await api.duplicateMessageRule(id)
      setRules((current) => [...current, copied])
      setStatus('Rule duplicated and disabled.')
    } catch (duplicateError) {
      if (isUnauthorized(duplicateError)) return onUnauthorized()
      setError(visibleError(duplicateError, 'The rule'))
    }
  }

  const remove = async (id: number) => {
    if (!window.confirm('Delete this rule and stop its queued actions?')) return
    try {
      await api.deleteMessageRule(id)
      setRules((current) => current.filter((candidate) => candidate.id !== id))
      if (editingId === id) {
        setEditingId(null)
        setRule(blankRule())
      }
      setStatus('Rule deleted.')
    } catch (removeError) {
      if (isUnauthorized(removeError)) return onUnauthorized()
      setError(visibleError(removeError, 'The rule'))
    }
  }

  const resetDestination = (
    remembered: NotificationDestinationDefaults = destinationDefaults,
    open = false,
  ) => {
    setEditingDestinationId(null)
    setDestinationEditorOpen(open)
    setDestinationName('')
    setDestinationMethods([])
    setDestinationKind('ntfy')
    setDestinationHost(remembered.ntfy_host || defaultNtfyHost)
    setDestinationTopic('')
    setDestinationUrl(remembered.webhook_url || '')
    setDestinationBody('')
    setDestinationHeaders('[]')
    setDestinationRecipients('')
  }

  const selectDestinationMethod = (
    kind: NotificationDestinationMethod['kind'],
    methods = destinationMethods,
  ) => {
    setDestinationKind(kind)
    const method = methods.find((candidate) => candidate.kind === kind)
    if (kind === 'email') {
      setDestinationRecipients(
        method?.kind === 'email' ? method.recipients.join(', ') : '',
      )
    } else if (kind === 'ntfy') {
      setDestinationHost(
        method?.kind === 'ntfy'
          ? method.host
          : destinationDefaults.ntfy_host || defaultNtfyHost,
      )
      setDestinationTopic(method?.kind === 'ntfy' ? method.topic : '')
    } else {
      setDestinationUrl(
        method?.kind === 'webhook'
          ? method.url
          : destinationDefaults.webhook_url || '',
      )
      setDestinationMethod(method?.kind === 'webhook' ? method.method : 'POST')
      setDestinationHeaders(
        method?.kind === 'webhook'
          ? JSON.stringify(method.headers, null, 2)
          : '[]',
      )
      setDestinationBody(method?.kind === 'webhook' ? method.body : '')
    }
  }

  const configuredDestinationMethod = (): NotificationDestinationMethod =>
    destinationKind === 'ntfy'
      ? { kind: 'ntfy', host: destinationHost, topic: destinationTopic }
      : destinationKind === 'webhook'
        ? {
            kind: 'webhook',
            url: destinationUrl,
            method: destinationMethod,
            headers: JSON.parse(destinationHeaders) as Array<{
              name: string
              value: string
            }>,
            body: destinationBody,
          }
        : {
            kind: 'email',
            recipients: splitCommaSeparated(destinationRecipients),
          }

  const addDestinationMethod = () => {
    try {
      const method = configuredDestinationMethod()
      setDestinationMethods((current) => [
        ...current.filter((candidate) => candidate.kind !== method.kind),
        method,
      ])
      showToast(`${method.kind} method added to this destination.`, 'success')
    } catch {
      showToast(
        'Webhook headers must be a JSON list of name and value objects.',
        'error',
      )
    }
  }

  const saveDestination = async () => {
    setSaving(true)
    setError('')
    try {
      const saved = editingDestinationId
        ? await api.updateNotificationDestination(editingDestinationId, {
            name: destinationName,
            methods: destinationMethods,
          })
        : await api.createNotificationDestination({
            name: destinationName,
            methods: destinationMethods,
          })
      setDestinations((current) =>
        [
          ...current.filter((candidate) => candidate.id !== saved.id),
          saved,
        ].sort((left, right) => left.name.localeCompare(right.name)),
      )
      const remembered = defaultsFromMethods(
        destinationDefaults,
        saved.methods,
      )
      setDestinationDefaults(remembered)
      resetDestination(remembered)
      setExpandedDestinationId(saved.id)
      setStatus('Notification destination saved.')
      showToast('Notification destination saved.', 'success')
    } catch (destinationError) {
      if (isUnauthorized(destinationError)) return onUnauthorized()
      const message =
        destinationError instanceof ApiError && destinationError.fields
          ? Object.values(destinationError.fields).flat().join(' ')
          : visibleError(destinationError, 'The notification destination')
      setError(message)
      showToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const editDestination = (destination: NotificationDestination) => {
    setEditingDestinationId(destination.id)
    setDestinationEditorOpen(true)
    setExpandedDestinationId(destination.id)
    setDestinationName(destination.name)
    setDestinationMethods(destination.methods)
    const firstMethod = destination.methods[0]
    if (firstMethod)
      selectDestinationMethod(firstMethod.kind, destination.methods)
  }

  const removeDestination = async (destination: NotificationDestination) => {
    if (
      !window.confirm(
        `Delete ${destination.name}? Rules using it will stop sending there.`,
      )
    )
      return
    try {
      await api.deleteNotificationDestination(destination.id)
      if (editingDestinationId === destination.id) resetDestination()
      if (expandedDestinationId === destination.id)
        setExpandedDestinationId(null)
      setRule((current) => {
        const actions = {
          ...current.actions,
          destination_ids: current.actions.destination_ids.filter(
            (id) => id !== destination.id,
          ),
        }
        return {
          ...current,
          actions,
          enabled:
            current.enabled &&
            (actions.in_app ||
              actions.browser ||
              actions.destination_ids.length > 0 ||
              actions.star ||
              actions.mark_read ||
              actions.tag_ids.length > 0 ||
              actions.move_to_trash),
        }
      })
      await load()
      showToast('Notification destination deleted.', 'success')
    } catch (destinationError) {
      if (isUnauthorized(destinationError)) return onUnauthorized()
      showToast(
        visibleError(destinationError, 'The notification destination'),
        'error',
      )
    }
  }

  const sendDestinationTest = async (
    destination: NotificationDestination,
    method: NotificationDestinationMethod,
  ) => {
    if (
      method.kind === 'webhook' &&
      method.method === 'DELETE' &&
      !window.confirm(
        `Send a DELETE test request to ${destination.name}? The receiving endpoint may treat it as a destructive request.`,
      )
    )
      return

    const key = `${destination.id}:${method.kind}`
    setTestingDestinationMethod(key)
    try {
      const result = await api.testNotificationDestination(
        destination.id,
        method.kind,
      )
      showToast(result.message, 'success')
    } catch (testError) {
      if (isUnauthorized(testError)) return onUnauthorized()
      const label = destinationMethodName(method.kind)
      const message =
        testError instanceof ApiError && testError.message === 'smtp_disabled'
          ? 'Email test could not be sent because SMTP is disabled.'
          : testError instanceof ApiError &&
              testError.message === 'smtp_invalid'
            ? 'Email test could not be sent because SMTP configuration is invalid.'
            : testError instanceof ApiError &&
                testError.message === 'invalid_delivery_method'
              ? `${label} is no longer configured for this destination.`
              : `${label} test could not be sent. Check the destination and try again.`
      showToast(message, 'error')
    } finally {
      setTestingDestinationMethod('')
    }
  }

  const displayedTimeWindows = rule.conditions.time_windows.length
    ? rule.conditions.time_windows
    : [blankTimeWindow()]

  const sendsNotification =
    rule.actions.in_app ||
    rule.actions.browser ||
    rule.actions.destination_ids.length > 0
  const hasAnyAction =
    sendsNotification ||
    rule.actions.star ||
    rule.actions.mark_read ||
    rule.actions.tag_ids.length > 0 ||
    rule.actions.move_to_trash

  const toggleNotificationAction = (enabled: boolean) =>
    updateRule({
      actions: {
        ...rule.actions,
        in_app: enabled,
        browser: enabled ? rule.actions.browser : false,
        destination_ids: enabled ? rule.actions.destination_ids : [],
      },
    })

  if (!active) return null

  return (
    <section
      className="rules-view"
      aria-labelledby="rules-title"
      aria-busy={loading}
    >
      <header className="rules-heading">
        <div>
          <h2 id="rules-title" tabIndex={-1}>
            Rules
          </h2>
          <p>
            Match incoming messages and run one or more actions automatically.
            Notifications contain a safe summary and an authenticated link,
            never the original email body.
          </p>
        </div>
        <button
          className="button button-secondary"
          type="button"
          disabled={loading}
          onClick={() => void load()}
        >
          Refresh
        </button>
      </header>
      <StatusMessage
        value={{ message: status, state: status ? 'authenticated' : undefined }}
      />
      <StatusMessage
        value={{ message: error, state: error ? 'error' : undefined }}
        assertive
      />
      <section
        className="notification-destinations"
        aria-labelledby="notification-destinations-title"
      >
        <div className="notification-section-heading">
          <div>
            <h3 id="notification-destinations-title">Delivery destinations</h3>
            <p>
              Name a reusable place for alerts. A rule can select more than one.
            </p>
          </div>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => resetDestination(destinationDefaults, true)}
          >
            New destination
          </button>
        </div>
        <DestinationList
          destinations={destinations}
          expandedId={expandedDestinationId}
          testingMethod={testingDestinationMethod}
          onToggle={setExpandedDestinationId}
          onTest={(destination, method) =>
            void sendDestinationTest(destination, method)
          }
          onEdit={editDestination}
          onDelete={(destination) => void removeDestination(destination)}
        />
        {destinationEditorOpen ? (
          <DestinationEditor
            editingId={editingDestinationId}
            name={destinationName}
            kind={destinationKind}
            host={destinationHost}
            topic={destinationTopic}
            url={destinationUrl}
            method={destinationMethod}
            body={destinationBody}
            headers={destinationHeaders}
            recipients={destinationRecipients}
            methods={destinationMethods}
            saving={saving}
            setName={setDestinationName}
            selectKind={selectDestinationMethod}
            setHost={setDestinationHost}
            setTopic={setDestinationTopic}
            setUrl={setDestinationUrl}
            setMethod={setDestinationMethod}
            setBody={setDestinationBody}
            setHeaders={setDestinationHeaders}
            setRecipients={setDestinationRecipients}
            setMethods={setDestinationMethods}
            onAddMethod={addDestinationMethod}
            onCancel={() => resetDestination()}
            onSave={() => void saveDestination()}
          />
        ) : null}
      </section>
      <section
        className="rules-section"
        aria-labelledby="rules-section-title"
      >
        <div className="notification-section-heading">
          <h3 id="rules-section-title">Your rules</h3>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              setEditingId(null)
              setRule(blankRule())
              setRuleStep(1)
              setPreview(null)
            }}
          >
            New rule
          </button>
        </div>
        <div className="rule-grid">
          <RuleList
            rules={rules}
            onEdit={(candidate) => {
              setEditingId(candidate.id)
              setRule(ruleForEditing(candidate))
              setRuleStep(1)
              setPreview(null)
            }}
            onDuplicate={(id) => void duplicate(id)}
            onDelete={(id) => void remove(id)}
          />
          <form
            className="rule-form"
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <h4>{editingId ? 'Edit rule' : 'New rule'}</h4>
            <nav
              className="rule-steps"
              aria-label="Rule setup steps"
            >
              {['Basics', 'Match messages', 'Actions'].map((label, index) => (
                <button
                  key={label}
                  type="button"
                  aria-current={ruleStep === index + 1 ? 'step' : undefined}
                  onClick={() => setRuleStep(index + 1)}
                >
                  <span>{index + 1}</span>
                  {label}
                </button>
              ))}
            </nav>
            {ruleStep === 1 ? (
              <RuleBasicsStep rule={rule} onChange={updateRule} />
            ) : null}
            {ruleStep === 2 ? (
              <RuleMatchStep
                rule={rule}
                mailboxes={mailboxes}
                tags={tags}
                displayedTimeWindows={displayedTimeWindows}
                updateConditions={updateConditions}
                updateTimeWindow={updateTimeWindow}
                addTimeWindow={addTimeWindow}
                removeTimeWindow={removeTimeWindow}
              />
            ) : null}
            {ruleStep === 3 ? (
              <RuleActionsStep
                rule={rule}
                destinations={destinations}
                tags={tags}
                sendsNotification={sendsNotification}
                hasAnyAction={hasAnyAction}
                onChange={updateRule}
                onToggleNotification={toggleNotificationAction}
              />
            ) : null}
            <div className="rule-actions">
              {ruleStep > 1 ? (
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setRuleStep((current) => current - 1)}
                >
                  Back
                </button>
              ) : (
                <span />
              )}
              {ruleStep === 2 ? (
                <button
                  ref={previewTriggerRef}
                  className="button button-secondary"
                  type="button"
                  disabled={saving || !rule.name.trim()}
                  onClick={() => void inspect()}
                >
                  Preview matches
                </button>
              ) : null}
              {ruleStep < 3 ? (
                <button
                  className="button"
                  type="button"
                  disabled={!rule.name.trim()}
                  onClick={() => setRuleStep((current) => current + 1)}
                >
                  Continue
                </button>
              ) : (
                <button
                  className="button"
                  type="submit"
                  disabled={saving || (rule.enabled && !hasAnyAction)}
                >
                  {saving ? 'Saving' : 'Save rule'}
                </button>
              )}
            </div>
          </form>
        </div>
        {preview ? (
          <MatchPreviewModal
            preview={preview}
            closeRef={previewCloseRef}
            onClose={() => {
              setPreview(null)
              previewTriggerRef.current?.focus()
            }}
          />
        ) : null}
      </section>
      <RuleBridgeStatus state={lua} />
    </section>
  )
}
