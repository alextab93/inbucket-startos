import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '3.1.1:0',
  releaseNotes: {
    en_US:
      'Initial StartOS release with persistent mail storage, domain-restricted inbound SMTP, webmail, and REST API access.',
    es_ES:
      'Versión inicial para StartOS con almacenamiento persistente, SMTP entrante restringido por dominio, webmail y acceso API REST.',
    de_DE:
      'Erste StartOS-Version mit persistentem Nachrichtenspeicher, domainbeschränktem eingehendem SMTP, Webmail und REST-API.',
    pl_PL:
      'Pierwsze wydanie dla StartOS z trwałym przechowywaniem poczty, przychodzącym SMTP ograniczonym do domeny, webmailem i API REST.',
    fr_FR:
      'Version initiale pour StartOS avec stockage persistant, SMTP entrant limité au domaine, webmail et accès API REST.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
