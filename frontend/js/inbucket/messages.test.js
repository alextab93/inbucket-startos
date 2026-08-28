import { beforeEach, describe, expect, it, vi } from 'vitest'

const setupDocument = () => {
  document.body.innerHTML = `
    <input id="message-search" type="search">
    <div id="message-filter-control">
      <button id="message-filter-trigger" type="button" aria-label="Filter and sort messages" aria-expanded="false" aria-controls="message-filter-panel"></button>
      <div id="message-filter-panel" hidden>
        <input id="message-filter-read" type="checkbox">
        <input id="message-filter-unread" type="checkbox">
        <input type="radio" name="message-sort" value="newest" checked>
        <input type="radio" name="message-sort" value="oldest">
        <input type="radio" name="message-sort" value="largest">
        <input type="radio" name="message-sort" value="smallest">
      </div>
    </div>
    <div id="message-list"></div>
    <div id="message-empty"></div>
    <div id="message-content" hidden></div>
    <div id="message-subject"></div>
    <div id="message-from"></div>
    <div id="message-to"></div>
    <div id="message-date"></div>
    <div id="message-body"></div>
    <div id="message-attachments" hidden></div>
    <div id="message-attachment-list"></div>
    <button id="source-toggle"></button>
    <div id="source-status"></div>
    <pre id="message-source" hidden></pre>
  `
}

