import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '3.1.1:6',
  releaseNotes: {
    en_US: 'Recent messages are shown when Mailboxes opens.',
    es_ES: 'Los mensajes recientes se muestran al abrir Buzones.',
    de_DE: 'Beim Öffnen von Postfächern werden aktuelle Nachrichten angezeigt.',
    pl_PL:
      'Najnowsze wiadomości są wyświetlane po otwarciu skrzynek pocztowych.',
    fr_FR:
      'Les messages récents s’affichent à l’ouverture des boîtes aux lettres.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
