import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import {
  archived,
  messagePage,
  messages,
  monitored,
  parsedInvoice,
  session,
} from './test/fixtures'
import { renderApp } from './test/renderApp'

const routingHandlers = () => [
  http.get('*/v1/session', () => HttpResponse.json(session)),
  http.get('*/v1/inbucket/mailboxes', ({ request }) => {
    const archivedRequested =
      new URL(request.url).searchParams.get('archived') === 'true'
    return HttpResponse.json(archivedRequested ? archived : ['orders'])
  }),
  http.get('*/v1/inbucket/messages', () =>
    HttpResponse.json(
      messagePage(messages.filter(({ mailbox }) => mailbox === 'orders')),
    ),
  ),
  http.get('*/v1/inbucket/starred/messages', () =>
    HttpResponse.json(
      messages.map((message) => ({ ...message, starred: true })),
    ),
  ),
  http.get('*/v1/inbucket/monitor/messages', () =>
    HttpResponse.json(monitored),
  ),
  http.get('*/v1/inbucket/mailboxes/:mailbox/messages/:id', () =>
    HttpResponse.json(parsedInvoice),
  ),
  http.get('*/v1/inbucket/mailboxes/:mailbox/messages/:id/attachments', () =>
    HttpResponse.json([]),
  ),
  http.patch(
    '*/v1/inbucket/mailboxes/:mailbox/messages/:id/read',
    () => new HttpResponse(null, { status: 204 }),
  ),
]

