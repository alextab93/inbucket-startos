import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '3.1.1:7',
  releaseNotes: {
    en_US:
      'Improves StartOS localization, client response protections, package workflows, documentation, and non-sensitive email regression coverage.',
    es_ES:
      'Mejora la localización de StartOS, las protecciones de respuesta del cliente, los flujos del paquete, la documentación y la cobertura de regresión de correos no sensibles.',
    de_DE:
      'Verbessert die StartOS-Lokalisierung, den Schutz der Client-Antworten, Paketabläufe, Dokumentation und nicht sensible E-Mail-Regressionstests.',
    pl_PL:
      'Ulepsza lokalizację StartOS, ochronę odpowiedzi klienta, przepływy pakietu, dokumentację i niesensytywne testy regresji wiadomości.',
    fr_FR:
      'Améliore la localisation StartOS, la protection des réponses du client, les flux du paquet, la documentation et les tests de régression avec des courriels non sensibles.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
