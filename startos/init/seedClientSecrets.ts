import { utils } from '@start9labs/start-sdk'
import { storeJson } from '../fileModels/store.json'
import { sdk } from '../sdk'

export const seedClientSecrets = sdk.setupOnInit(async (effects) => {
  const current = await storeJson.read().once()
  if (
    current?.databasePassword &&
    current.secretKeyBase &&
    current.adminUsername &&
    current.adminPassword
  ) {
    return
  }

  await storeJson.merge(effects, {
    databasePassword:
      current?.databasePassword ||
      utils.getDefaultString({
        charset: 'a-z,A-Z,0-9',
        len: 48,
      }),
    secretKeyBase:
      current?.secretKeyBase ||
      utils.getDefaultString({
        charset: 'a-z,A-Z,0-9',
        len: 128,
      }),
    adminUsername: current?.adminUsername || 'admin',
    adminPassword:
      current?.adminPassword ||
      utils.getDefaultString({
        charset: 'a-z,A-Z,0-9',
        len: 32,
      }),
  })
})