const deferredRequest = () => {
  let resolve = () => {}
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('URL navigation', () => {
  it('updates each top-level view URL without retaining a mailbox message', async () => {
    const user = userEvent.setup()
    renderApp(routingHandlers(), '/?mailbox=orders&message=invoice')

    expect(
      await screen.findByRole('heading', { name: 'August invoice' }),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Starred' }))
    expect(
      await screen.findByRole('heading', { name: 'Starred messages' }),
    ).toBeVisible()
    expect(window.location.search).toBe('?view=starred')

    await user.click(screen.getByRole('button', { name: 'Monitor' }))
    expect(
      await screen.findByRole('heading', { name: 'Realtime' }),
    ).toBeVisible()
    expect(window.location.search).toBe('?view=monitor')

    await user.click(screen.getByRole('button', { name: 'Archived' }))
    expect(
      await screen.findByRole('heading', { name: 'Archived mailboxes' }),
    ).toBeVisible()
    expect(window.location.search).toBe('?view=archive')
  })

  it.each([
    ['/?view=starred', 'Starred', 'Starred messages'],
    ['/?view=monitor', 'Monitor', 'Realtime'],
    ['/?view=archive', 'Archived', 'Archived mailboxes'],
  ])('restores %s after a reload', async (path, activeTab, visibleHeading) => {
    renderApp(routingHandlers(), path)

    expect(
      await screen.findByRole('heading', { name: visibleHeading }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: activeTab })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(window.location.search).toBe(
      new URL(path, window.location.origin).search,
    )
  })

  it('restores and closes a selected starred message through its URL', async () => {
    const user = userEvent.setup()
    renderApp(
      routingHandlers(),
      '/?view=starred&mailbox=orders&message=invoice',
    )

    expect(
      await screen.findByRole('heading', { name: 'August invoice' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Starred' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      screen.queryByRole('region', { name: 'Starred messages' }),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Back to message list' }),
    )

    expect(screen.queryByLabelText('Message inspector')).not.toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Starred messages' }),
    ).toBeVisible()
    expect(window.location.search).toBe('?view=starred')
  })

  it('restores visible views and message selection from popstate URLs', async () => {
    renderApp(routingHandlers(), '/?view=starred')

    expect(
      await screen.findByRole('heading', { name: 'Starred messages' }),
    ).toBeVisible()

    act(() => {
      window.history.replaceState(null, '', '/?view=monitor')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(
      await screen.findByRole('heading', { name: 'Realtime' }),
    ).toBeVisible()
    expect(window.location.search).toBe('?view=monitor')

    act(() => {
      window.history.replaceState(null, '', '/?mailbox=orders&message=invoice')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(
      await screen.findByRole('heading', { name: 'August invoice' }),
    ).toBeVisible()
    expect(window.location.search).toBe('?mailbox=orders&message=invoice')
  })

  it('opens the Monitor row mailbox when another mailbox has the same message id', async () => {
    const user = userEvent.setup()
    const supportMessage = {
      ...messages[0],
      mailbox: 'support',
      subject: 'Support invoice',
    }
    renderApp(
      [
        http.get('*/v1/session', () => HttpResponse.json(session)),
        http.get('*/v1/inbucket/mailboxes', ({ request }) => {
          const archivedRequested =
            new URL(request.url).searchParams.get('archived') === 'true'
          return HttpResponse.json(
            archivedRequested ? [] : ['orders', 'support'],
          )
        }),
        http.get('*/v1/inbucket/messages', () =>
          HttpResponse.json(messagePage([messages[0]])),
        ),
        http.get('*/v1/inbucket/monitor/messages', () =>
          HttpResponse.json([supportMessage]),
        ),
        http.get(
          '*/v1/inbucket/mailboxes/:mailbox/messages/:id',
          ({ params }) =>
            HttpResponse.json({
              ...parsedInvoice,
              mailbox: String(params.mailbox),
              subject:
                params.mailbox === 'support'
                  ? 'Support invoice'
                  : 'Orders invoice',
            }),
        ),
        http.get(
          '*/v1/inbucket/mailboxes/:mailbox/messages/:id/attachments',
          () => HttpResponse.json([]),
        ),
        http.patch(
          '*/v1/inbucket/mailboxes/:mailbox/messages/:id/read',
          () => new HttpResponse(null, { status: 204 }),
        ),
      ],
      '/?mailbox=orders',
    )

    await screen.findByRole('button', { name: /^Unread: August invoice/ })
    await user.click(screen.getByRole('button', { name: 'Monitor' }))
    await user.click(
      await screen.findByRole('button', {
        name: /Unread: Support invoice.*support/,
      }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Support invoice' }),
    ).toBeVisible()
    expect(window.location.search).toBe('?mailbox=support&message=invoice')
  })

  it('does not replace a newer Monitor URL when delayed unstar completes', async () => {
    const user = userEvent.setup()
    const request = deferredRequest()
    renderApp(
      [
        ...routingHandlers(),
        http.patch(
          '*/v1/inbucket/mailboxes/:mailbox/messages/:id/starred',
          async () => {
            await request.promise
            return HttpResponse.json({ starred: false })
          },
        ),
      ],
      '/?view=starred&mailbox=orders&message=invoice',
    )

    await screen.findByRole('heading', { name: 'August invoice' })
    const inspector = screen.getByLabelText('Message inspector')
    await user.click(
      within(inspector).getByRole('button', {
        name: 'Remove star: August invoice',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Monitor' }))
    expect(
      await screen.findByRole('heading', { name: 'Realtime' }),
    ).toBeVisible()

    request.resolve()
    await waitFor(() =>
      expect(
        screen.queryByRole('button', {
          name: 'Remove star: August invoice',
          hidden: true,
        }),
      ).not.toBeInTheDocument(),
    )

    expect(window.location.search).toBe('?view=monitor')
  })

  it('does not replace a newer Monitor URL when delayed deletion completes', async () => {
    const user = userEvent.setup()
    const request = deferredRequest()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApp(
      [
        ...routingHandlers(),
        http.delete('*/v1/inbucket/message', async () => {
          await request.promise
          return new HttpResponse(null, { status: 204 })
        }),
      ],
      '/?view=starred&mailbox=orders&message=invoice',
    )

    await screen.findByRole('heading', { name: 'August invoice' })
    await user.click(screen.getByRole('button', { name: 'Delete message' }))
    await user.click(screen.getByRole('button', { name: 'Monitor' }))
    expect(
      await screen.findByRole('heading', { name: 'Realtime' }),
    ).toBeVisible()

    request.resolve()
    await waitFor(() =>
      expect(
        screen.queryByRole('button', {
          name: 'Delete message',
          hidden: true,
        }),
      ).not.toBeInTheDocument(),
    )

    expect(window.location.search).toBe('?view=monitor')
  })

  it.each([
    ['/?view=unknown&message=invoice', '', 'Mailboxes', 'Messages'],
    [
      '/?view=monitor&mailbox=orders&message=invoice',
      '?view=monitor',
      'Monitor',
      'Realtime',
    ],
  ])(
    'canonicalizes %s to its valid visible location',
    async (path, expectedSearch, activeTab, visibleHeading) => {
      renderApp(routingHandlers(), path)

      expect(
        await screen.findByRole('heading', { name: visibleHeading }),
      ).toBeVisible()
      expect(screen.getByRole('button', { name: activeTab })).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(window.location.search).toBe(expectedSearch)
    },
  )
})
