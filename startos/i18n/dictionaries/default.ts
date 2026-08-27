export const DEFAULT_LANG = 'en_US'

const dict = {
  'Web Interface': 0,
  'The web interface is ready': 1,
  'The web interface is not ready': 2,
  'Inbound SMTP': 3,
  'The inbound SMTP listener is ready': 4,
  'The inbound SMTP listener is not ready': 5,
  'Browse disposable mailboxes and inspect received messages': 6,
  'REST API': 7,
  'Programmatic access to Inbucket mailboxes and messages': 8,
  'Receive messages for the configured disposable mail domain': 9,
  'Disposable Mail Domain': 10,
  'Inbucket accepts and stores messages only for this domain. Configure its MX record separately.': 11,
  'Enter a fully qualified domain such as temp.example.com, without a scheme, path, port, or trailing dot.': 12,
  'Configure Domain': 13,
  'Choose the recipient domain accepted by the inbound SMTP listener.': 14,
  'Messages addressed to any other domain will be rejected. Changing the domain does not rename existing mailboxes.': 15,
  'Domain Saved': 16,
  'Inbucket will accept and store mail for the configured domain. DNS and public TCP forwarding must be configured separately.': 17,
  'Configure the disposable mail domain before starting Inbucket.': 18,
  'Message Retention': 19,
  'Delete messages after this amount of time.': 20,
  '15 minutes': 21,
  '1 hour': 22,
  '6 hours': 23,
  '24 hours': 24,
  '7 days': 25,
  'Messages per Mailbox': 26,
  'Older messages are deleted when this limit is exceeded.': 27,
  'Configure Inbucket': 28,
  'Choose the recipient domain, message retention period, per-mailbox message limit, and maximum SMTP message size.': 29,
  'Configuration Saved': 30,
  'Inbucket will use the configured domain, storage limits, and maximum SMTP message size. DNS and public TCP forwarding must be configured separately.': 31,
  'Messages addressed to any other domain will be rejected. Changing the domain does not rename existing mailboxes. Reducing retention or a storage limit can delete or reject messages.': 32,
  'Maximum Message Size': 33,
  'Maximum accepted SMTP message size in MiB, including headers and MIME encoding.': 34,
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
