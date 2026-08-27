import { domainRegex, storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  domain: Value.text({
    name: i18n('Disposable Mail Domain'),
    description: i18n(
      'Inbucket accepts mail addressed to this domain and rejects everything else. It is a filter, not a claim of ownership — nothing here is looked up in DNS. Use a name you own if you want mail from the internet; otherwise any reserved name will do, such as mailbox.test.',
    ),
    required: true,
    default: null,
    inputmode: 'url',
    placeholder: 'mailbox.test',
    maxLength: 253,
    patterns: [
      {
        regex: domainRegex.source,
        description: i18n(
          'Enter a dotted domain such as mailbox.test, without a scheme, path, port, or trailing dot.',
        ),
      },
    ],
  }),
  retentionPeriod: Value.select({
    name: i18n('Message Retention'),
    description: i18n('Delete messages after this amount of time.'),
    default: '1h',
    values: {
      '15m': i18n('15 minutes'),
      '1h': i18n('1 hour'),
      '6h': i18n('6 hours'),
      '24h': i18n('24 hours'),
      '168h': i18n('7 days'),
    },
  }),
  mailboxMessageCap: Value.number({
    name: i18n('Messages per Mailbox'),
    description: i18n(
      'Older messages are deleted when this limit is exceeded.',
    ),
    required: true,
    default: 300,
    integer: true,
    min: 1,
    max: 10000,
  }),
})

export const configureDomain = sdk.Action.withInput(
  'configure-domain',
  {
    name: i18n('Configure Inbucket'),
    description: i18n(
      'Choose the recipient domain, message retention period, and per-mailbox message limit.',
    ),
    warning: i18n(
      'Messages addressed to any other domain will be rejected. Changing the domain does not rename existing mailboxes. Reducing retention or the message limit can delete older stored messages.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  },
  inputSpec,
  async () => {
    const config = await storeJson.read((store) => store).once()
    return {
      domain: config?.domain || undefined,
      retentionPeriod: config?.retentionPeriod ?? '1h',
      mailboxMessageCap: config?.mailboxMessageCap ?? 300,
    }
  },
  async ({ effects, input }) => {
    const domain = input.domain.trim().toLowerCase()
    if (!domainRegex.test(domain)) {
      throw new Error('Invalid disposable mail domain')
    }
    await storeJson.merge(effects, {
      domain,
      retentionPeriod: input.retentionPeriod,
      mailboxMessageCap: input.mailboxMessageCap,
    })

    return {
      version: '1',
      title: i18n('Configuration Saved'),
      message: i18n(
        'Inbucket is restarting with the configured domain and storage limits. DNS and public TCP forwarding must be configured separately.',
      ),
      result: null,
    }
  },
)
