import { beforeEach, describe, expect, it, vi } from 'vitest'

const setupDocument = () => {
  document.body.innerHTML = `
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
        read: false,
      },
      {
        id: 'read-message',
        mailbox: 'gmail',
        subject: 'Read subject',
        from: 'read@example.com',
        date: '2026-08-27T11:00:00Z',
        read: true,
      },
    ])

    const [unread, read] = document.querySelectorAll('.message-summary')
    expect(unread.classList.contains('unread')).toBe(true)
    expect(unread.getAttribute('aria-label')).toContain('Unread:')
    expect(read.classList.contains('read')).toBe(true)
    expect(read.getAttribute('aria-label')).toContain('Read:')
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
    const { renderMessageList, selectMessage } = await import('./messages')
    renderMessageList([{ ...message, read: false }])

    await selectMessage(message.mailbox, message.id)
    await vi.waitFor(() => {
      const summary = document.querySelector('.message-summary')
      expect(summary.classList.contains('read')).toBe(true)
      expect(summary.classList.contains('unread')).toBe(false)
      expect(summary.getAttribute('aria-label')).toContain('Read:')
    })
  })
})
