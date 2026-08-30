import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { filterMessages, sortMessages } from './formatting'
import { messagePage, messages, parsedInvoice, session } from './test/fixtures'
import { renderApp } from './test/renderApp'
import type {
  ListSort,
  MessageSummary,
  ParsedMessage,
  ReadFilter,
} from './types'

const catalogHandlers = (active: () => string[], archived: () => unknown[]) => [
  http.get('*/v1/inbucket/mailboxes', ({ request }) => {
    const archivedRequested =
      new URL(request.url).searchParams.get('archived') === 'true'
    return HttpResponse.json(archivedRequested ? archived() : active())
  }),
]

const paginatedMessages = (
  request: Request,
  messagesFor: (mailbox: string) => MessageSummary[],
) => {
  const params = new URL(request.url).searchParams
  const requested = params.getAll('mailboxes[]')
  const read = (params.get('read') || 'all') as ReadFilter
  const sort = (params.get('sort') || 'newest') as ListSort
  const found = requested.flatMap(messagesFor)
  const receivedAfter = Date.parse(params.get('received_after') || '')
  const receivedBefore = Date.parse(params.get('received_before') || '')
  const dated = found.filter((message) => {
    const timestamp = Date.parse(String(message.date || ''))
    if (!Number.isFinite(timestamp)) {
      return !Number.isFinite(receivedAfter) && !Number.isFinite(receivedBefore)
    }
    return (
      (!Number.isFinite(receivedAfter) || timestamp >= receivedAfter) &&
      (!Number.isFinite(receivedBefore) || timestamp < receivedBefore)
    )
  })
  return messagePage(
    sortMessages(filterMessages(dated, params.get('search') || '', read), sort),
  )
}

const paginatedMessageHandler = (
  messagesFor: (mailbox: string) => MessageSummary[],
) =>
  http.get('*/v1/inbucket/messages', ({ request }) =>
    HttpResponse.json(paginatedMessages(request, messagesFor)),
  )

