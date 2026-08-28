import { beforeEach, describe, expect, it, vi } from 'vitest'

const setupDocument = () => {
  document.body.innerHTML = `
    <div id="mailbox-view"></div>
    <section id="monitor-view"></section>
    <p id="monitor-status"></p>
    <input id="monitor-search" type="search">
    <div id="monitor-filter-control">
      <button id="monitor-filter-trigger" type="button" aria-label="Filter and sort monitored messages" aria-expanded="false" aria-controls="monitor-filter-panel"></button>
      <div id="monitor-filter-panel" hidden>
        <input id="monitor-filter-read" type="checkbox">
        <input id="monitor-filter-unread" type="checkbox">
        <input type="radio" name="monitor-sort" value="newest" checked>
        <input type="radio" name="monitor-sort" value="oldest">
        <input type="radio" name="monitor-sort" value="largest">
        <input type="radio" name="monitor-sort" value="smallest">
      </div>
    </div>
    <div id="monitor-message-list"></div>
  `
}

const response = (messages) => ({
  status: 200,
  ok: true,
  json: async () => messages,
})

describe('realtime monitor message state', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    setupDocument()
  })

  it('distinguishes and filters unread monitored messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response([
          {
            id: 'unread-message',
            mailbox: 'orders',
            subject: 'August invoice',
            from: 'billing@example.com',
            to: ['alex@example.com'],
            date: '2026-08-27T12:00:00Z',
            seen: false,
          },
          {
            id: 'read-message',
            mailbox: 'support',
            subject: 'Welcome aboard',
            from: 'hello@example.com',
            to: ['team@example.com'],
            date: '2026-08-26T12:00:00Z',
            seen: true,
          },
        ]),
      ),
    )
    const { configureMonitor, refreshMonitorMessages } =
      await import('./monitor')
    configureMonitor({ handleUnauthorized: vi.fn(), showView: vi.fn() })

    await refreshMonitorMessages()

    const search = document.querySelector('#monitor-search')
    const unreadFilter = document.querySelector('#monitor-filter-unread')
    const [unread, read] = document.querySelectorAll('.monitor-message')
    expect(unread.classList.contains('unread')).toBe(true)
    expect(unread.getAttribute('aria-label')).toContain('Unread:')
    expect(read.classList.contains('read')).toBe(true)
    expect(read.getAttribute('aria-label')).toContain('Read:')

    for (const query of [
      'BILLING',
      'alex@example.com',
      'orders',
      'August invoice',
    ]) {
      search.value = query
      search.dispatchEvent(new Event('input'))
      expect(unread.hidden).toBe(false)
      expect(read.hidden).toBe(true)
    }

    search.value = ''
    search.dispatchEvent(new Event('input'))
    unreadFilter.click()
    expect(unreadFilter.checked).toBe(true)
    expect(unread.hidden).toBe(false)
    expect(read.hidden).toBe(true)

    search.value = 'missing'
    search.dispatchEvent(new Event('input'))
    expect(document.querySelector('.monitor-filter-empty')?.textContent).toBe(
      'No monitored messages match your search and filters.',
    )
  })

  it('sorts monitored messages and preserves the selection after refresh', async () => {
    const messages = [
      {
        id: 'newest',
        mailbox: 'orders',
        subject: 'Newest',
        date: '2026-08-27T12:00:00Z',
        size: 300,
        seen: false,
      },
      {
        id: 'largest',
        mailbox: 'orders',
        subject: 'Largest',
        date: '2026-08-27T10:00:00Z',
        size: 500,
        seen: true,
      },
      {
        id: 'smallest',
        mailbox: 'orders',
        subject: 'Smallest',
        date: '2026-08-27T11:00:00Z',
        size: 100,
        seen: false,
      },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(messages)),
    )
    const { configureMonitor, refreshMonitorMessages } =
      await import('./monitor')
    configureMonitor({ handleUnauthorized: vi.fn(), showView: vi.fn() })
    await refreshMonitorMessages()
    document.querySelector('input[value="largest"]').click()
    document.querySelector('#monitor-filter-unread').click()

    await refreshMonitorMessages()

    const visibleSubjects = [
      ...document.querySelectorAll('.monitor-message:not([hidden])'),
    ].map(
      (message) =>
        message.querySelector('.monitor-message-subject').textContent,
    )
    expect(visibleSubjects).toEqual(['Newest', 'Smallest'])
    expect(document.querySelector('input[value="largest"]').checked).toBe(true)
    expect(document.querySelector('#monitor-filter-unread').checked).toBe(true)
  })

  it('uses refreshed server state for the unread indicator', async () => {
    const message = {
      id: 'message-1',
      mailbox: 'orders',
      subject: 'Invoice',
      from: 'billing@example.com',
      date: '2026-08-27T12:00:00Z',
    }
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response([{ ...message, seen: false }]))
      .mockResolvedValueOnce(response([{ ...message, seen: true }]))
    vi.stubGlobal('fetch', fetch)
    const { configureMonitor, refreshMonitorMessages } =
      await import('./monitor')
    configureMonitor({ handleUnauthorized: vi.fn(), showView: vi.fn() })

    await refreshMonitorMessages()
    expect(
      document.querySelector('.monitor-message').classList.contains('unread'),
    ).toBe(true)

    await refreshMonitorMessages()
    const refreshed = document.querySelector('.monitor-message')
    expect(refreshed.classList.contains('read')).toBe(true)
    expect(refreshed.getAttribute('aria-label')).toContain('Read:')
  })

  it('does not request monitor messages while signed out', async () => {
    document.querySelector('#mailbox-view').hidden = true
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const { refreshMonitorMessages } = await import('./monitor')

    await refreshMonitorMessages()

    expect(fetch).not.toHaveBeenCalled()
  })
})
