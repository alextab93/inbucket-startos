import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '3.1.1:6',
  releaseNotes: {
    en_US:
      'Adds a configurable maximum SMTP message size from 1 to 100 MiB, with a 50 MiB default for existing installations.',
    es_ES:
      'Añade un tamaño máximo configurable para los mensajes SMTP de 1 a 100 MiB, con un valor predeterminado de 50 MiB para las instalaciones existentes.',
    de_DE:
      'Fügt eine konfigurierbare maximale SMTP-Nachrichtengröße von 1 bis 100 MiB hinzu, mit einem Standardwert von 50 MiB für bestehende Installationen.',
    pl_PL:
      'Dodaje konfigurowalny maksymalny rozmiar wiadomości SMTP od 1 do 100 MiB, z wartością domyślną 50 MiB dla istniejących instalacji.',
    fr_FR:
      'Ajoute une taille maximale configurable de 1 à 100 Mio pour les messages SMTP, avec une valeur par défaut de 50 Mio pour les installations existantes.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
