import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '3.1.1:10',
  releaseNotes: {
    en_US:
      'Tracks read messages, distinguishes unread messages from the current selection, and adds a compact mailbox workspace with independently scrolling message and reader panes.',
    es_ES:
      'Registra los mensajes leídos, distingue los no leídos de la selección actual y añade un espacio de correo compacto con desplazamiento independiente para la lista y el lector.',
    de_DE:
      'Speichert gelesene Nachrichten, unterscheidet ungelesene Nachrichten von der aktuellen Auswahl und ergänzt eine kompakte Postfachansicht mit getrennt scrollbaren Bereichen.',
    pl_PL:
      'Zapisuje stan przeczytania, odróżnia nieprzeczytane wiadomości od bieżącego wyboru i dodaje zwarty widok skrzynki z niezależnie przewijanymi panelami.',
    fr_FR:
      'Enregistre les messages lus, distingue les messages non lus de la sélection actuelle et ajoute un espace compact avec défilement indépendant de la liste et du lecteur.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
