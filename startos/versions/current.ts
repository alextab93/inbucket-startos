import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '3.1.1:9',
  releaseNotes: {
    en_US:
      'Improves received-email rendering with isolated, sanitized HTML and CSS, preserves complex sender layouts, blocks remote tracking resources by default, and loads remote images only after explicit approval.',
    es_ES:
      'Mejora la visualización del correo recibido con HTML y CSS aislados y sanitizados, conserva diseños complejos del remitente, bloquea por defecto los recursos remotos de seguimiento y carga imágenes remotas solo tras una aprobación explícita.',
    de_DE:
      'Verbessert die Darstellung empfangener E-Mails mit isoliertem, bereinigtem HTML und CSS, erhält komplexe Absenderlayouts, blockiert externe Tracking-Ressourcen standardmäßig und lädt externe Bilder nur nach ausdrücklicher Zustimmung.',
    pl_PL:
      'Ulepsza wyświetlanie odebranych wiadomości dzięki izolowanemu i oczyszczonemu HTML oraz CSS, zachowuje złożone układy nadawców, domyślnie blokuje zdalne zasoby śledzące i ładuje obrazy zdalne dopiero po wyraźnej zgodzie.',
    fr_FR:
      'Améliore l’affichage des courriels reçus avec du HTML et du CSS isolés et assainis, conserve les mises en page complexes des expéditeurs, bloque par défaut les ressources de suivi distantes et ne charge les images distantes qu’après autorisation explicite.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