describe('mailbox workspace', () => {
  it('combines mailboxes and filters and sorts visible messages', async () => {
    const user = userEvent.setup()
    const mailboxMessages: Record<string, MessageSummary[]> = {
      orders: [
        messages[0],
        {
          ...messages[0],
          id: 'invoice-copy',
          subject: 'August invoice copy',
        },
        {
          id: 'unknown',
          mailbox: 'orders',
          subject: 'Unknown values',
          from: 'unknown@example.com',
          date: 'not-a-date',
        },
      ],
      support: [messages[1]],
    }
    renderApp([
      http.get('*/v1/session', () => HttpResponse.json(session)),
      ...catalogHandlers(
        () => ['orders', 'support'],
        () => [],
      ),
      paginatedMessageHandler((name) => mailboxMessages[name] || []),
    ])

    await screen.findByRole('heading', { name: 'Messages' })
    await user.click(screen.getByLabelText('Manage saved mailboxes'))
    await user.click(screen.getByRole('checkbox', { name: 'orders' }))
    expect(
      await screen.findByRole('button', {
        name: /^Unread: August invoice, /,
      }),
    ).toBeVisible()
    await user.click(screen.getByRole('checkbox', { name: 'support' }))
    await waitFor(() =>
      expect(document.querySelector('.mailbox-status')).toHaveTextContent(
        '4 messages in 2 mailboxes.',
      ),
    )
    expect(
      await screen.findByRole('button', { name: /Read: Welcome aboard/ }),
    ).toBeVisible()

    const search = screen.getByRole('searchbox', { name: 'Search messages' })
    await user.type(search, 'ALEX@EXAMPLE.COM')
    expect(
      screen.getByRole('button', { name: /August invoice, / }),
    ).toBeVisible()
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /^Read: Welcome aboard/ }),
      ).not.toBeInTheDocument(),
    )

    await user.clear(search)
    await user.type(search, 'missing')
    expect(
      await screen.findByText('No messages match your search.'),
    ).toBeVisible()
    await user.clear(search)
    await user.click(
      screen.getByRole('button', { name: 'Filter and sort messages' }),
    )
    await user.click(screen.getByRole('radio', { name: 'Read' }))
    expect(
      await screen.findByRole('button', { name: /^Read: Welcome aboard/ }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /^Unread: August invoice, / }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Unread' }))
    expect(screen.getByRole('radio', { name: 'Read' })).not.toBeChecked()
    expect(
      await screen.findByRole('button', { name: /^Unread: August invoice, / }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /^Read: Welcome aboard/ }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Largest first' }))
    const list = screen.getByRole('region', { name: 'Messages' })
    expect(
      within(list)
        .getAllByRole('button', { name: /Unread:/ })
        .map((button) => button.textContent),
    ).toEqual([
      expect.stringContaining('August invoice'),
      expect.stringContaining('August invoice copy'),
      expect.stringContaining('Unknown values'),
    ])

    await user.click(screen.getByRole('radio', { name: 'All messages' }))
    await user.click(screen.getByRole('radio', { name: 'Oldest first' }))
    expect(
      within(list)
        .getAllByRole('button', { name: /^(Read|Unread):/ })
        .map((button) => button.textContent),
    ).toEqual([
      expect.stringContaining('Welcome aboard'),
      expect.stringContaining('August invoice'),
      expect.stringContaining('August invoice copy'),
      expect.stringContaining('Unknown values'),
    ])

    await user.click(screen.getByRole('radio', { name: 'Smallest first' }))
    expect(
      within(list)
        .getAllByRole('button', { name: /^(Read|Unread):/ })
        .map((button) => button.textContent),
    ).toEqual([
      expect.stringContaining('Welcome aboard'),
      expect.stringContaining('August invoice'),
      expect.stringContaining('August invoice copy'),
      expect.stringContaining('Unknown values'),
    ])
  })

  it('filters mailbox messages by one date or an inclusive date range', async () => {
    const user = userEvent.setup()
    renderApp([
      http.get('*/v1/session', () => HttpResponse.json(session)),
      ...catalogHandlers(
        () => ['orders', 'support'],
        () => [],
      ),
      paginatedMessageHandler((name) =>
        messages.filter((message) => message.mailbox === name),
      ),
    ])

    await screen.findByRole('heading', { name: 'Messages' })
    await user.click(screen.getByLabelText('Manage saved mailboxes'))
    await user.click(screen.getByRole('checkbox', { name: 'orders' }))
    await user.click(screen.getByRole('checkbox', { name: 'support' }))
    expect(
      await screen.findByRole('button', { name: /^Read: Welcome aboard/ }),
    ).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: 'Filter and sort messages' }),
    )
    const filters = document.getElementById('message-filter-panel')
    if (!(filters instanceof HTMLElement))
      throw new Error('Filters are missing')
    await user.type(within(filters).getByLabelText('From'), '2026-08-27')

    expect(
      await screen.findByRole('button', { name: /^Unread: August invoice/ }),
    ).toBeVisible()
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /^Read: Welcome aboard/ }),
      ).not.toBeInTheDocument(),
    )

    await user.type(within(filters).getByLabelText('To'), '2026-08-27')
    expect(
      screen.getByRole('button', { name: /^Unread: August invoice/ }),
    ).toBeVisible()

    await user.click(
      within(filters).getByRole('button', { name: 'Clear dates' }),
    )
    expect(
      await screen.findByRole('button', { name: /^Read: Welcome aboard/ }),
    ).toBeVisible()
  })

  it('loads additional message pages without duplicates and allows retry after failure', async () => {
    const user = userEvent.setup()
    let loadMoreAttempts = 0
    renderApp([
      http.get('*/v1/session', () => HttpResponse.json(session)),
      ...catalogHandlers(
        () => ['orders'],
        () => [],
      ),
      http.get('*/v1/inbucket/messages', ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor')
        if (!cursor)
          return HttpResponse.json(messagePage([messages[0]], 'next', [], 86))

        loadMoreAttempts += 1
        if (loadMoreAttempts === 1) {
          return HttpResponse.json({ error: 'inbucket_error' }, { status: 502 })
        }
        return HttpResponse.json(
          messagePage([messages[0], messages[1]], null, [], 86),
        )
      }),
    ])

    await screen.findByRole('heading', { name: 'Messages' })
    await user.click(screen.getByLabelText('Manage saved mailboxes'))
    await user.click(screen.getByRole('checkbox', { name: 'orders' }))
    expect(
      await screen.findByRole('button', { name: /^Unread: August invoice/ }),
    ).toBeVisible()
    expect(screen.getByText('86 messages in orders.')).toBeVisible()
    expect(screen.getByText('Showing 1 of 86 messages')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Load more messages' }))
    expect(
      await screen.findByText(
        'Inbucket is temporarily unavailable. Please try again.',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /^Unread: August invoice/ }),
    ).toBeVisible()
    expect(screen.getByText('Showing 1 of 86 messages')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Load more messages' }))
    expect(
      await screen.findByRole('button', { name: /^Read: Welcome aboard/ }),
    ).toBeVisible()
    expect(
      screen.getAllByRole('button', { name: /^Unread: August invoice/ }),
    ).toHaveLength(1)
    expect(
      screen.queryByRole('button', { name: 'Load more messages' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('86 messages in orders.')).toBeVisible()
    expect(screen.getByText('Showing 2 of 86 messages')).toBeVisible()
  })

  it('loads the next page when the end of the message list becomes visible', async () => {
    const user = userEvent.setup()
    let intersect: IntersectionObserverCallback | null = null
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        readonly root = null
        readonly rootMargin = '0px'
        readonly thresholds = [0]

        constructor(callback: IntersectionObserverCallback) {
          intersect = callback
        }

        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return []
        }
      },
    )
    renderApp([
      http.get('*/v1/session', () => HttpResponse.json(session)),
      ...catalogHandlers(
        () => ['orders'],
        () => [],
      ),
      http.get('*/v1/inbucket/messages', ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor')
        return HttpResponse.json(
          cursor
            ? messagePage([messages[1]], null, [], 2)
            : messagePage([messages[0]], 'next', [], 2),
        )
      }),
    ])

    await screen.findByRole('heading', { name: 'Messages' })
    await user.click(screen.getByLabelText('Manage saved mailboxes'))
    await user.click(screen.getByRole('checkbox', { name: 'orders' }))
    expect(
      await screen.findByRole('button', { name: /^Unread: August invoice/ }),
    ).toBeVisible()

    await act(async () => {
      intersect?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })

    expect(
      await screen.findByRole('button', { name: /^Read: Welcome aboard/ }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Load more messages' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Showing 2 of 2 messages')).toBeVisible()
  })

  it('shows starred messages across mailboxes with mailbox, read, and sort controls', async () => {
    const user = userEvent.setup()
    let starredMessages = messages.map((message) => ({
      ...message,
      starred: true,
    }))
    renderApp([
      http.get('*/v1/session', () => HttpResponse.json(session)),
      ...catalogHandlers(
        () => ['orders', 'support'],
        () => [],
      ),
      http.get('*/v1/inbucket/starred/messages', () =>
        HttpResponse.json(starredMessages),
      ),
      http.patch(
        '*/v1/inbucket/mailboxes/:mailbox/messages/:id/starred',
        async ({ params, request }) => {
          const body = (await request.json()) as { starred: boolean }
          if (!body.starred) {
            starredMessages = starredMessages.filter(
              (message) => String(message.id) !== String(params.id),
            )
          }
          return HttpResponse.json({ starred: body.starred })
        },
      ),
    ])

    await screen.findByRole('heading', { name: 'Messages' })
    await user.click(screen.getByRole('button', { name: 'Starred' }))
    expect(
      await screen.findByRole('button', { name: /^Unread: August invoice/ }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /^Read: Welcome aboard/ }),
    ).toBeVisible()
    expect(screen.getByText('Showing 2 of 2 messages')).toBeVisible()
    expect(screen.queryByText('2 starred messages.')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Filter and sort messages' }),
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Show messages from' }),
      'support',
    )
    expect(
      screen.getByRole('button', { name: /^Read: Welcome aboard/ }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /^Unread: August invoice/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Showing 1 of 2 messages')).toBeVisible()

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Show messages from' }),
      '',
    )
    await user.click(screen.getByRole('radio', { name: 'Unread' }))
    expect(
      screen.getByRole('button', { name: /^Unread: August invoice/ }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /^Read: Welcome aboard/ }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'All messages' }))
    await user.click(screen.getByRole('radio', { name: 'Oldest first' }))
    const list = screen.getByRole('region', { name: 'Starred messages' })
    expect(
      within(list)
        .getAllByRole('button', { name: /^(Read|Unread):/ })
        .map((button) => button.textContent),
    ).toEqual([
      expect.stringContaining('Welcome aboard'),
      expect.stringContaining('August invoice'),
    ])

    const filters = document.getElementById('starred-message-filter-panel')
    if (!(filters instanceof HTMLElement))
      throw new Error('Filters are missing')
    await user.type(within(filters).getByLabelText('From'), '2026-08-27')
    expect(
      screen.getByRole('button', { name: /^Unread: August invoice/ }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /^Read: Welcome aboard/ }),
    ).not.toBeInTheDocument()
    await user.click(
      within(filters).getByRole('button', { name: 'Clear dates' }),
    )
    expect(
      screen.getByRole('button', { name: /^Read: Welcome aboard/ }),
    ).toBeVisible()

    await user.click(
      screen.getByRole('button', {
        name: 'Remove star: Welcome aboard',
      }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Starred messages' }),
    ).toHaveFocus()
    expect(
      screen.queryByRole('button', { name: /^Read: Welcome aboard/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Showing 1 of 1 message')).toBeVisible()
  })

  it('adds a star from a mailbox and restores its visible state after failure', async () => {
    const user = userEvent.setup()
    let shouldFail = false
    renderApp([
      http.get('*/v1/session', () => HttpResponse.json(session)),
      ...catalogHandlers(
        () => ['orders'],
        () => [],
      ),
      paginatedMessageHandler(() => [{ ...messages[0], starred: false }]),
      http.patch(
        '*/v1/inbucket/mailboxes/:mailbox/messages/:id/starred',
        async ({ request }) => {
          if (shouldFail) {
            return HttpResponse.json(
              { error: 'inbucket_error' },
              { status: 502 },
            )
          }
          const body = (await request.json()) as { starred: boolean }
          return HttpResponse.json({
            starred: body.starred,
            message: { ...messages[0], starred: true },
          })
        },
      ),
    ])

    await screen.findByRole('heading', { name: 'Messages' })
    await user.click(screen.getByLabelText('Manage saved mailboxes'))
    await user.click(screen.getByRole('checkbox', { name: 'orders' }))
    await user.click(
      screen.getByRole('button', {
        name: 'Add star: August invoice',
      }),
    )
    expect(
      await screen.findByRole('button', {
        name: 'Remove star: August invoice',
      }),
    ).toHaveAttribute('aria-pressed', 'true')

    shouldFail = true
    await user.click(
      screen.getByRole('button', {
        name: 'Remove star: August invoice',
      }),
    )

    expect(
      await screen.findByText(
        'The star could not be updated. Please try again.',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('button', {
        name: 'Remove star: August invoice',
      }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('adds and opens an archived mailbox through visible restored state', async () => {
    const user = userEvent.setup()
    let activeMailboxes: string[] = []
    let archivedMailboxes: unknown[] = [
      { name: 'old-orders', message_count: 1 },
    ]
    renderApp([
      http.get('*/v1/session', () => HttpResponse.json(session)),
      ...catalogHandlers(
        () => activeMailboxes,
        () => archivedMailboxes,
      ),
      paginatedMessageHandler((name) => {
        activeMailboxes = [name]
        archivedMailboxes = []
        return [{ ...messages[0], mailbox: name }]
      }),
    ])

    await screen.findByRole('heading', { name: 'Messages' })
    await user.click(screen.getByText('Add mailbox'))
    await user.type(
      screen.getByRole('textbox', { name: 'Mailbox name' }),
      ' old-orders ',
    )
    await user.click(screen.getByRole('button', { name: 'Add and open' }))

    expect(
      await screen.findByRole('button', { name: /Unread: August invoice/ }),
    ).toBeVisible()
    expect(screen.getByText('1 message in old-orders.')).toBeVisible()
    expect(window.location.search).toBe('?mailbox=old-orders')
    expect(screen.getByText('Add mailbox')).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Archived' }))
    expect(screen.getByText('No archived mailboxes.')).toBeVisible()
  })

  it('restores a message URL and supports read, source, attachment, and deletion outcomes', async () => {
    const user = userEvent.setup()
    let mailboxMessages = [messages[0]]
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApp(
      [
        http.get('*/v1/session', () => HttpResponse.json(session)),
        ...catalogHandlers(
          () => ['orders'],
          () => [],
        ),
        paginatedMessageHandler(() => mailboxMessages),
        http.get('*/v1/inbucket/mailboxes/:mailbox/messages/:id', () =>
          HttpResponse.json(parsedInvoice),
        ),
        http.get(
          '*/v1/inbucket/mailboxes/:mailbox/messages/:id/attachments',
          () =>
            HttpResponse.json([
              {
                index: 0,
                filename: 'resume.pdf',
                content_type: 'application/pdf',
                size: 5,
              },
            ]),
        ),
        http.patch(
          '*/v1/inbucket/mailboxes/:mailbox/messages/:id/read',
          () => new HttpResponse(null, { status: 204 }),
        ),
        http.get(
          '*/v1/inbucket/mailboxes/:mailbox/messages/:id/source',
          () =>
            new HttpResponse('From: billing@example.com\r\n\r\nInvoice body', {
              headers: { 'Content-Type': 'text/plain' },
            }),
        ),
        http.delete('*/v1/inbucket/message', () => {
          mailboxMessages = []
          return new HttpResponse(null, { status: 204 })
        }),
      ],
      '/?mailbox=orders&message=invoice',
    )

    expect(
      await screen.findByRole('heading', { name: 'August invoice' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('region', { name: 'Messages' }),
    ).not.toBeInTheDocument()
    expect(window.location.search).toBe('?mailbox=orders&message=invoice')
    const attachment = await screen.findByRole('link', { name: 'resume.pdf' })
    expect(attachment).toHaveAttribute(
      'href',
      '/v1/inbucket/mailboxes/orders/messages/invoice/attachments/0',
    )

    await user.click(screen.getByRole('button', { name: 'View source' }))
    expect(await screen.findByText(/From: billing@example.com/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Hide source' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )

    await user.click(
      screen.getByRole('button', { name: 'Back to message list' }),
    )
    expect(screen.queryByLabelText('Message inspector')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Messages' })).toHaveFocus()
    expect(screen.getByRole('region', { name: 'Messages' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Read: August invoice/ }),
    ).toBeVisible()
    expect(window.location.search).toBe('?mailbox=orders')

    await user.click(
      screen.getByRole('button', { name: /Read: August invoice/ }),
    )
    expect(
      await screen.findByRole('heading', { name: 'August invoice' }),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Delete message' }))
    expect(await screen.findByText('Message deleted.')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /August invoice/ }),
    ).not.toBeInTheDocument()
    expect(window.location.search).toBe('?mailbox=orders')
  })

  it('keeps a message visibly unread when the upstream read change fails', async () => {
    const user = userEvent.setup()
    renderApp(
      [
        http.get('*/v1/session', () => HttpResponse.json(session)),
        ...catalogHandlers(
          () => ['orders'],
          () => [],
        ),
        paginatedMessageHandler(() => [messages[0]]),
        http.get('*/v1/inbucket/mailboxes/:mailbox/messages/:id', () =>
          HttpResponse.json(parsedInvoice),
        ),
        http.get(
          '*/v1/inbucket/mailboxes/:mailbox/messages/:id/attachments',
          () => HttpResponse.json([]),
        ),
        http.patch('*/v1/inbucket/mailboxes/:mailbox/messages/:id/read', () =>
          HttpResponse.json({ error: 'inbucket_error' }, { status: 502 }),
        ),
      ],
      '/?mailbox=orders&message=invoice',
    )

    expect(
      await screen.findByText(
        'The message remains unread because its read state could not be updated.',
      ),
    ).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: 'Back to message list' }),
    )
    expect(
      screen.getByRole('button', { name: /Unread: August invoice/ }),
    ).toBeVisible()
  })

  it('retains failed mailboxes after partial archive and confirms purge', async () => {
    const user = userEvent.setup()
    let activeMailboxes = ['orders', 'support']
    let archivedMailboxes: unknown[] = []
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApp([
      http.get('*/v1/session', () => HttpResponse.json(session)),
      ...catalogHandlers(
        () => activeMailboxes,
        () => archivedMailboxes,
      ),
      paginatedMessageHandler((name) =>
        messages.filter((message) => message.mailbox === name),
      ),
      http.patch('*/v1/inbucket/mailbox/archive', ({ request }) => {
        const name = new URL(request.url).searchParams.get('name') || ''
        if (name === 'support') {
          return HttpResponse.json({ error: 'inbucket_error' }, { status: 502 })
        }
        activeMailboxes = activeMailboxes.filter((mailbox) => mailbox !== name)
        archivedMailboxes = [{ name, message_count: 1 }]
        return new HttpResponse(null, { status: 204 })
      }),
      http.delete('*/v1/inbucket/mailbox', ({ request }) => {
        const name = new URL(request.url).searchParams.get('name') || ''
        activeMailboxes = activeMailboxes.filter((mailbox) => mailbox !== name)
        return new HttpResponse(null, { status: 204 })
      }),
    ])

    await screen.findByRole('heading', { name: 'Messages' })
    const manage = screen.getByLabelText('Manage saved mailboxes')
    await user.click(manage)
    await user.keyboard('{Escape}')
    expect(manage).toHaveFocus()

    await user.click(manage)
    await user.click(screen.getByRole('button', { name: 'Select all' }))
    expect(await screen.findByText('2 messages in 2 mailboxes.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Archive selected' }))
    expect(
      await screen.findByText(
        'Archived 1 mailboxes. 1 mailboxes could not be archived.',
      ),
    ).toBeVisible()
    const saved = screen.getByRole('group', { name: 'Saved mailboxes' })
    expect(
      within(saved).queryByRole('checkbox', { name: 'orders' }),
    ).not.toBeInTheDocument()
    expect(
      within(saved).getByRole('checkbox', { name: 'support' }),
    ).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Delete selected' }))
    expect(await screen.findByText('Deleted 1 mailboxes.')).toBeVisible()
    expect(
      screen.getByText('No saved mailboxes yet. Add a mailbox to open it.'),
    ).toBeVisible()
  })

  it('ignores a stale message response after a newer selection', async () => {
    const user = userEvent.setup()
    const oldMessage: ParsedMessage = {
      ...messages[0],
      id: 'old',
      subject: 'Old subject',
      body: { text: 'Old body' },
    }
    const newMessage: ParsedMessage = {
      ...messages[0],
      id: 'new',
      subject: 'New subject',
      body: { text: 'New body' },
    }
    renderApp([
      http.get('*/v1/session', () => HttpResponse.json(session)),
      ...catalogHandlers(
        () => ['orders'],
        () => [],
      ),
      paginatedMessageHandler(() => [
        { ...messages[0], id: 'old', subject: 'Old subject' },
        { ...messages[0], id: 'new', subject: 'New subject' },
      ]),
      http.get(
        '*/v1/inbucket/mailboxes/:mailbox/messages/:id',
        async ({ params }) => {
          if (params.id === 'old') await delay(80)
          return HttpResponse.json(
            params.id === 'old' ? oldMessage : newMessage,
          )
        },
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
    await user.click(screen.getByLabelText('Manage saved mailboxes'))
    await user.click(screen.getByRole('checkbox', { name: 'orders' }))
    await screen.findByRole('button', { name: /^Unread: Old subject/ })
    await user.click(
      screen.getByRole('button', { name: /^Unread: Old subject/ }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Back to message list' }),
    )
    await user.click(
      screen.getByRole('button', { name: /^Unread: New subject/ }),
    )

    expect(
      await screen.findByRole('heading', { name: 'New subject' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Old subject' }),
    ).not.toBeInTheDocument()
  })
})
