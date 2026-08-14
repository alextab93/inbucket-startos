import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '3.1.1:5',
  releaseNotes: {
    en_US:
      'Fixes upgrades from revision 2 and reduces the package size while retaining the authenticated client, upstream admin interface, and inbound SMTP.',
    es_ES:
      'Corrige las actualizaciones desde la revisión 2 y reduce el tamaño del paquete conservando el cliente autenticado, la interfaz de administración y el SMTP entrante.',
    de_DE:
      'Behebt Aktualisierungen von Revision 2 und reduziert die Paketgröße, während der authentifizierte Client, die Administrationsoberfläche und eingehendes SMTP erhalten bleiben.',
    pl_PL:
      'Naprawia aktualizacje z wersji 2 i zmniejsza rozmiar pakietu, zachowując uwierzytelnionego klienta, interfejs administracyjny i przychodzący SMTP.',
    fr_FR:
      'Corrige les mises à niveau depuis la révision 2 et réduit la taille du paquet tout en conservant le client authentifié, l’interface d’administration et le SMTP entrant.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
