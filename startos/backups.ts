import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'
import { databaseName, databaseUser } from './utils'

export const { createBackup, restoreInit } = sdk.setupBackups(async () =>
  sdk.Backups.withPgDump({
    imageId: 'postgres',
    dbVolume: 'client-postgres',
    mountpoint: '/var/lib/postgresql/data',
    pgdataPath: '',
    database: databaseName,
    user: databaseUser,
    password: async () => {
      const password = await storeJson
        .read((value) => value.databasePassword)
        .once()
      if (!password)
        throw new Error(i18n('Database password is not initialized'))
      return password
    },
  })
    .addVolume('main')
    .addVolume('client-config'),
)
