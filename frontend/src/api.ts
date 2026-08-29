import type {
  ArchivedMailbox,
  Attachment,
  MessageSummary,
  MonitorSummary,
  ParsedMessage,
  Session,
} from './types'

type ResponseType = 'json' | 'text' | 'empty' | 'blob'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message = 'request_failed') {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const assertRelativePath = (path: string): void => {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error('API paths must be relative to the current origin')
  }
}

const request = async <T>(
  path: string,
  options: RequestInit = {},
  responseType: ResponseType = 'json',
): Promise<T> => {
  assertRelativePath(path)
  let response: Response
  try {
    response = await fetch(path, { credentials: 'include', ...options })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw error
    throw new ApiError(0, 'network_error')
  }
  if (!response.ok) {
    let message = 'request_failed'
    try {
      const body = (await response.clone().json()) as { error?: unknown }
      if (typeof body.error === 'string') message = body.error
    } catch {
      message = 'request_failed'
    }
    throw new ApiError(response.status, message)
  }
  if (responseType === 'empty') return undefined as T
  if (responseType === 'text') return (await response.text()) as T
  if (responseType === 'blob') return (await response.blob()) as T
  return (await response.json()) as T
}

const jsonOptions = (
  method: string,
  body?: unknown,
  signal?: AbortSignal,
): RequestInit => ({
  method,
  signal,
  headers:
    body === undefined ? undefined : { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
})

const encode = (value: string | number): string =>
  encodeURIComponent(String(value))

const mailboxPath = (mailbox: string): string =>
  `/v1/inbucket/mailbox?name=${encode(mailbox)}`

const archiveMailboxPath = (mailbox: string, archived = true): string =>
  `/v1/inbucket/mailbox/archive?name=${encode(mailbox)}${archived ? '' : '&archived=false'}`

const messagePath = (
  mailbox: string,
  id: string | number,
  suffix = '',
): string =>
  `/v1/inbucket/mailboxes/${encode(mailbox)}/messages/${encode(id)}${suffix}`

const deleteMessagePath = (mailbox: string, id: string | number): string =>
  `/v1/inbucket/message?name=${encode(mailbox)}&id=${encode(id)}`

export const visibleError = (error: unknown, subject: string): string => {
  if (error instanceof ApiError) {
    if (error.status === 404) return `${subject} was not found.`
    if (error.status === 422) return `${subject} response was invalid.`
    if (error.status === 502 || error.status === 0) {
      return 'Inbucket is temporarily unavailable. Please try again.'
    }
  }
  return `${subject} could not be loaded. Please try again.`
}

export const isUnauthorized = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 401

export const isAbort = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

export const api = {
  session: (signal?: AbortSignal) =>
    request<Session>('/v1/session', { signal }),
  login: (username: string, password: string, signal?: AbortSignal) =>
    request<Session>(
      '/v1/session',
      jsonOptions('POST', { username, password }, signal),
    ),
  logout: (signal?: AbortSignal) =>
    request<void>(
      '/v1/session',
      jsonOptions('DELETE', undefined, signal),
      'empty',
    ),
  activeMailboxes: (signal?: AbortSignal) =>
    request<string[]>('/v1/inbucket/mailboxes', { signal }),
  archivedMailboxes: (signal?: AbortSignal) =>
    request<ArchivedMailbox[]>('/v1/inbucket/mailboxes?archived=true', {
      signal,
    }),
  mailbox: (mailbox: string, signal?: AbortSignal) =>
    request<MessageSummary[]>(mailboxPath(mailbox), { signal }),
  archiveMailbox: (mailbox: string, signal?: AbortSignal) =>
    request<void>(
      archiveMailboxPath(mailbox),
      jsonOptions('PATCH', undefined, signal),
      'empty',
    ),
  restoreMailbox: (mailbox: string, signal?: AbortSignal) =>
    request<void>(
      archiveMailboxPath(mailbox, false),
      jsonOptions('PATCH', undefined, signal),
      'empty',
    ),
  purgeMailbox: (mailbox: string, signal?: AbortSignal) =>
    request<void>(
      mailboxPath(mailbox),
      jsonOptions('DELETE', undefined, signal),
      'empty',
    ),
  monitorMessages: (signal?: AbortSignal) =>
    request<MonitorSummary[]>('/v1/inbucket/monitor/messages', { signal }),
  message: (mailbox: string, id: string | number, signal?: AbortSignal) =>
    request<ParsedMessage>(messagePath(mailbox, id), { signal }),
  markRead: (mailbox: string, id: string | number, signal?: AbortSignal) =>
    request<void>(
      messagePath(mailbox, id, '/read'),
      jsonOptions('PATCH', undefined, signal),
      'empty',
    ),
  messageSource: (mailbox: string, id: string | number, signal?: AbortSignal) =>
    request<string>(messagePath(mailbox, id, '/source'), { signal }, 'text'),
  attachments: (mailbox: string, id: string | number, signal?: AbortSignal) =>
    request<Attachment[]>(messagePath(mailbox, id, '/attachments'), { signal }),
  attachmentUrl: (mailbox: string, id: string | number, index: number) =>
    messagePath(mailbox, id, `/attachments/${encode(index)}`),
  download: (path: string, signal?: AbortSignal) =>
    request<Blob>(path, { signal }, 'blob'),
  inlineImageUrl: (mailbox: string, id: string | number, cid: string) =>
    `${messagePath(mailbox, id, '/inline-image')}?cid=${encode(cid)}`,
  emailFrameUrl: (remoteImages = false) =>
    remoteImages ? '/v1/email-frame?remote_images=true' : '/v1/email-frame',
  deleteMessage: (mailbox: string, id: string | number, signal?: AbortSignal) =>
    request<void>(
      deleteMessagePath(mailbox, id),
      jsonOptions('DELETE', undefined, signal),
      'empty',
    ),
}
