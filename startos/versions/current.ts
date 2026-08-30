import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '3.1.1:11',
  releaseNotes: {
    en_US: `**Features**

- Rebuilds the authenticated client with React while retaining mailbox and Monitor workflows, source viewing, attachment downloads, and responsive layouts.
- Adds cross-mailbox Starred messages with per-user state backed by a bounded shared message-metadata index.
- Adds reusable per-user message tags with ten named colors, custom color selection, accessible badges, and tag filters in Mailboxes, Starred, and Monitor.
- Adds search, read and unread filters, inclusive date ranges, date and size sorting, focused full-width message reading, and improved archived-mailbox states.
- Adds cursor-based infinite pagination with stable matching totals and restores views and selected messages from canonical browser addresses.
- Uses Inbucket's shared read state and synchronizes stored metadata from live arrivals, deletions, mailbox scans, startup reconciliation, and daily reconciliation.
- Renders sanitized email HTML and sender CSS in an isolated frame and blocks remote tracking resources until explicitly approved.
- Adds a branded standalone Home Screen experience for the authenticated client on iPhone, iPad, and compatible browsers.

**Fixes**

- Removes stale stars for every user after Inbucket confirms that a message or mailbox was deleted.
- Removes message tag assignments after confirmed deletion while preserving reusable tag definitions.
- Keeps Monitor polling database-backed and serializes starring with deletion and reconciliation to avoid repeated mailbox scans and stale stars.
- Preserves indexed metadata and stars when Inbucket is unavailable or returns an invalid mailbox response.
- Ensures browsers load current frontend assets after upgrades and frontend changes trigger a new package build.

**Upgrade note**

- Create a backup before upgrading. This release migrates the authenticated client's PostgreSQL schema. Direct downgrade is not supported; restore a backup created before this upgrade to return to an earlier revision.
`,
    es_ES: `**Funciones**

- Reconstruye el cliente autenticado con React, conservando los flujos de buzones y Monitor, la vista del código fuente, la descarga de adjuntos y los diseños adaptables.
- Añade mensajes Destacados entre buzones con estado por usuario, respaldados por un índice compartido y limitado de metadatos de mensajes.
- Añade etiquetas de mensajes reutilizables por usuario con diez colores con nombre, selección de color personalizada, distintivos accesibles y filtros de etiquetas en Buzones, Destacados y Monitor.
- Añade búsqueda, filtros de leídos y no leídos, rangos de fechas inclusivos, ordenación por fecha y tamaño, lectura de mensajes enfocada a ancho completo y mejores estados para buzones archivados.
- Añade paginación infinita basada en cursores con totales de coincidencias estables y restaura las vistas y los mensajes seleccionados desde direcciones canónicas del navegador.
- Usa el estado de lectura compartido de Inbucket y sincroniza los metadatos almacenados desde llegadas y eliminaciones en vivo, escaneos de buzones y reconciliaciones al iniciar y cada día.
- Renderiza el HTML saneado del correo y el CSS del remitente en un marco aislado y bloquea los recursos remotos de seguimiento hasta que se aprueben expresamente.
- Añade una experiencia independiente y con la marca de Inbucket en la pantalla de inicio para el cliente autenticado en iPhone, iPad y navegadores compatibles.

**Correcciones**

- Elimina los destacados obsoletos de todos los usuarios después de que Inbucket confirma que se eliminó un mensaje o buzón.
- Elimina las asignaciones de etiquetas tras confirmar una eliminación y conserva las definiciones reutilizables.
- Mantiene el sondeo del Monitor respaldado por la base de datos y serializa los destacados con la eliminación y la reconciliación para evitar escaneos repetidos de buzones y destacados obsoletos.
- Conserva los metadatos indexados y los destacados cuando Inbucket no está disponible o devuelve una respuesta de buzón no válida.
- Garantiza que los navegadores carguen los recursos actuales de la interfaz después de una actualización y que los cambios del frontend provoquen una nueva compilación del paquete.

**Nota de actualización**

- Crea una copia de seguridad antes de actualizar. Esta versión migra el esquema PostgreSQL del cliente autenticado. No se admite volver directamente a una versión anterior; restaura una copia creada antes de esta actualización para regresar a una revisión anterior.
`,
    de_DE: `**Funktionen**

- Erstellt den authentifizierten Client mit React neu und behält Postfach- und Monitorabläufe, Quelltextansicht, Downloads von Anhängen und responsive Layouts bei.
- Ergänzt postfachübergreifende markierte Nachrichten mit benutzerspezifischem Status auf Basis eines begrenzten gemeinsamen Nachrichtenmetadaten-Index.
- Ergänzt wiederverwendbare benutzerspezifische Nachrichten-Tags mit zehn benannten Farben, eigener Farbauswahl, zugänglichen Kennzeichnungen und Tag-Filtern in Postfächern, Markiert und Monitor.
- Ergänzt Suche, Gelesen- und Ungelesen-Filter, inklusive Datumsbereiche, Sortierung nach Datum und Größe, eine fokussierte Nachrichtenansicht über die volle Breite sowie verbesserte Zustände für archivierte Postfächer.
- Ergänzt cursorbasierte endlose Seitennavigation mit stabilen Trefferzahlen und stellt Ansichten und ausgewählte Nachrichten aus kanonischen Browseradressen wieder her.
- Verwendet Inbuckets gemeinsamen Lesestatus und synchronisiert gespeicherte Metadaten aus Live-Eingängen, Löschungen, Postfachscans sowie Abgleichen beim Start und einmal täglich.
- Stellt bereinigtes E-Mail-HTML und Absender-CSS in einem isolierten Frame dar und blockiert externe Tracking-Ressourcen bis zur ausdrücklichen Freigabe.
- Ergänzt für den authentifizierten Client auf iPhone, iPad und kompatiblen Browsern ein eigenständiges Startbildschirm-Erlebnis mit Inbucket-Branding.

**Korrekturen**

- Entfernt veraltete Markierungen aller Benutzer, nachdem Inbucket die Löschung einer Nachricht oder eines Postfachs bestätigt hat.
- Entfernt Nachrichten-Tag-Zuweisungen nach bestätigter Löschung und bewahrt wiederverwendbare Tag-Definitionen auf.
- Hält die Monitor-Abfragen datenbankgestützt und serialisiert Markierungen mit Löschung und Abgleich, um wiederholte Postfachscans und veraltete Markierungen zu vermeiden.
- Bewahrt indexierte Metadaten und Markierungen auf, wenn Inbucket nicht verfügbar ist oder eine ungültige Postfachantwort zurückgibt.
- Stellt sicher, dass Browser nach Upgrades aktuelle Frontend-Dateien laden und Frontend-Änderungen einen neuen Paket-Build auslösen.

**Upgrade-Hinweis**

- Erstelle vor dem Upgrade eine Sicherung. Diese Version migriert das PostgreSQL-Schema des authentifizierten Clients. Ein direktes Downgrade wird nicht unterstützt; stelle eine vor diesem Upgrade erstellte Sicherung wieder her, um zu einer früheren Revision zurückzukehren.
`,
    pl_PL: `**Funkcje**

- Migruje uwierzytelnionego klienta do React, zachowując obsługę skrzynek i Monitora, podgląd źródła, pobieranie załączników oraz układy responsywne.
- Dodaje oznaczone gwiazdką wiadomości ze wszystkich skrzynek ze stanem osobnym dla każdego użytkownika, opartym na ograniczonym współdzielonym indeksie metadanych.
- Dodaje wielokrotnego użytku tagi wiadomości dla każdego użytkownika z dziesięcioma nazwanymi kolorami, własnym wyborem koloru, dostępnymi etykietami i filtrami tagów w Skrzynkach, Oznaczonych gwiazdką i Monitorze.
- Dodaje wyszukiwanie, filtry przeczytanych i nieprzeczytanych, inkluzywne zakresy dat, sortowanie według daty i rozmiaru, pełnoszeroki widok wybranej wiadomości oraz ulepszone stany zarchiwizowanych skrzynek.
- Dodaje nieskończone stronicowanie oparte na kursorach ze stabilną liczbą wyników oraz przywraca widoki i wybrane wiadomości z kanonicznych adresów przeglądarki.
- Korzysta ze współdzielonego stanu przeczytania Inbucket i synchronizuje metadane z nowych wiadomości, usunięć, skanów skrzynek oraz uzgadniania przy starcie i raz dziennie.
- Renderuje oczyszczony HTML wiadomości i CSS nadawcy w izolowanej ramce oraz blokuje zdalne zasoby śledzące do czasu wyraźnej zgody.
- Dodaje markowe, samodzielne uruchamianie uwierzytelnionego klienta z ekranu początkowego na iPhonie, iPadzie i w zgodnych przeglądarkach.

**Poprawki**

- Usuwa nieaktualne gwiazdki wszystkich użytkowników po potwierdzeniu przez Inbucket usunięcia wiadomości lub skrzynki.
- Usuwa przypisania tagów po potwierdzonym usunięciu wiadomości, zachowując definicje tagów do ponownego użycia.
- Utrzymuje odpytywanie Monitora w oparciu o bazę danych i serializuje oznaczanie gwiazdką z usuwaniem oraz uzgadnianiem, aby uniknąć powtarzanych skanów skrzynek i nieaktualnych gwiazdek.
- Zachowuje zindeksowane metadane i gwiazdki, gdy Inbucket jest niedostępny lub zwraca nieprawidłową odpowiedź skrzynki.
- Zapewnia, że po aktualizacji przeglądarka ładuje bieżące zasoby interfejsu, a zmiany frontendu wymuszają ponowne zbudowanie pakietu.

**Informacja o aktualizacji**

- Przed aktualizacją utwórz kopię zapasową. Ta wersja migruje schemat PostgreSQL uwierzytelnionego klienta. Bezpośredni powrót do starszej wersji nie jest obsługiwany; aby wrócić do wcześniejszej rewizji, przywróć kopię utworzoną przed tą aktualizacją.
`,
    fr_FR: `**Fonctionnalités**

- Reconstruit le client authentifié avec React tout en conservant les parcours des boîtes et du Moniteur, l’affichage de la source, le téléchargement des pièces jointes et les dispositions adaptatives.
- Ajoute les messages favoris de toutes les boîtes avec un état propre à chaque utilisateur, fondé sur un index partagé et limité des métadonnées.
- Ajoute des étiquettes de messages réutilisables par utilisateur avec dix couleurs nommées, un sélecteur personnalisé, des badges accessibles et des filtres dans Boîtes, Favoris et Moniteur.
- Ajoute la recherche, les filtres lus et non lus, les plages de dates inclusives, le tri par date et taille, une lecture ciblée des messages en pleine largeur et de meilleurs états pour les boîtes archivées.
- Ajoute une pagination infinie par curseur avec un total stable des résultats et restaure les vues et les messages sélectionnés depuis les adresses canoniques du navigateur.
- Utilise l’état de lecture partagé d’Inbucket et synchronise les métadonnées depuis les arrivées et suppressions en direct, les analyses des boîtes et les réconciliations au démarrage et chaque jour.
- Affiche le HTML assaini des messages et le CSS de l’expéditeur dans un cadre isolé et bloque les ressources distantes de suivi jusqu’à autorisation explicite.
- Ajoute une expérience autonome aux couleurs d’Inbucket depuis l’écran d’accueil pour le client authentifié sur iPhone, iPad et les navigateurs compatibles.

**Correctifs**

- Supprime les favoris obsolètes de tous les utilisateurs après confirmation par Inbucket de la suppression d’un message ou d’une boîte.
- Supprime les associations d’étiquettes après une suppression confirmée tout en conservant les définitions réutilisables.
- Conserve l'interrogation du Moniteur basée sur la base de données et sérialise l'ajout aux favoris avec la suppression et la réconciliation afin d'éviter les analyses répétées des boîtes et les favoris obsolètes.
- Conserve les métadonnées indexées et les favoris lorsqu’Inbucket est indisponible ou renvoie une réponse de boîte non valide.
- Garantit qu’après une mise à niveau le navigateur charge les ressources actuelles de l’interface et que les modifications du frontend déclenchent une nouvelle construction du paquet.

**Note de mise à niveau**

- Créez une sauvegarde avant la mise à niveau. Cette version migre le schéma PostgreSQL du client authentifié. Le retour direct à une version antérieure n’est pas pris en charge; restaurez une sauvegarde créée avant cette mise à niveau pour revenir à une révision antérieure.
`,
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
