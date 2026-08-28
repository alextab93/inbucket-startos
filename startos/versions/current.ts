import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '3.1.1:10',
  releaseNotes: {
    en_US:
      'Tracks read messages, adds search, read and unread filters, and date and size sorting to the mailbox and realtime monitor, and provides a compact workspace with independently scrolling message and reader panes.',
    es_ES:
      'Registra los mensajes leídos, añade búsqueda, filtros de leídos y no leídos y ordenación por fecha y tamaño al buzón y al monitor en tiempo real, y ofrece un espacio compacto con desplazamiento independiente para la lista y el lector.',
    de_DE:
      'Speichert gelesene Nachrichten, ergänzt Suche, Gelesen- und Ungelesen-Filter sowie Sortierung nach Datum und Größe für Postfach und Echtzeitmonitor und bietet eine kompakte Ansicht mit getrennt scrollbaren Bereichen.',
    pl_PL:
      'Zapisuje stan przeczytania, dodaje wyszukiwanie, filtry przeczytanych i nieprzeczytanych oraz sortowanie według daty i rozmiaru do skrzynki i monitora na żywo oraz oferuje zwarty widok z niezależnie przewijanymi panelami.',
    fr_FR:
      'Enregistre les messages lus, ajoute la recherche, les filtres lus et non lus et le tri par date et taille à la boîte et au moniteur en temps réel, et offre un espace compact à défilement indépendant.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
