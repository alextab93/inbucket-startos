import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '3.1.1:10',
  releaseNotes: {
    en_US:
      'Tracks read messages in the private mailbox client and makes unread messages visually distinct while preserving a separate selected-message state.',
    es_ES:
      'Registra los mensajes leídos en el cliente privado y distingue visualmente los mensajes no leídos sin confundirlos con el mensaje seleccionado.',
    de_DE:
      'Speichert gelesene Nachrichten im privaten Postfach und kennzeichnet ungelesene Nachrichten deutlich, unabhängig von der ausgewählten Nachricht.',
    pl_PL:
      'Zapisuje stan przeczytania wiadomości w prywatnym kliencie i wyraźnie odróżnia wiadomości nieprzeczytane od aktualnie wybranej wiadomości.',
    fr_FR:
      'Enregistre les messages lus dans le client privé et distingue clairement les messages non lus du message actuellement sélectionné.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
