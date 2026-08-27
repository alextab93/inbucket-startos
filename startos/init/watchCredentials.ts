import { setAdminPassword } from '../actions/setAdminPassword'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

export const watchCredentials = sdk.setupOnInit(async (effects) => {
  const saved = await storeJson.read().const(effects)

  if (!saved?.adminPassword) {
    await sdk.action.createOwnTask(effects, setAdminPassword, 'critical', {
      reason: i18n(
        'Set the Inbucket Client password before starting Inbucket.',
      ),
    })
  }
})
