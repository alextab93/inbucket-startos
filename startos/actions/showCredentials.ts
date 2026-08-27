import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

export const showCredentials = sdk.Action.withoutInput(
  'show-credentials',
  {
    name: i18n('Show Login Credentials'),
    description: i18n(
      'Display the generated username and password for the web interface.',
    ),
    warning: i18n(
      'Anyone with these credentials can read every Inbucket mailbox.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  },
  async ({ effects }) => {
    const saved = await storeJson.read().const(effects)
    if (!saved?.adminUsername || !saved.adminPassword) {
      throw new Error(i18n('Login credentials are not initialized'))
    }

    return {
      version: '1',
      title: i18n('Inbucket Login Credentials'),
      message: i18n('Use these credentials to sign in to the Inbucket Client.'),
      result: {
        type: 'group' as const,
        value: [
          {
            type: 'single' as const,
            name: i18n('Username'),
            description: null,
            value: saved.adminUsername,
            copyable: true,
            qr: false,
            masked: false,
          },
          {
            type: 'single' as const,
            name: i18n('Password'),
            description: null,
            value: saved.adminPassword,
            copyable: true,
            qr: false,
            masked: true,
          },
        ],
      },
    }
  },
)
