import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '3.1.1:1',
  releaseNotes: {
    en_US:
      'Improves icon contrast on light and dark themes and documents public SMTP delivery through StartTunnel, including DNS and port forwarding.',
    es_ES:
      'Mejora el contraste del icono en temas claros y oscuros y documenta la entrega SMTP pública mediante StartTunnel, incluida la configuración de DNS y reenvío de puertos.',
    de_DE:
      'Verbessert den Icon-Kontrast in hellen und dunklen Designs und dokumentiert den öffentlichen SMTP-Empfang über StartTunnel einschließlich DNS- und Portweiterleitung.',
    pl_PL:
      'Poprawia kontrast ikony w jasnych i ciemnych motywach oraz dokumentuje publiczne dostarczanie SMTP przez StartTunnel, w tym konfigurację DNS i przekierowanie portów.',
    fr_FR:
      'Améliore le contraste de l’icône dans les thèmes clairs et sombres et documente la réception SMTP publique via StartTunnel, y compris la configuration DNS et la redirection de port.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
