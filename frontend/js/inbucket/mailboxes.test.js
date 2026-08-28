import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('mailbox catalog refresh', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    document.body.innerHTML = '<div id="mailbox-view" hidden></div>'
  })

  it('does not request mailbox catalogs while signed out', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const { refreshMailboxCatalog } = await import('./mailboxes')

    await refreshMailboxCatalog()

    expect(fetch).not.toHaveBeenCalled()
  })
})
