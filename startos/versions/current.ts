import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '3.1.1:7',
  releaseNotes: {
    en_US:
      'Add configurable message rules with previews and combinable actions for notifications, stars, read state, tags, and Trash, plus reusable Email, ntfy, and Webhook destinations.',
    es_ES:
      'Agrega reglas configurables de mensajes con vistas previas y acciones combinables para notificaciones, destacados, estado de lectura, etiquetas y Papelera, además de destinos reutilizables de Email, ntfy y Webhook.',
    de_DE:
      'Fügt konfigurierbare Nachrichtenregeln mit Vorschau und kombinierbaren Aktionen für Benachrichtigungen, Markierungen, Lesestatus, Tags und Papierkorb sowie wiederverwendbaren Email-, ntfy- und Webhook-Zielen hinzu.',
    pl_PL:
      'Dodaje konfigurowalne reguły wiadomości z podglądem i łączonymi akcjami dla powiadomień, oznaczania gwiazdką, stanu przeczytania, tagów i Kosza oraz miejscami docelowymi Email, ntfy i Webhook.',
    fr_FR:
      'Ajoute des règles de messages configurables avec aperçu et actions combinables pour les notifications, favoris, état de lecture, étiquettes et Corbeille, ainsi que des destinations Email, ntfy et Webhook réutilisables.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