describe('message read state', () => {
  beforeEach(() => {
    vi.resetModules()
    setupDocument()
    window.history.replaceState(null, '', '/')
  })

  it('distinguishes unread and read messages in the list', async () => {
    const { renderMessageList } = await import('./messages')

    renderMessageList([
      {
        id: 'unread-message',
        mailbox: 'gmail',
        subject: 'Unread subject',
        from: 'unread@example.com',
        date: '2026-08-27T12:00:00Z',
        seen: false,
      },
      {
        id: 'read-message',
        mailbox: 'gmail',
        subject: 'Read subject',
        from: 'read@example.com',
        date: '2026-08-27T11:00:00Z',
        seen: true,
      },
    ])

    const [unread, read] = document.querySelectorAll('.message-summary')
    expect(unread.classList.contains('unread')).toBe(true)
    expect(unread.getAttribute('aria-label')).toContain('Unread:')
    expect(read.classList.contains('read')).toBe(true)
    expect(read.getAttribute('aria-label')).toContain('Read:')
  })

  it('filters loaded messages by search text and read state', async () => {
    const { configureMessages, renderMessageList } = await import('./messages')
    configureMessages({ loadMailboxes: vi.fn(), handleUnauthorized: vi.fn() })
    renderMessageList([
      {
        id: 'invoice',
        mailbox: 'orders',
        subject: 'August invoice',
        from: 'billing@example.com',
        to: 'alex@example.com',
        date: '2026-08-27T12:00:00Z',
        seen: false,
      },
      {
        id: 'welcome',
        mailbox: 'support',
        subject: 'Welcome aboard',
        from: 'hello@example.com',
        to: 'team@example.com',
        date: '2026-08-26T12:00:00Z',
        seen: true,
      },
    ])

    const search = document.querySelector('#message-search')
    const readFilter = document.querySelector('#message-filter-read')
    const unreadFilter = document.querySelector('#message-filter-unread')
    const [invoice, welcome] = document.querySelectorAll('.message-summary')
    for (const query of [
      'BILLING',
      'alex@example.com',
      'orders',
      'August invoice',
    ]) {
      search.value = query
      search.dispatchEvent(new Event('input'))
      expect(invoice.hidden).toBe(false)
      expect(welcome.hidden).toBe(true)
    }

    search.value = 'missing'
    search.dispatchEvent(new Event('input'))
    expect(document.querySelector('.message-filter-empty')?.textContent).toBe(
      'No messages match your search.',
    )

    search.value = ''
    search.dispatchEvent(new Event('input'))
    unreadFilter.click()
    expect(unreadFilter.checked).toBe(true)
    expect(invoice.hidden).toBe(false)
    expect(welcome.hidden).toBe(true)

    readFilter.click()
    expect(readFilter.checked).toBe(true)
    expect(unreadFilter.checked).toBe(false)
    expect(invoice.hidden).toBe(true)
    expect(welcome.hidden).toBe(false)

    search.value = 'missing'
    search.dispatchEvent(new Event('input'))
    expect(document.querySelector('.message-filter-empty')?.textContent).toBe(
      'No messages match your search and filters.',
    )

    search.value = ''
    search.dispatchEvent(new Event('input'))
    readFilter.click()
    expect(
      [...document.querySelectorAll('.message-summary')].every(
        (message) => !message.hidden,
      ),
    ).toBe(true)
    expect(readFilter.checked).toBe(false)
    expect(document.querySelector('.message-filter-empty')).toBeNull()
  })

  it('opens and closes the filter panel', async () => {
    const { configureMessages } = await import('./messages')
    configureMessages({ loadMailboxes: vi.fn(), handleUnauthorized: vi.fn() })
    const trigger = document.querySelector('#message-filter-trigger')
    const panel = document.querySelector('#message-filter-panel')

    trigger.click()

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(panel.hidden).toBe(false)

    document
      .querySelector('#message-filter-control')
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(panel.hidden).toBe(true)
    expect(document.activeElement).toBe(trigger)

    trigger.click()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))

    expect(panel.hidden).toBe(true)
  })

  it('sorts messages by date and size with unknown values last', async () => {
    const { configureMessages, renderMessageList } = await import('./messages')
    configureMessages({ loadMailboxes: vi.fn(), handleUnauthorized: vi.fn() })
    renderMessageList([
      {
        id: 'newest',
        mailbox: 'orders',
        subject: 'Newest',
        date: '2026-08-27T12:00:00Z',
        size: 300,
      },
      {
        id: 'largest',
        mailbox: 'orders',
        subject: 'Largest',
        date: '2026-08-27T10:00:00Z',
        size: 500,
      },
      {
        id: 'smallest',
        mailbox: 'orders',
        subject: 'Smallest',
        date: '2026-08-27T11:00:00Z',
        size: 100,
      },
      {
        id: 'unknown',
        mailbox: 'orders',
        subject: 'Unknown',
        date: 'not-a-date',
      },
    ])
    const subjects = () =>
      [...document.querySelectorAll('.message-summary strong')].map(
        (subject) => subject.textContent,
      )

    expect(subjects()).toEqual(['Newest', 'Smallest', 'Largest', 'Unknown'])

    document.querySelector('input[value="oldest"]').click()
    expect(subjects()).toEqual(['Largest', 'Smallest', 'Newest', 'Unknown'])

    document.querySelector('input[value="largest"]').click()
    expect(subjects()).toEqual(['Largest', 'Newest', 'Smallest', 'Unknown'])

    document.querySelector('input[value="smallest"]').click()
    expect(subjects()).toEqual(['Smallest', 'Newest', 'Largest', 'Unknown'])
  })

  it('shows a successfully opened message as read', async () => {
    const message = {
      id: 'message-1',
      mailbox: 'gmail',
      subject: 'Welcome',
      from: 'sender@example.com',
      to: 'reader@example.com',
      date: '2026-08-27T12:00:00Z',
      body: { text: 'Hello' },
    }
    vi.stubGlobal('fetch', async (path) => {
      if (String(path).endsWith('/attachments')) {
        return { status: 200, ok: true, json: async () => [] }
      }
      if (String(path).endsWith('/read')) {
        return { status: 204, ok: true }
      }
      return { status: 200, ok: true, json: async () => message }
    })
    const { configureMessages, renderMessageList, selectMessage } =
      await import('./messages')
    configureMessages({ loadMailboxes: vi.fn(), handleUnauthorized: vi.fn() })
    renderMessageList([{ ...message, seen: false }])
    document.querySelector('#message-filter-unread').click()

    await selectMessage(message.mailbox, message.id)
    await vi.waitFor(() => {
      const summary = document.querySelector('.message-summary')
      expect(summary.classList.contains('read')).toBe(true)
      expect(summary.classList.contains('unread')).toBe(false)
      expect(summary.getAttribute('aria-label')).toContain('Read:')
      expect(summary.hidden).toBe(true)
      expect(document.querySelector('.message-filter-empty')?.textContent).toBe(
        'No messages match the selected filters.',
      )
    })
  })

  it('keeps an opened message unread when the read request fails', async () => {
    const message = {
      id: 'message-1',
      mailbox: 'gmail',
      subject: 'Welcome',
      from: 'sender@example.com',
      to: 'reader@example.com',
      date: '2026-08-27T12:00:00Z',
      body: { text: 'Hello' },
    }
    vi.stubGlobal('fetch', async (path) => {
      if (String(path).endsWith('/attachments')) {
        return { status: 200, ok: true, json: async () => [] }
      }
      if (String(path).endsWith('/read')) {
        return { status: 500, ok: false }
      }
      return { status: 200, ok: true, json: async () => message }
    })
    const { configureMessages, renderMessageList, selectMessage } =
      await import('./messages')
    configureMessages({ loadMailboxes: vi.fn(), handleUnauthorized: vi.fn() })
    renderMessageList([{ ...message, seen: false }])
    document.querySelector('#message-filter-unread').click()

    await selectMessage(message.mailbox, message.id)

    const summary = document.querySelector('.message-summary')
    expect(summary.classList.contains('unread')).toBe(true)
    expect(summary.classList.contains('read')).toBe(false)
    expect(summary.getAttribute('aria-label')).toContain('Unread:')
    expect(summary.hidden).toBe(false)
  })
})
