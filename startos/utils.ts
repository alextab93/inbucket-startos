import { sdk } from './sdk'

export const webPort = 9000
export const smtpPort = 2500
export const pop3Port = 1100
export const clientPort = 3000
export const webHostId = 'web'
export const clientHostId = 'client'
export const databaseName = 'inbucket_client_production'
export const databaseUser = 'inbucket_client'

export const mounts = sdk.Mounts.of()
  .mountVolume({
    volumeId: 'main',
    subpath: 'config',
    mountpoint: '/config',
    readonly: false,
  })
  .mountVolume({
    volumeId: 'main',
    subpath: 'storage',
    mountpoint: '/storage',
    readonly: false,
  })
