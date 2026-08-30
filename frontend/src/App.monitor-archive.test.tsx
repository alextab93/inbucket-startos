import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  archived,
  messagePage,
  messages,
  monitored,
  parsedInvoice,
  session,
} from './test/fixtures'
import { renderApp } from './test/renderApp'

const catalogs = (archivedResponse: () => unknown[] = () => archived) =>
  http.get('*/v1/inbucket/mailboxes', ({ request }) => {
    const archivedRequested =
      new URL(request.url).searchParams.get('archived') === 'true'
    return HttpResponse.json(
      archivedRequested ? archivedResponse() : ['orders'],
    )
  })

const advanceMonitorRefresh = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000)
  })
}

afterEach(() => vi.useRealTimers())

describe('Monitor and Archived views', () => {
  it('shows dedicated loading and empty states', async () => {
    const user = userEvent.setup()
    renderApp([
      http.get('*/v1/session', () => HttpResponse.json(session)),
      http.get('*/v1/inbucket/mailboxes', async ({ request }) => {
        await delay(500)
        const archivedRequested =
          new URL(request.url).searchParams.get('archived') === 'true'
        return HttpResponse.json(archivedRequested ? [] : ['orders'])
      }),
      http.get('*/v1/inbucket/monitor/messages', async () => {
        await delay(50)
        return HttpResponse.json([])
      }),
    ])

    await screen.findByRole('heading', { name: 'Messages' })
    await user.click(screen.getByRole('button', { name: 'Archived' }))
    expect(screen.getByText('Loading archived mailboxes.')).toBeVisible()
    expect(await screen.findByText('No archived mailboxes.')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Monitor' }))
    expect(screen.getByRole('region', { name: 'Realtime' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
    expect(
      await screen.findByText(
        'No messages have arrived since monitoring began.',
      ),
    ).toBeVisible()
  })

  it('reports a monitor service error in the active view', async () => {
    const user = userEvent.setup()
    renderApp([
      http.get('*/v1/session', () => HttpResponse.json(session)),
      catalogs(() => []),
      http.get('*/v1/inbucket/monitor/messages', () =>
        HttpResponse.json({ error: 'inbucket_error' }, { status: 502 }),
      ),
    ])

    await screen.findByRole('heading', { name: 'Messages' })
    await user.click(screen.getByRole('button', { name: 'Monitor' }))
    expect(
      await screen.findByText(
        'The monitor could not be loaded. Please try again.',
      ),
    ).toBeVisible()
  })

  it('shows current monitor data, preserves controls, and opens its message', async () => {
    const user = userEvent.setup()
    renderApp([
      http.get('*/v1/session', () => HttpResponse.json(session)),
      catalogs(),
      http.get('*/v1/inbucket/monitor/messages', () =>
        HttpResponse.json([...monitored, messages[1]]),
      ),
      http.get('*/v1/inbucket/messages', () =>
        HttpResponse.json(messagePage([messages[0]])),
      ),
      http.get('*/v1/inbucket/mailboxes/:mailbox/messages/:id', () =>
        HttpResponse.json(parsedInvoice),
      ),
      http.get(
        '*/v1/inbucket/mailboxes/:mailbox/messages/:id/attachments',
        () => HttpResponse.json([]),
      ),
      http.patch(
        '*/v1/inbucket/mailboxes/:mailbox/messages/:id/read',
        () => new HttpResponse(null, { status: 204 }),
      ),
    ])

    await screen.findByRole('heading', { name: 'Messages' })
    await user.click(screen.getByRole('button', { name: 'Monitor' }))
    expect(screen.getByRole('heading', { name: 'Realtime' })).toHaveFocus()
    expect(
      await screen.findByRole('button', {
        name: /Unread: August invoice.*orders/,
      }),
    ).toBeVisible()
    expect(
      screen.getAllByRole('button', { name: /August invoice/ }),
    ).toHaveLength(1)

    const search = screen.getByRole('searchbox', {
      name: 'Search monitored messages',
    })
    await user.click(
      screen.getByRole('button', {
        name: 'Filter and sort monitored messages',
      }),
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Show messages from' }),
      'support',
    )
    expect(
      screen.getByRole('button', { name: /Read: Welcome aboard.*support/ }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /August invoice/ }),
    ).not.toBeInTheDocument()
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Show messages from' }),
      '',
    )
    await user.click(screen.getByRole('radio', { name: 'Unread' }))
    await user.type(search, 'billing')
    await user.click(
      screen.getByRole('button', { name: /Unread: August invoice.*orders/ }),
    )

    expect(
      await screen.findByRole('heading', { name: 'August invoice' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Back to message list' }),
    ).toHaveFocus()
    expect(
      screen.queryByRole('region', { name: 'Messages' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Monitor' }))
    expect(
      screen.getByRole('searchbox', { name: 'Search monitored messages' }),
    ).toHaveValue('billing')
    await user.click(
      screen.getByRole('button', {
        name: 'Filter and sort monitored messages',
      }),
    )
    expect(screen.getByRole('radio', { name: 'Unread' })).toBeChecked()
  })

  it('filters monitored messages by date before displaying the refreshed snapshot', async () => {
    const user = userEvent.setup()
    renderApp([
      http.get('*/v1/session', () => HttpResponse.json(session)),
      catalogs(),
      http.get('*/v1/inbucket/monitor/messages', ({ request }) => {
        const params = new URL(request.url).searchParams
        const receivedAfter = Date.parse(params.get('received_after') || '')
        const receivedBefore = Date.parse(params.get('received_before') || '')
        const response = [monitored[0], messages[1]].filter((message) => {
          const timestamp = Date.parse(String(message.date))
          return (
            (!Number.isFinite(receivedAfter) || timestamp >= receivedAfter) &&
            (!Number.isFinite(receivedBefore) || timestamp < receivedBefore)
          )
        })
        return HttpResponse.json(response)
      }),
    ])

    await screen.findByRole('heading', { name: 'Messages' })
    await user.click(screen.getByRole('button', { name: 'Monitor' }))
    expect(
      await screen.findByRole('button', { name: /Read: Welcome aboard/ }),
    ).toBeVisible()

    await user.click(
      screen.getByRole('button', {
        name: 'Filter and sort monitored messages',
      }),
    )
    const filters = document.getElementById('monitor-filter-panel')
    if (!(filters instanceof HTMLElement))
      throw new Error('Filters are missing')
    await user.type(within(filters).getByLabelText('From'), '2026-08-27')

    expect(
      await screen.findByRole('button', { name: /Unread: August invoice/ }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Read: Welcome aboard/ }),
    ).not.toBeInTheDocument()

    await user.click(
      within(filters).getByRole('button', { name: 'Clear dates' }),
    )
    expect(
      await screen.findByRole('button', { name: /Read: Welcome aboard/ }),
    ).toBeVisible()
  })

  it('replaces the complete monitor snapshot and reapplies active controls', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const user = userEvent.setup()
    let initialSnapshot = true
    renderApp([
      http.get('*/v1/session', () => HttpResponse.json(session)),
      catalogs(),
      http.get('*/v1/inbucket/monitor/messages', () => {
        if (initialSnapshot) {
          initialSnapshot = false
          return HttpResponse.json([
            monitored[0],
            {
              ...messages[1],
              id: 'departed',
              mailbox: 'support',
              subject: 'Earlier delivery',
            },
          ])
        }
        return HttpResponse.json([
          { ...monitored[0], seen: true },
          {
            ...messages[1],
            id: 'arrival',
            mailbox: 'support',
            subject: 'Fresh delivery',
            date: '2026-08-28T12:00:00Z',
            seen: false,
          },
        ])
      }),
    ])

    await screen.findByRole('heading', { name: 'Messages' })
    await user.click(screen.getByRole('button', { name: 'Monitor' }))
    expect(
      await screen.findByRole('button', {
        name: /Unread: August invoice.*orders/,
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Read: Earlier delivery.*support/ }),
    ).toBeVisible()

    await user.click(
      screen.getByRole('button', {
        name: 'Filter and sort monitored messages',
      }),
    )
    await user.click(screen.getByRole('radio', { name: 'Unread' }))
    await advanceMonitorRefresh()

    expect(screen.getByRole('radio', { name: 'Unread' })).toBeChecked()
    expect(
      await screen.findByRole('button', {
        name: /Unread: Fresh delivery.*support/,
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /August invoice/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Earlier delivery/ }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'All messages' }))
    expect(
      screen.getByRole('button', { name: /Read: August invoice.*orders/ }),
    ).toBeVisible()
    expect(
      screen.getAllByRole('button', {
        name: /August invoice|Fresh delivery/,
      }),
    ).toHaveLength(2)
  })

  it('stops monitor refreshes in another view and starts cleanly when revisited', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const user = userEvent.setup()
    let monitorAvailable = true
    renderApp([
      http.get('*/v1/session', () => HttpResponse.json(session)),
      catalogs(() => []),
      http.get('*/v1/inbucket/monitor/messages', () =>
        monitorAvailable
          ? HttpResponse.json(monitored)
          : HttpResponse.json({ error: 'unauthorized' }, { status: 401 }),
      ),
    ])

    await screen.findByRole('heading', { name: 'Messages' })
    await user.click(screen.getByRole('button', { name: 'Monitor' }))
    expect(
      await screen.findByRole('button', {
        name: /Unread: August invoice.*orders/,
      }),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Mailboxes' }))
    monitorAvailable = false
    await advanceMonitorRefresh()

    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible()
    expect(
      screen.queryByText(
        'Your session has expired. Sign in again to continue.',
      ),
    ).not.toBeInTheDocument()

    monitorAvailable = true
    await user.click(screen.getByRole('button', { name: 'Monitor' }))
    expect(
      await screen.findByRole('button', {
        name: /Unread: August invoice.*orders/,
      }),
    ).toBeVisible()
    expect(
      screen.getAllByRole('button', { name: /August invoice/ }),
    ).toHaveLength(1)
  })

  it('leaves the next mounted application unaffected after monitor cleanup', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const user = userEvent.setup()
    let nextMonitorResponse = 0
    const handlers = [
      http.get('*/v1/session', () => HttpResponse.json(session)),
      catalogs(() => []),
      http.get('*/v1/inbucket/monitor/messages', () => {
        const response = nextMonitorResponse
        nextMonitorResponse += 1
        if (response === 0) return HttpResponse.json(monitored)
        if (response === 1) {
          return HttpResponse.json([
            {
              ...messages[1],
              mailbox: 'support',
              subject: 'Fresh application delivery',
              seen: false,
            },
          ])
        }
        return HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
      }),
    ]
    const mounted = renderApp(handlers)

    await screen.findByRole('heading', { name: 'Messages' })
    await user.click(screen.getByRole('button', { name: 'Monitor' }))
    expect(
      await screen.findByRole('button', {
        name: /Unread: August invoice.*orders/,
      }),
    ).toBeVisible()

    mounted.unmount()
    await advanceMonitorRefresh()
    renderApp([])

    await screen.findByRole('heading', { name: 'Messages' })
    await user.click(screen.getByRole('button', { name: 'Monitor' }))
    expect(
      await screen.findByRole('button', {
        name: /Unread: Fresh application delivery.*support/,
      }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible()
  })

  it('shows archived counts and visible restore success and failure states', async () => {
    const user = userEvent.setup()
    let archivedMailboxes = [...archived]
    renderApp([
      http.get('*/v1/session', () => HttpResponse.json(session)),
      catalogs(() => archivedMailboxes),
      http.patch('*/v1/inbucket/mailbox/archive', ({ request }) => {
        const url = new URL(request.url)
        const name = url.searchParams.get('name') || ''
        if (name === 'unknown-count') {
          return HttpResponse.json({ error: 'inbucket_error' }, { status: 502 })
        }
        archivedMailboxes = archivedMailboxes.filter(
          (mailbox) => mailbox.name !== name,
        )
        return new HttpResponse(null, { status: 204 })
      }),
    ])

    await screen.findByRole('heading', { name: 'Messages' })
    await user.click(screen.getByRole('button', { name: 'Archived' }))
    expect(
      screen.getByRole('heading', { name: 'Archived mailboxes' }),
    ).toHaveFocus()
    expect(screen.getByText('2 messages.')).toBeVisible()
    expect(screen.getByText('Message count unavailable.')).toBeVisible()

    const oldOrders = screen
      .getByText('old-orders')
      .closest('.archived-mailbox-option')
    if (!(oldOrders instanceof HTMLElement)) {
      throw new Error('Archived mailbox row is missing')
    }
    await user.click(within(oldOrders).getByRole('button', { name: 'Restore' }))
    expect(await screen.findByText('Restored old-orders.')).toBeVisible()
    expect(screen.queryByText('old-orders')).not.toBeInTheDocument()

    const unknown = screen
      .getByText('unknown-count')
      .closest('.archived-mailbox-option')
    if (!(unknown instanceof HTMLElement)) {
      throw new Error('Archived mailbox row is missing')
    }
    await user.click(within(unknown).getByRole('button', { name: 'Restore' }))
    expect(
      await screen.findByText(
        'Inbucket is temporarily unavailable. Please try again.',
      ),
    ).toBeVisible()
    expect(screen.getByText('unknown-count')).toBeVisible()
  })

  it('reports archived catalog errors inside the active view', async () => {
    const user = userEvent.setup()
    renderApp([
      http.get('*/v1/session', () => HttpResponse.json(session)),
      http.get('*/v1/inbucket/mailboxes', ({ request }) => {
        const archivedRequested =
          new URL(request.url).searchParams.get('archived') === 'true'
        return archivedRequested
          ? HttpResponse.json({ error: 'inbucket_error' }, { status: 502 })
          : HttpResponse.json(['orders'])
      }),
    ])

    await screen.findByRole('heading', { name: 'Messages' })
    await user.click(screen.getByRole('button', { name: 'Archived' }))
    expect(
      await screen.findByText(
        'The archived mailbox catalog could not be loaded. Please try again.',
      ),
    ).toBeVisible()
  })

  it('returns to the expired access state after a monitor authorization failure', async () => {
    const user = userEvent.setup()
    renderApp([
      http.get('*/v1/session', () => HttpResponse.json(session)),
      catalogs(() => []),
      http.get('*/v1/inbucket/monitor/messages', () =>
        HttpResponse.json({ error: 'unauthorized' }, { status: 401 }),
      ),
    ])

    await screen.findByRole('heading', { name: 'Messages' })
    await user.click(screen.getByRole('button', { name: 'Monitor' }))
    expect(
      await screen.findByText(
        'Your session has expired. Sign in again to continue.',
      ),
    ).toBeVisible()
  })
})
