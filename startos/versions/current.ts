import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '3.1.1:6',
  releaseNotes: {
    en_US:
      'Adds a configurable SMTP message size limit from 1 to 100 MiB, plus options to retain messages forever and remove the per-mailbox message cap.',
    es_ES:
      'Añade un límite configurable de 1 a 100 MiB para el tamaño de los mensajes SMTP y opciones para conservar los mensajes para siempre y eliminar el límite de mensajes por buzón.',
    de_DE:
      'Fügt ein konfigurierbares SMTP-Nachrichtengrößenlimit von 1 bis 100 MiB sowie Optionen zur unbegrenzten Aufbewahrung und zum Aufheben des Nachrichtenlimits pro Postfach hinzu.',
    pl_PL:
      'Dodaje konfigurowalny limit rozmiaru wiadomości SMTP od 1 do 100 MiB oraz opcje bezterminowego przechowywania i usunięcia limitu wiadomości na skrzynkę.',
    fr_FR:
      'Ajoute une limite configurable de 1 à 100 Mio pour les messages SMTP, ainsi que des options de conservation illimitée et de suppression de la limite de messages par boîte.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
