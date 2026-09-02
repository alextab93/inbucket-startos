import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '3.1.1:5',
  releaseNotes: {
    en_US: 'Initial release',
    es_ES: 'Versión inicial',
    de_DE: 'Erste Veröffentlichung',
    pl_PL: 'Pierwsze wydanie',
    fr_FR: 'Première version',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
