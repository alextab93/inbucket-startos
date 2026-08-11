import { configureDomain } from '../actions/configureDomain'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

export const requireDomain = sdk.setupOnInit(async (effects) => {
  const domain = await storeJson.read((store) => store.domain).const(effects)

  if (!domain) {
    await sdk.action.createOwnTask(effects, configureDomain, 'critical', {
      reason: i18n(
        'Configure the disposable mail domain before starting Inbucket.',
      ),
    })
  }
})
