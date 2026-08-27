import { utils } from '@start9labs/start-sdk'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

export const setAdminPassword = sdk.Action.withoutInput(
  'set-admin-password',

  async ({ effects }) => {
    const saved = await storeJson.read().const(effects)
    return {
      name: i18n('Set Admin Password'),
      description: i18n(
        'Generate the password for the Inbucket Client, the authenticated mailbox reader.',
      ),
      warning: saved?.adminPassword
        ? i18n(
            'The current password stops working at once, and every open session is signed out.',
          )
        : null,
      allowedStatuses: 'any',
      group: null,
      visibility: 'enabled',
    }
  },

  async ({ effects }) => {
    const saved = await storeJson.read().once()
    const adminPassword = utils.getDefaultString({
      charset: 'a-z,A-Z,0-9',
      len: 32,
    })
    await storeJson.merge(effects, { adminPassword })

    return {
      version: '1',
      title: i18n('Inbucket Client Password'),
      message: i18n(
        'Save this password — it is shown once, and running this action again replaces it.',
      ),
      result: {
        type: 'group',
        value: [
          {
            type: 'single',
            name: i18n('Username'),
            description: null,
            value: saved?.adminUsername ?? 'admin',
            copyable: true,
            qr: false,
            masked: false,
          },
          {
            type: 'single',
            name: i18n('Password'),
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
