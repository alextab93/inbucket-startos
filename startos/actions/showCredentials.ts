import { storeJson } from '../fileModels/store.json'
import { sdk } from '../sdk'

export const showCredentials = sdk.Action.withoutInput(
  'show-credentials',
  {
    name: 'Show Login Credentials',
    description:
      'Display the generated username and password for the web interface.',
    warning: 'Anyone with these credentials can read every Inbucket mailbox.',
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  },
  async ({ effects }) => {
    const saved = await storeJson.read().const(effects)
    if (!saved?.adminUsername || !saved.adminPassword) {
      throw new Error('Login credentials are not initialized')
    }

    return {
      version: '1',
      title: 'Inbucket Login Credentials',
      message: 'Use these credentials to sign in to the Inbucket Client.',
      result: {
        type: 'group' as const,
        value: [
          {
            type: 'single' as const,
            name: 'Username',
            description: null,
            value: saved.adminUsername,
            copyable: true,
            qr: false,
            masked: false,
          },
          {
            type: 'single' as const,
            name: 'Password',
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
