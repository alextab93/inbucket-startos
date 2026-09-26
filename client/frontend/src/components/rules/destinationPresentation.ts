import type {
  NotificationDestination,
  NotificationDestinationMethod,
} from '../../types'

export const destinationMethodName = (
  kind: NotificationDestinationMethod['kind'],
): string =>
  kind === 'ntfy' ? 'ntfy' : `${kind[0].toUpperCase()}${kind.slice(1)}`

const safeWebhookUrl = (value: string): string => {
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}${url.search ? '?query configured' : ''}`
  } catch {
    return value
  }
}

export const destinationMethodSummary = (
  method: NotificationDestinationMethod,
): string => {
  if (method.kind === 'email') return method.recipients.join(', ')
  if (method.kind === 'ntfy') {
    return `${method.host.replace(/\/$/, '')}/${method.topic}`
  }
  return `${method.method} ${safeWebhookUrl(method.url)}`
}

export const destinationTestPreview = (
  destination: NotificationDestination,
  method: NotificationDestinationMethod,
): string => {
  if (method.kind === 'webhook') {
    if (method.body) return 'The configured request body will be sent unchanged.'

    return JSON.stringify(
      {
        event: 'inbucket.notification.test',
        destination: destination.name,
        method: method.kind,
        test: true,
      },
      null,
      2,
    )
  }
  return [
    `This is a test from Inbucket for ${destination.name}.`,
    '',
    `Delivery method: ${method.kind}`,
    'If you received this message, the delivery method is working.',
  ].join('\n')
}
