export type ViewName = 'mailboxes' | 'starred' | 'monitor' | 'archive'

export type AuthenticationState =
  | 'checking'
  | 'signed-out'
  | 'authenticating'
  | 'authenticated'
  | 'expired'
  | 'unavailable'

export type ReadFilter = 'all' | 'read' | 'unread'

export type ListSort = 'newest' | 'oldest' | 'largest' | 'smallest'

export type HeaderValue =
  | string
  | number
  | null
  | undefined
  | HeaderValue[]
  | { address?: string; email?: string; name?: string }

export interface Session {
  authenticated: true
  username: string
  expires_at: string
}

export interface ArchivedMailbox {
  name: string
  message_count: number | null
}

export interface MessageBody {
  html?: HeaderValue
  text?: HeaderValue
}

export interface MessageSummary {
  id: string | number
  mailbox: string
  subject?: HeaderValue
  from?: HeaderValue
  to?: HeaderValue
  date?: HeaderValue
  size?: number | string | null
  seen?: boolean | unknown
  starred?: boolean | unknown
  'posix-millis'?: number | string
  header?: Record<string, HeaderValue>
}

export interface ParsedMessage extends MessageSummary {
  body?: MessageBody
}

export interface Attachment {
  index: number
  filename: string
  content_type: string
  size: number
}

export interface MonitorSummary extends MessageSummary {
  mailbox: string
}

export interface StatusValue {
  message: string
  state?: 'authenticated' | 'error' | 'loading' | 'expired' | 'signed-out'
}

export interface SelectedMessage {
  mailbox: string
  id: string
}
