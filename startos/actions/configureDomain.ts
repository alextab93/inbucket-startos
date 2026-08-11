import { domainRegex, storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  domain: Value.text({
    name: i18n('Disposable Mail Domain'),
    description: i18n(
      'Inbucket accepts and stores messages only for this domain. Configure its MX record separately.',
    ),
    required: true,
    default: null,
    inputmode: 'url',
    placeholder: 'temp.example.com',
    maxLength: 253,
    patterns: [
      {
        regex: domainRegex.source,
        description: i18n(
          'Enter a fully qualified domain such as temp.example.com, without a scheme, path, port, or trailing dot.',
        ),
      },
    ],
  }),
})

export const configureDomain = sdk.Action.withInput(
  'configure-domain',
  {
    name: i18n('Configure Domain'),
    description: i18n(
      'Choose the recipient domain accepted by the inbound SMTP listener.',
    ),
    warning: i18n(
      'Messages addressed to any other domain will be rejected. Changing the domain does not rename existing mailboxes.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  },
  inputSpec,
  async () => {
    const domain = await storeJson.read((store) => store.domain).once()
    return { domain: domain || undefined }
  },
  async ({ effects, input }) => {
    const domain = input.domain.trim().toLowerCase()
    if (!domainRegex.test(domain)) {
      throw new Error('Invalid disposable mail domain')
    }
    await storeJson.merge(effects, { domain })

    return {
      version: '1',
      title: i18n('Domain Saved'),
      message: i18n(
        'Inbucket will accept and store mail for the configured domain. DNS and public TCP forwarding must be configured separately.',
      ),
      result: null,
    }
  },
)
