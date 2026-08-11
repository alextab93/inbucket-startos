import { sdk } from './sdk'

export const webPort = 9000
export const smtpPort = 2500
export const pop3Port = 1100

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
