import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '3.1.1:3',
  releaseNotes: {
    en_US:
      'Adds the authenticated Inbucket client with private PostgreSQL state while retaining the upstream admin interface and inbound SMTP.',
    es_ES:
      'Añade ajustes de StartOS para la retención de mensajes y el límite de mensajes por buzón.',
    de_DE:
      'Fügt StartOS-Einstellungen für die Nachrichtenaufbewahrung und das Nachrichtenlimit pro Postfach hinzu.',
    pl_PL:
      'Dodaje ustawienia StartOS dotyczące czasu przechowywania wiadomości i limitu wiadomości na skrzynkę.',
    fr_FR:
      'Ajoute des réglages StartOS pour la durée de conservation et la limite de messages par boîte.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
