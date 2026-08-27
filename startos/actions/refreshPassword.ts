import { utils } from '@start9labs/start-sdk'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

export const refreshPassword = sdk.Action.withoutInput(
  'refresh-login-password',
  {
    name: i18n('Refresh Login Password'),
    description: i18n(
      'Generate a new password and restart the service to apply it.',
    ),
    warning: i18n(
      'This immediately invalidates the current password and signs out every Inbucket Client session.',
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

    const adminPassword = utils.getDefaultString({
      charset: 'a-z,A-Z,0-9',
      len: 32,
    })
    await storeJson.merge(effects, { adminPassword })
    await effects.restart()

    return {
      version: '1',
      title: i18n('Inbucket Login Password Refreshed'),
      message: i18n(
        'The service is restarting. Use this new password once it is ready.',
      ),
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
            name: i18n('New Password'),
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
