import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { session } from './test/fixtures'
import { renderApp } from './test/renderApp'
import type {
  NotificationDelivery,
  NotificationDestination,
  NotificationDestinationDefaults,
  MessageRule,
} from './types'

const rule: MessageRule = {
  id: 9,
  name: 'Order alerts',
  enabled: true,
  priority: 10,
  cooldown_seconds: 60,
  schema_version: 4,
  conditions: {
    mailboxes: ['orders'],
    senders: ['sales@example.com'],
    recipients: [],
    tag_ids: [],
    time_windows: [],
  },
  actions: {
    in_app: true,
    browser: false,
    destination_ids: [],
    star: false,
    mark_read: false,
    tag_ids: [],
    move_to_trash: false,
  },
  last_error_code: null,
  last_failed_at: null,
  summary: 'When mailbox, sender matches, notify by in-app, email.',
}

const handlers = (
  deliveries: NotificationDelivery[] = [
    {
      id: 4,
      rule_name: 'Order alerts',
      mailbox: 'orders',
      message_id: 'invoice-4',
      kind: 'in_app',
      status: 'delivered',
      recipient: null,
      created_at: '2026-09-24T12:00:00.000000Z',
      delivered_at: '2026-09-24T12:00:00.000000Z',
      read_at: null,
      error_code: null,
    },
  ],
  destinations: NotificationDestination[] = [],
  defaults: NotificationDestinationDefaults = {},
) => [
  http.get('*/v1/session', () => HttpResponse.json(session)),
  http.get('*/v1/tags', () => HttpResponse.json([])),
  http.get('*/v1/inbucket/mailboxes', () =>
    HttpResponse.json(['orders', 'support']),
  ),
  http.get('*/v1/notification_destinations', () =>
    HttpResponse.json({ destinations, defaults }),
  ),
  http.get('*/v1/rules', () =>
    HttpResponse.json({
      rules: [rule],
      lua: {
        desired_revision: 'revision',
        active_revision: 'revision',
        active: true,
        last_error_code: null,
        last_failed_at: null,
      },
    }),
  ),
  http.get('*/v1/notifications', () => HttpResponse.json(deliveries)),
  http.patch(
    '*/v1/notifications/:id/read',
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.patch(
    '*/v1/notifications/:id/clear',
    () => new HttpResponse(null, { status: 204 }),
  ),
]

afterEach(() => {
  vi.unstubAllGlobals()
  window.innerWidth = 1024
})

describe('Rules', () => {
  it('shows durable notifications in the global bell menu and keeps Rules focused on configuration', async () => {
    const user = userEvent.setup()
    renderApp(handlers(), '/?view=rules')

    expect(await screen.findByRole('heading', { name: 'Rules' })).toBeVisible()
    expect(
      await screen.findByRole('heading', { name: 'Order alerts' }),
    ).toBeVisible()
    expect(screen.queryByText('Generated Inbucket Lua')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Notification center' }),
    ).not.toBeInTheDocument()

    const bell = await screen.findByRole('button', {
      name: 'Notifications, 1 unread',
    })
    await user.click(bell)
    const menu = bell.closest('details')
    expect(menu).not.toBeNull()
    expect(await within(menu!).findByText(/invoice-4/)).toBeVisible()

    await user.click(within(menu!).getByRole('button', { name: 'Read' }))

    expect(bell).toHaveAccessibleName('Notifications')
    await user.click(within(menu!).getByRole('button', { name: 'Clear' }))

    expect(
      await within(menu!).findByText('No notifications yet.'),
    ).toBeVisible()
  })

  it('requests browser permission only after the user enables browser notifications', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    const shown = vi.fn()
    class BrowserNotification {
      static permission: NotificationPermission = 'default'
      static requestPermission = requestPermission

      constructor(...args: unknown[]) {
        shown(...args)
      }
    }
    vi.stubGlobal('Notification', BrowserNotification)
    const user = userEvent.setup()
    renderApp(
      handlers([
        {
          id: 5,
          rule_name: 'Order alerts',
          mailbox: 'orders',
          message_id: 'invoice-browser',
          kind: 'browser',
          status: 'pending',
          recipient: null,
          created_at: '2026-09-24T12:00:00.000000Z',
          delivered_at: null,
          read_at: null,
          error_code: null,
        },
      ]),
      '/?view=rules',
    )

    await screen.findByRole('heading', { name: 'Rules' })
    expect(requestPermission).not.toHaveBeenCalled()

    const bell = screen.getByRole('button', { name: /Notifications/ })
    await user.click(bell)
    await waitFor(() =>
      expect(bell).toHaveAccessibleName('Notifications, 1 unread'),
    )
    const browserSwitch = screen.getByRole('switch', {
      name: 'Browser notifications',
    })
    expect(browserSwitch).not.toBeChecked()
    await user.click(browserSwitch)

    await waitFor(() => expect(requestPermission).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(shown).toHaveBeenCalledTimes(1))
    expect(browserSwitch).toBeChecked()
  })

  it('keeps a browser delivery pending and shows a visible error when the browser rejects it', async () => {
    class BrowserNotification {
      static permission: NotificationPermission = 'granted'

      constructor() {
        throw new Error('browser rejected notification')
      }
    }
    vi.stubGlobal('Notification', BrowserNotification)
    const user = userEvent.setup()
    renderApp(
      handlers([
        {
          id: 6,
          rule_name: 'Order alerts',
          mailbox: 'orders',
          message_id: 'invoice-browser-failure',
          kind: 'browser',
          status: 'pending',
          recipient: null,
          created_at: '2026-09-24T12:00:00.000000Z',
          delivered_at: null,
          read_at: null,
          error_code: null,
        },
      ]),
      '/?view=rules',
    )

    expect(
      await screen.findAllByText(
        'The browser notification could not be loaded. Please try again.',
      ),
    ).not.toHaveLength(0)
    const bell = screen.getByRole('button', {
      name: 'Notifications, 1 unread',
    })
    await user.click(bell)
    expect(
      within(bell.closest('details')!).getByText(/invoice-browser-failure/),
    ).toBeVisible()
  })

  it('builds a rule through keyboard-operable steps and tokenized filters', async () => {
    const submitted: unknown[] = []
    const created: Array<Record<string, unknown>> = []
    const user = userEvent.setup()
    window.innerWidth = 390
    renderApp(
      [
        ...handlers(),
        http.post('*/v1/rules/preview', async ({ request }) => {
          submitted.push(await request.json())
          return HttpResponse.json({
            matches: [],
            inspected: 12,
            incomplete: false,
          })
        }),
        http.post('*/v1/rules', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>
          created.push(body)
          return HttpResponse.json(
            {
              id: 10,
              ...body,
              last_error_code: null,
              last_failed_at: null,
              summary: 'When mailbox and sender match, star the message.',
            },
            { status: 201 },
          )
        }),
      ],
      '/?view=rules',
    )

    await screen.findByRole('heading', { name: 'Rules' })
    await user.type(screen.getByLabelText('Name'), 'Sales alert')
    await user.click(screen.getByRole('button', { name: 'About Cooldown' }))
    expect(
      screen.getByRole('tooltip', { name: /Minimum seconds after this rule/ }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(
      screen.getByText('Mailboxes', {
        selector: '.rule-condition-accordions strong',
      }),
    )
    const mailbox = screen.getByRole('checkbox', { name: 'orders' })
    mailbox.focus()
    await user.keyboard(' ')
    expect(mailbox).toBeChecked()
    await user.click(screen.getByText('Addresses'))
    await user.type(screen.getByLabelText('Senders'), 'sales@example.com,')

    expect(
      screen.getByRole('list', { name: 'Senders values' }),
    ).toHaveTextContent('sales@example.com')
    const removeSender = screen.getByRole('button', {
      name: 'Remove sales@example.com',
    })
    removeSender.focus()
    await user.keyboard('{Enter}')
    expect(
      screen.queryByRole('list', { name: 'Senders values' }),
    ).not.toBeInTheDocument()
    await user.type(
      screen.getByLabelText('Senders'),
      'sales@example.com{Enter}',
    )

    await user.click(
      screen.getByText('Schedule', {
        selector: '.rule-condition-accordions strong',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'About Schedule' }))
    expect(
      screen.getByRole('tooltip', { name: /Times use UTC/ }),
    ).toBeVisible()
    expect(screen.getByLabelText('Start')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Preview matches' }))

    await waitFor(() => expect(submitted).toHaveLength(1))
    expect(submitted[0]).toMatchObject({
      name: 'Sales alert',
      conditions: { mailboxes: ['orders'], senders: ['sales@example.com'] },
    })
    const previewDialog = screen.getByRole('dialog', {
      name: 'Matching messages',
    })
    expect(previewDialog).toBeVisible()
    await user.click(
      within(previewDialog).getByRole('button', {
        name: 'Close matching messages',
      }),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Preview matches' }))
    const reopenedPreview = await screen.findByRole('dialog', {
      name: 'Matching messages',
    })
    fireEvent.mouseDown(reopenedPreview.parentElement!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('group', { name: 'Actions' })).toBeVisible()
    expect(screen.getByText('Send a notification')).toBeVisible()
    expect(screen.getByText('Star the message')).toBeVisible()
    expect(screen.getByText('Mark as read')).toBeVisible()
    expect(screen.getByText('Move to Trash')).toBeVisible()
    expect(
      screen.getByRole('checkbox', { name: /Send a notification/ }),
    ).not.toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: /Move to Trash/ }))
    await user.click(screen.getByRole('button', { name: 'Save rule' }))

    await waitFor(() => expect(created).toHaveLength(1))
    expect(created[0]).toMatchObject({
      actions: {
        in_app: false,
        browser: false,
        destination_ids: [],
        star: false,
        mark_read: false,
        tag_ids: [],
        move_to_trash: true,
      },
    })
  })

  it('creates a reusable destination with multiple delivery methods', async () => {
    const submitted: Array<Record<string, unknown>> = []
    const user = userEvent.setup()
    renderApp(
      [
        ...handlers(),
        http.post('*/v1/notification_destinations', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>
          submitted.push(body)
          return HttpResponse.json({ id: 8, ...body }, { status: 201 })
        }),
      ],
      '/?view=rules',
    )

    await screen.findByRole('heading', { name: 'Rules' })
    await user.click(screen.getByRole('button', { name: 'New destination' }))
    await user.type(screen.getByLabelText('Destination name'), 'Operations')
    await user.clear(screen.getByLabelText('ntfy host'))
    await user.type(
      screen.getByLabelText('ntfy host'),
      'https://ntfy.example.com',
    )
    await user.type(screen.getByLabelText('Topic'), 'alerts')
    await user.click(
      screen.getByRole('button', { name: 'Add or replace method' }),
    )
    await user.selectOptions(
      screen.getByLabelText('Delivery method'),
      'webhook',
    )
    await user.type(
      screen.getByLabelText('Webhook URL'),
      'https://hooks.example.com/inbucket',
    )
    await user.click(
      screen.getByRole('button', { name: 'Add or replace method' }),
    )
    await user.click(screen.getByRole('button', { name: 'Save destination' }))

    await waitFor(() => expect(submitted).toHaveLength(1))
    expect(submitted[0]).toMatchObject({
      name: 'Operations',
      methods: [{ kind: 'ntfy' }, { kind: 'webhook' }],
    })
    await user.click(screen.getByRole('button', { name: 'New destination' }))
    expect(screen.getByLabelText('ntfy host')).toHaveValue(
      'https://ntfy.example.com',
    )
    await user.selectOptions(
      screen.getByLabelText('Delivery method'),
      'webhook',
    )
    expect(screen.getByLabelText('Webhook URL')).toHaveValue(
      'https://hooks.example.com/inbucket',
    )
  })

  it('prefills the most recently saved ntfy host and webhook URL', async () => {
    const user = userEvent.setup()
    renderApp(
      handlers(undefined, [], {
        ntfy_host: 'https://ntfy.recent.example.com',
        webhook_url: 'https://hooks.recent.example.com/inbucket',
      }),
      '/?view=rules',
    )

    await screen.findByRole('heading', { name: 'Rules' })
    expect(await screen.findByLabelText('ntfy host')).toHaveValue(
      'https://ntfy.recent.example.com',
    )

    await user.selectOptions(
      screen.getByLabelText('Delivery method'),
      'webhook',
    )

    expect(screen.getByLabelText('Webhook URL')).toHaveValue(
      'https://hooks.recent.example.com/inbucket',
    )
  })

  it('loads each configured method when editing a destination', async () => {
    const user = userEvent.setup()
    const destination: NotificationDestination = {
      id: 8,
      name: 'Operations',
      methods: [
        { kind: 'ntfy', host: 'https://ntfy.example.com', topic: 'alerts' },
        {
          kind: 'webhook',
          url: 'https://hooks.example.com/inbucket',
          method: 'PATCH',
          headers: [{ name: 'Authorization', value: 'Bearer private' }],
          body: '{"source":"inbucket"}',
        },
      ],
    }
    renderApp(handlers(undefined, [destination]), '/?view=rules')

    await screen.findByRole('heading', { name: 'Rules' })
    const destinationItem = (await screen.findByText('Operations')).closest(
      'li',
    )
    expect(destinationItem).not.toBeNull()
    await user.click(
      within(destinationItem!).getByRole('button', { name: /Operations/ }),
    )
    await user.click(
      within(destinationItem!).getByRole('button', { name: 'Edit' }),
    )

    expect(screen.getByLabelText('Destination name')).toHaveValue('Operations')
    expect(screen.getByLabelText('ntfy host')).toHaveValue(
      'https://ntfy.example.com',
    )
    expect(screen.getByLabelText('Topic')).toHaveValue('alerts')

    await user.selectOptions(
      screen.getByLabelText('Delivery method'),
      'webhook',
    )

    expect(screen.getByLabelText('Webhook URL')).toHaveValue(
      'https://hooks.example.com/inbucket',
    )
    expect(screen.getByLabelText('HTTP method')).toHaveValue('PATCH')
    expect(
      (screen.getByLabelText('Headers as JSON') as HTMLTextAreaElement).value,
    ).toContain('Bearer private')
    expect(screen.getByLabelText('Request body')).toHaveValue(
      '{"source":"inbucket"}',
    )
  })

  it('shows destination details in an accordion and sends a test for each method', async () => {
    const user = userEvent.setup()
    const tested: string[] = []
    const destination: NotificationDestination = {
      id: 12,
      name: 'Alex',
      methods: [
        { kind: 'email', recipients: ['alex@example.com'] },
        {
          kind: 'ntfy',
          host: 'https://ntfy.example.com',
          topic: 'alex-alerts',
        },
        {
          kind: 'webhook',
          url: 'https://hooks.example.com/inbucket?token=private',
          method: 'POST',
          headers: [{ name: 'Authorization', value: 'Bearer private' }],
          body: '',
        },
      ],
    }
    renderApp(
      [
        ...handlers(undefined, [destination]),
        http.post(
          '*/v1/notification_destinations/:id/test',
          async ({ request }) => {
            const body = (await request.json()) as { kind: string }
            tested.push(body.kind)
            const label = body.kind === 'ntfy' ? 'ntfy' : body.kind[0].toUpperCase() + body.kind.slice(1)
            return HttpResponse.json({
              kind: body.kind,
              message: `Test ${label} notification sent.`,
            })
          },
        ),
      ],
      '/?view=rules',
    )

    await screen.findByText('Alex')
    expect(screen.queryByLabelText('Destination name')).not.toBeInTheDocument()
    const accordion = screen.getByRole('button', { name: /Alex/ })
    expect(within(accordion).getByText('Alex')).toBeVisible()
    expect(within(accordion).getByText('Email')).toBeVisible()
    expect(within(accordion).getByText('ntfy')).toBeVisible()
    expect(within(accordion).getByText('Webhook')).toBeVisible()

    await user.click(accordion)

    expect(screen.getByText('alex@example.com')).toBeVisible()
    expect(
      screen.getByText('https://ntfy.example.com/alex-alerts'),
    ).toBeVisible()
    expect(
      screen.getByText('POST https://hooks.example.com/inbucket?query configured'),
    ).toBeVisible()
    expect(screen.queryByText(/token=private/)).not.toBeInTheDocument()
    const previews = document.querySelectorAll('.notification-test-preview pre')
    expect(previews).toHaveLength(3)
    expect(previews[0]).toHaveTextContent('This is a test from Inbucket for Alex.')
    expect(previews[2]).toHaveTextContent('"event": "inbucket.notification.test"')

    for (const label of ['Email', 'ntfy', 'Webhook']) {
      await user.click(
        screen.getByRole('button', { name: `Send ${label} test` }),
      )
      await waitFor(() => expect(tested).toContain(label.toLowerCase()))
    }

    expect(tested).toEqual(['email', 'ntfy', 'webhook'])
    expect(
      await screen.findByText('Test Webhook notification sent.'),
    ).toBeVisible()
  })
})
