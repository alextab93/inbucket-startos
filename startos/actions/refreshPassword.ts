import { utils } from '@start9labs/start-sdk'
import { storeJson } from '../fileModels/store.json'
import { sdk } from '../sdk'

export const refreshPassword = sdk.Action.withoutInput(
  'refresh-login-password',
  {
    name: 'Refresh Login Password',
    description: 'Generate a new password and restart the service to apply it.',
    warning:
      'This immediately invalidates the current password and signs out every Inbucket Client session.',
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  },
  async ({ effects }) => {
    const saved = await storeJson.read().const(effects)
    if (!saved?.adminUsername || !saved.adminPassword) {
      throw new Error('Login credentials are not initialized')
    }

    const adminPassword = utils.getDefaultString({
      charset: 'a-z,A-Z,0-9',
      len: 32,
    })
    await storeJson.merge(effects, { adminPassword })
    await effects.restart()

    return {
      version: '1',
      title: 'Inbucket Login Password Refreshed',
      message:
        'The service is restarting. Use this new password once it is ready.',
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
            name: 'New Password',
            description: null,
            value: adminPassword,
            copyable: true,
            qr: false,
            masked: true,
          },
        ],
      },
    }
  },
)
