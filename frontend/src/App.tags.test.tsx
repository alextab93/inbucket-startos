import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { messagePage, messages, parsedInvoice, session } from './test/fixtures'
import { renderApp } from './test/renderApp'
import type { MessageSummary, Tag } from './types'

const revelo: Tag = { id: 1, name: 'Revelo', color: '#1D4ED8' }
const followUp: Tag = { id: 2, name: 'Follow up', color: '#15803D' }

const authenticatedHandlers = (
  currentTags: () => Tag[],
  currentMessages: (tag: string) => MessageSummary[],
) => [
  http.get('*/v1/session', () => HttpResponse.json(session)),
  http.get('*/v1/tags', () => HttpResponse.json(currentTags())),
  http.get('*/v1/inbucket/mailboxes', ({ request }) =>
    HttpResponse.json(
      new URL(request.url).searchParams.get('archived') === 'true'
        ? []
        : ['orders'],
    ),
  ),
  http.get('*/v1/inbucket/messages', ({ request }) => {
    const tag = new URL(request.url).searchParams.get('tag') || ''
    return HttpResponse.json(messagePage(currentMessages(tag)))
  }),
  http.get('*/v1/inbucket/mailboxes/:mailbox/messages/:id', () =>
    HttpResponse.json({ ...parsedInvoice, tags: [revelo] }),
  ),
  http.get('*/v1/inbucket/mailboxes/:mailbox/messages/:id/attachments', () =>
    HttpResponse.json([]),
  ),
  http.patch(
    '*/v1/inbucket/mailboxes/:mailbox/messages/:id/read',
    () => new HttpResponse(null, { status: 204 }),
  ),
]

