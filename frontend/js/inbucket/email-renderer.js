import { sanitize } from 'lettersanitizer'
import linkifyElement from 'linkify-element'
import { inlineImagePath } from './shared'

const safeDataImage = /^data:image\/(?:avif|gif|jpeg|png|webp);/i

const plaintextMarkup = (text) => {
  const wrapper = document.createElement('div')
  wrapper.textContent = text || 'This message has no displayable body.'
  linkifyElement(wrapper, {
    defaultProtocol: 'https',
    target: '_blank',
    rel: 'noopener noreferrer',
  })
  return wrapper.innerHTML
}

const rewriteLink = (rawUrl) => {
  const url = String(rawUrl || '').trim()
  const lower = url.toLowerCase()
  if (
    lower.startsWith('https://') ||
    lower.startsWith('http://') ||
    lower.startsWith('mailto:')
  ) {
    return url
  }
  return '#'
}

const emptyPresentation = { className: '', direction: '', id: '', style: '' }

const bodyPresentation = (sourceBody, rewriteExternalResources) => {
  try {
    const styleProbe = document.createElement('div')
    styleProbe.setAttribute('style', sourceBody.getAttribute('style') || '')
    const sanitizedProbe = sanitize(styleProbe.outerHTML, undefined, {
      noWrapper: true,
      rewriteExternalResources,
    })
    const probeDocument = new DOMParser().parseFromString(
      sanitizedProbe,
      'text/html',
    )
    const direction = sourceBody.getAttribute('dir')
    return {
      className: sourceBody.getAttribute('class') || '',
      direction: ['auto', 'ltr', 'rtl'].includes(direction) ? direction : '',
      id: sourceBody.getAttribute('id') || '',
      style: probeDocument.body.firstElementChild?.getAttribute('style') || '',
    }
  } catch {
    return emptyPresentation
  }
}

const escapeCssUrl = (value) =>
  String(value || '')
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\n', '')
    .replaceAll('\r', '')
    .replaceAll('\f', '')

const sanitizeStyles = (styles, rewriteExternalResources) =>
  styles
    .join('\n')
    .replace(/@import[\s\S]*?;/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/(?:behavior|-moz-binding)\s*:[^;}]+;?/gi, '')
    .replace(
      /url\(\s*(?:(['"])(.*?)\1|([^)]*))\s*\)/gi,
      (_match, _quote, quotedUrl, unquotedUrl) =>
        `url("${escapeCssUrl(rewriteExternalResources(quotedUrl ?? unquotedUrl))}")`,
    )

const prepareHtml = (source, rewriteExternalResources) => {
  const sourceDocument = new DOMParser().parseFromString(source, 'text/html')
  const presentation = bodyPresentation(
    sourceDocument.body,
    rewriteExternalResources,
  )
  const styleElements = [...sourceDocument.querySelectorAll('style')]
  const styles = sanitizeStyles(
    styleElements.map((style) => style.textContent || ''),
    rewriteExternalResources,
  )
  styleElements.forEach((style) => style.remove())
  const body = sanitize(sourceDocument.body.innerHTML, undefined, {
    noWrapper: true,
    rewriteExternalResources,
    rewriteExternalLinks: rewriteLink,
  })
  return { body, presentation, styles }
}

const preparePlaintext = (text) => ({
  body: sanitize(plaintextMarkup(text), undefined, {
    noWrapper: true,
    rewriteExternalLinks: rewriteLink,
  }),
  presentation: emptyPresentation,
  styles: '',
})

const framePath = (allowRemoteImages) =>
  allowRemoteImages ? '/v1/email-frame?remote_images=true' : '/v1/email-frame'

export const renderEmailBody = ({
  container,
  html,
  text,
  mailbox,
  messageId,
}) => {
  let destroyed = false
  let resizeObserver
  let iframe
  let loadHandler

  const disconnect = () => {
    resizeObserver?.disconnect()
    resizeObserver = undefined
    if (iframe && loadHandler) iframe.removeEventListener('load', loadHandler)
  }

  const render = (allowRemoteImages) => {
    if (destroyed) return
    disconnect()
    let blockedRemoteResources = false
    const rewriteResource = (rawUrl) => {
      const url = String(rawUrl || '').trim()
      const lower = url.toLowerCase()
      if (lower.startsWith('cid:')) {
        try {
          const cid = decodeURIComponent(url.slice(4))
          return cid ? inlineImagePath(mailbox, messageId, cid) : 'about:blank'
        } catch {
          return 'about:blank'
        }
      }
      if (safeDataImage.test(url)) return url
      const remoteUrl = lower.startsWith('//') ? `https:${url}` : url
      if (
        remoteUrl.toLowerCase().startsWith('https://') ||
        remoteUrl.toLowerCase().startsWith('http://')
      ) {
        if (allowRemoteImages) return remoteUrl
        blockedRemoteResources = true
      }
      return 'about:blank'
    }

    const prepared = html
      ? prepareHtml(html, rewriteResource)
      : preparePlaintext(text)

    const content = document.createDocumentFragment()
    if (html && blockedRemoteResources && !allowRemoteImages) {
      const toolbar = document.createElement('div')
      toolbar.className = 'message-remote-content'
      const message = document.createElement('span')
      message.textContent = 'Remote images are blocked for privacy.'
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'button button-secondary'
      button.textContent = 'Load remote images'
      button.addEventListener('click', () => render(true))
      toolbar.append(message, button)
      content.append(toolbar)
    }

    iframe = document.createElement('iframe')
    iframe.title = 'Email message body'
    iframe.setAttribute(
      'sandbox',
      'allow-same-origin allow-popups allow-popups-to-escape-sandbox',
    )
    iframe.referrerPolicy = 'no-referrer'
    loadHandler = () => {
      if (destroyed || !iframe?.contentDocument) return
      const doc = iframe.contentDocument
      if (!doc.head || !doc.body) return
      doc.head
        .querySelectorAll('style[data-email-style]')
        .forEach((style) => style.remove())
      const emailStyle = doc.createElement('style')
      emailStyle.dataset.emailStyle = 'true'
      emailStyle.textContent = prepared.styles
      doc.head.append(emailStyle)
      doc.body.id = prepared.presentation.id
      doc.body.className = prepared.presentation.className
      if (prepared.presentation.direction) {
        doc.body.dir = prepared.presentation.direction
      } else {
        doc.body.removeAttribute('dir')
      }
      if (prepared.presentation.style) {
        doc.body.setAttribute('style', prepared.presentation.style)
      } else {
        doc.body.removeAttribute('style')
      }
      if (!html) doc.body.style.whiteSpace = 'pre-wrap'
      doc.body.innerHTML = prepared.body
      const resize = () => {
        if (destroyed || !iframe?.contentDocument) return
        const height = Math.max(
          doc.documentElement.scrollHeight,
          doc.body?.scrollHeight || 0,
          240,
        )
        iframe.style.height = `${height}px`
      }
      resize()
      if (typeof ResizeObserver === 'function') {
        resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(iframe.contentDocument.documentElement)
      }
    }
    iframe.addEventListener('load', loadHandler)
    iframe.src = framePath(allowRemoteImages)
    content.append(iframe)
    container.replaceChildren(content)
  }

  render(false)

  return {
    setRemoteImagesAllowed: render,
    destroy() {
      destroyed = true
      disconnect()
    },
  }
}