describe('message tags', () => {
  it('filters on persisted assignments and assigns tags from an accessible popover', async () => {
    const user = userEvent.setup()
    let assigned = [revelo]
    const tagged = { ...messages[0], tags: assigned }
    const subjectOnly = {
      ...messages[0],
      id: 'subject-only',
      subject: 'Revelo appears only in this subject',
      tags: [],
    }
    renderApp(
      [
        ...authenticatedHandlers(
          () => [revelo, followUp],
          (tag) =>
            tag === String(revelo.id) ? [tagged] : [tagged, subjectOnly],
        ),
        http.patch(
          '*/v1/inbucket/mailboxes/:mailbox/messages/:id/tags/:tagId',
          async ({ params, request }) => {
            const body = (await request.json()) as { assigned: boolean }
            assigned = body.assigned
              ? [revelo, followUp]
              : assigned.filter((tag) => tag.id !== Number(params.tagId))
            return HttpResponse.json({
              assigned: body.assigned,
              tags: assigned,
            })
          },
        ),
      ],
      '/?mailbox=orders&message=invoice',
    )

    expect(
      await screen.findByRole('heading', { name: 'August invoice' }),
    ).toBeVisible()
    const inspector = screen.getByLabelText('Message inspector')
    const messageHeader = within(inspector).getByRole('banner')
    expect(within(messageHeader).getByText('Revelo')).toBeVisible()
    expect(
      screen.queryByRole('region', { name: 'Messages' }),
    ).not.toBeInTheDocument()

    const trigger = screen.getByRole('button', { name: 'Tag message' })
    await user.click(trigger)
    const popover = screen.getByRole('region', { name: 'Message tags' })
    expect(
      within(popover).getByRole('checkbox', { name: /Revelo/ }),
    ).toBeChecked()
    await user.click(
      within(popover).getByRole('checkbox', { name: /Follow up/ }),
    )

    await waitFor(() =>
      expect(within(messageHeader).getByText('Follow up')).toBeVisible(),
    )
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
    await user.click(trigger)
    await user.click(screen.getByRole('heading', { name: 'August invoice' }))
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(
      screen.queryByRole('region', { name: 'Message tags' }),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Back to message list' }),
    )
    const summary = screen.getByRole('button', {
      name: /^Read: August invoice/,
    })
    expect(within(summary).getByText('Revelo')).toBeVisible()
    expect(within(summary).getByText('+1')).toBeVisible()
    expect(within(summary).queryByText('Follow up')).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Filter and sort messages' }),
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filter by tag' }),
      String(revelo.id),
    )

    expect(await screen.findByText('1 message in orders.')).toBeVisible()
    expect(
      screen.getByRole('button', { name: /^Unread: August invoice/ }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Revelo appears only/ }),
    ).not.toBeInTheDocument()
  })

  it('creates, renames, recolors, and deletes tags through visible management results', async () => {
    const user = userEvent.setup()
    let tags = [revelo]
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApp(
      [
        ...authenticatedHandlers(
          () => tags,
          () => [{ ...messages[0], tags: [revelo] }],
        ),
        http.post('*/v1/tags', async ({ request }) => {
          const body = (await request.json()) as Omit<Tag, 'id'>
          const created = { id: 3, ...body }
          tags = [...tags, created]
          return HttpResponse.json(created, { status: 201 })
        }),
        http.patch('*/v1/tags/:id', async ({ params, request }) => {
          const body = (await request.json()) as Omit<Tag, 'id'>
          const updated = { id: Number(params.id), ...body }
          tags = tags.map((tag) => (tag.id === updated.id ? updated : tag))
          return HttpResponse.json(updated)
        }),
        http.delete('*/v1/tags/:id', ({ params }) => {
          tags = tags.filter((tag) => tag.id !== Number(params.id))
          return new HttpResponse(null, { status: 204 })
        }),
        http.patch(
          '*/v1/inbucket/mailboxes/:mailbox/messages/:id/tags/:tagId',
          async ({ params, request }) => {
            const body = (await request.json()) as { assigned: boolean }
            const tag = tags.find((value) => value.id === Number(params.tagId))
            return HttpResponse.json({
              assigned: body.assigned,
              tags: tag && body.assigned ? [revelo, tag] : [revelo],
            })
          },
        ),
      ],
      '/?mailbox=orders&message=invoice',
    )

    await screen.findByRole('heading', { name: 'August invoice' })
    await user.click(screen.getByRole('button', { name: 'Tag message' }))
    await user.click(screen.getByRole('button', { name: 'Create tag' }))
    const createForm = screen
      .getByRole('button', { name: 'Create tag' })
      .closest('form')!
    await user.type(
      within(createForm).getByRole('textbox', { name: 'Tag name' }),
      'Custom',
    )
    const picker = createForm.querySelector('input[type="color"]')!
    fireEvent.change(picker, { target: { value: '#abcdef' } })
    expect(within(createForm).getByText('#ABCDEF')).toBeVisible()
    expect(within(createForm).getAllByRole('radio')).toHaveLength(10)
    await user.click(
      within(createForm).getByRole('button', { name: 'Create tag' }),
    )

    const custom = await screen.findByRole('checkbox', { name: /Custom/ })
    expect(custom).not.toBeChecked()
    await user.click(custom)
    await waitFor(() => expect(custom).toBeChecked())
    await user.click(screen.getByRole('button', { name: 'Manage tags' }))
    const reveloSummary = screen.getByText('Revelo', { selector: 'summary' })
    const reveloDetails = reveloSummary.parentElement!
    await user.click(reveloSummary)
    const name = within(reveloDetails).getByRole('textbox', {
      name: 'Tag name',
    })
    await user.clear(name)
    await user.type(name, 'Priority')
    await user.click(within(reveloDetails).getByRole('radio', { name: /Rose/ }))
    await user.click(
      within(reveloDetails).getByRole('button', { name: 'Save tag' }),
    )

    expect(await within(reveloDetails).findByText('Priority')).toBeVisible()
    await user.click(
      within(reveloDetails).getByRole('button', { name: 'Delete tag' }),
    )
    await waitFor(() =>
      expect(screen.queryByText('Priority')).not.toBeInTheDocument(),
    )
  })

  it('keeps the exact visible assignment after a failed request and expires on unauthorized', async () => {
    const user = userEvent.setup()
    let status = 502
    renderApp(
      [
        ...authenticatedHandlers(
          () => [revelo, followUp],
          () => [{ ...messages[0], tags: [revelo] }],
        ),
        http.patch(
          '*/v1/inbucket/mailboxes/:mailbox/messages/:id/tags/:tagId',
          () => HttpResponse.json({ error: 'failed' }, { status }),
        ),
      ],
      '/?mailbox=orders&message=invoice',
    )

    await screen.findByRole('heading', { name: 'August invoice' })
    await user.click(screen.getByRole('button', { name: 'Tag message' }))
    const followUpBox = screen.getByRole('checkbox', { name: /Follow up/ })
    await user.click(followUpBox)
    expect(
      await screen.findByText('The message tags could not be updated.'),
    ).toBeVisible()
    expect(followUpBox).not.toBeChecked()
    expect(screen.getAllByText('Revelo').length).toBeGreaterThan(1)

    status = 401
    await user.click(followUpBox)
    expect(
      await screen.findByText(
        'Your session has expired. Sign in again to continue.',
      ),
    ).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Username' })).toBeVisible()
  })

  it('filters Starred and Monitor by persisted tag assignments', async () => {
    const user = userEvent.setup()
    const tagged = {
      ...messages[0],
      starred: true,
      tags: [revelo, followUp],
    }
    const untagged = { ...messages[1], starred: true, tags: [] }
    renderApp([
      ...authenticatedHandlers(
        () => [revelo, followUp],
        () => [],
      ),
      http.get('*/v1/inbucket/starred/messages', () =>
        HttpResponse.json([tagged, untagged]),
      ),
      http.get('*/v1/inbucket/monitor/messages', () =>
        HttpResponse.json([tagged, untagged]),
      ),
    ])

    await screen.findByRole('heading', { name: 'Messages' })
    await user.click(screen.getByRole('button', { name: 'Starred' }))
    await screen.findByRole('button', { name: /^Unread: August invoice/ })
    const starredSummary = screen.getByRole('button', {
      name: /^Unread: August invoice.*tags: Revelo, Follow up$/,
    })
    expect(within(starredSummary).getByText('Revelo')).toBeVisible()
    expect(within(starredSummary).getByText('+1')).toBeVisible()
    expect(
      within(starredSummary).queryByText('Follow up'),
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Filter and sort messages' }),
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filter by tag' }),
      String(revelo.id),
    )
    expect(
      screen.getByRole('button', { name: /^Unread: August invoice/ }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /^Read: Welcome aboard/ }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Monitor' }))
    const monitorSummary = await screen.findByRole('button', {
      name: /^Unread: August invoice.*tags: Revelo, Follow up$/,
    })
    expect(within(monitorSummary).getByText('Revelo')).toBeVisible()
    expect(within(monitorSummary).getByText('+1')).toBeVisible()
    expect(
      within(monitorSummary).queryByText('Follow up'),
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', {
        name: 'Filter and sort monitored messages',
      }),
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filter by tag' }),
      String(revelo.id),
    )
    expect(
      screen.getByRole('button', { name: /^Unread: August invoice/ }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /^Read: Welcome aboard/ }),
    ).not.toBeInTheDocument()
  })
})
