<p align="center">
  <img src="icon.png" alt="Inbucket Logo" width="21%">
</p>

# Inbucket on StartOS

> Everything not listed in this document should behave the same as upstream
> Inbucket. If a feature, setting, or behavior is not mentioned here, the
> upstream documentation is accurate and fully applicable — see the
> Documentation section of `instructions.md` for links.

Inbucket is a disposable mail server: it accepts SMTP for a whole domain without any mailbox existing beforehand, and makes every message it receives readable through webmail and a REST API.

This package adds an authenticated mailbox client of its own alongside upstream, because upstream's interface has no login.

---

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Authenticated Client Architecture](#authenticated-client-architecture)
- [Volume and Data Layout](#volume-and-data-layout)
- [File Models](#file-models)
- [Dependencies](#dependencies)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Actions](#actions)
- [Tasks](#tasks)
- [Health Checks](#health-checks)
- [Backups and Restore](#backups-and-restore)
- [Limitations and Differences](#limitations-and-differences)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

---

## Image and Container Runtime

Three images, one of which is this repository's own application.

| Image      | Source                                                     | Entrypoint                     |
| ---------- | ---------------------------------------------------------- | ------------------------------ |
| `main`     | Upstream `inbucket/inbucket`, unmodified, pinned by digest | Upstream's                     |
| `client`   | Built from this repo's `Dockerfile`                        | `puma`, and three Rails runners |
| `postgres` | Upstream `postgres` alpine, pinned by digest               | Upstream's                     |

All three build for `x86_64` and `aarch64`.

The `client` image is not a wrapper around anything upstream — it is a Rails API and a Vite-built browser frontend written for this package, backed by its own PostgreSQL. It exists because upstream Inbucket's webmail deliberately has no authentication: anyone who can reach it can read every mailbox. The client puts a login in front of the same data, which it reads through upstream's REST API and monitor websocket over loopback.

Three subcontainers run: `inbucket` (upstream), `client-postgres`, and `client-app`. The last hosts the Puma web server, the monitor, the reconciler, and two setup oneshots in one subcontainer, so they share a filesystem. Attach with `start-cli package attach inbucket -n client-app`.

## Authenticated Client Architecture

The authenticated client is a client-rendered React 19.2 application. Rails serves its generated files and provides the private same-origin API. The browser never receives the authored TypeScript, tests, `node_modules`, database credentials, Rails signing key, or StartOS configuration. It receives inspectable compiled JavaScript, so the frontend uses relative paths and the HttpOnly session cookie instead of compiled configuration values.

### Component hierarchy

```text
App
├── AppHeader
│   └── ViewNavigation
├── AccessScreen
└── AuthenticatedWorkspace
    ├── MailboxesView
    │   ├── MailboxTools
    │   │   ├── AddMailbox
    │   │   └── ManageMailboxes
    │   └── MessageWorkspace
    │       ├── ListControls
    │       ├── MessageList
    │       │   └── StarButton
    │       └── MessageInspector
    │           ├── StarButton
    │           ├── EmailRenderer
    │           ├── AttachmentList
    │           └── SourceViewer
    ├── MonitorView
    │   └── ListControls
    ├── StarredView
    │   ├── ListControls
    │   └── MessageWorkspace
    ├── ArchivedView
    ├── StatusMessage
    └── Confirmation boundary
```

`App` owns authentication, active-view navigation, the saved-mailbox catalog, selected mailboxes, loaded message summaries, selected message identities, optimistic star updates, and URL restoration. Each list owns its search, read filter, optional mailbox filter, sort, and filter-panel state. `MessageInspector` owns only the selected message response, attachments, source, loading state, and visible errors. Derived counts, sorted and filtered lists, accessible summaries, active-control indicators, and disabled states are calculated during rendering rather than copied into state.

| State category | Values |
| -------------- | ------ |
| Server state | Session, active and archived mailbox catalogs, message summaries with per-user starred state, all starred summaries, selected parsed message, attachments, monitor summaries |
| URL state | Selected mailbox and selected message identifier in the `mailbox` and `message` query parameters |
| User-input state | Credentials, active view, selected mailboxes, search text, read filter, starred-view mailbox filter, sort, open tools, source visibility |
| Derived render values | Visible and ordered messages, counts, labels, empty explanations, selected styling, enabled actions |

Inbucket's `seen` value remains part of fetched message and monitor data. It is updated in React only after the upstream-backed read request succeeds. There is no second unread collection or client-side read database.

Upstream Inbucket has no starred field or endpoint. The authenticated client stores one bounded `InbucketMessage` metadata row per upstream mailbox and message identifier, then links each user's star to that shared row. It never copies the body, parsed body, raw source, or attachments. Rails enriches mailbox, monitor, and parsed-message responses with per-user starred state. Successful mailbox scans refresh the shared row and remove every user's star when the upstream message is gone. Failed or invalid scans preserve the last known row and its stars.

The shared metadata contract uses `(mailbox, message_id)` as identity and stores sender, recipients, subject, received time, size, upstream `seen`, availability, and separate monitor, mailbox-scan, and direct-fetch observation times. `received_at` followed by the database identifier is the deterministic ordering boundary. The observation times show which sources have observed a row. There is no local `reviewed` or competing unread state.

The websocket monitor records new arrivals and deletion events immediately. Monitor keeps the bounded delivery summary while its metadata tombstone exists, even when the upstream message later becomes unavailable. A separate reconciler scans every saved mailbox once at startup and every 24 hours, retrying after five minutes when any mailbox fails. Inbucket does not expose a mailbox-catalog endpoint, so historical mailboxes unknown to Rails are not complete until the user opens them or a new monitor event names them. A successful complete mailbox response is authoritative for availability. Direct deletion, mailbox purge, monitor deletion, and a later successful scan remove stars. Failed scans never infer deletion. Unavailable metadata tombstones are retained for seven days and then removed during reconciliation.

This index is the scalable boundary for future server-side filtering and pagination. The current mailbox API still returns Inbucket's complete mailbox response and the browser still filters and sorts that loaded response, so this change does not claim that pagination is already implemented.

### Behavior contract

- Access starts by checking the private session. The visible outcomes are signed out, authenticating, authenticated, expired session, and temporarily unavailable. Login clears the password, disables duplicate submission while pending, reports incorrect credentials separately, and restores focus after an access-state change. Sign out clears mailbox and message selection and removes their query parameters.
- Navigation uses ordinary buttons with `aria-current`, not partial tab semantics. Mailboxes, Monitor, and Archived retain their user controls while hidden. Monitor polling runs only while its authenticated view is visible.
- Add and open loads any trimmed mailbox name and restores matching archived metadata through the mailbox endpoint. Saved mailboxes support individual selection, Select all, Clear, Archive selected, and confirmed permanent deletion. Successful items leave a partial-failure selection while failed items remain available for retry. Monitor arrivals can add catalog metadata but never restore an archived mailbox.
- Selected mailboxes load together. Each successful response contributes its mailbox identity, failed responses produce a visible partial result, and default ordering is deterministic. Search covers subject, sender, recipient, mailbox, and displayed date. Read and unread filters are mutually exclusive. Sorting supports newest, oldest, largest, and smallest, keeps stable ties, and puts unknown values after known values.
- Starred lists the signed-in user's starred messages across all mailboxes. It has the same search, read, and sorting controls plus an All mailboxes filter. Removing a star keeps the focused row present until persistence succeeds, then moves focus to the Starred heading before removing the row.
- Opening a message shows loading, not-found, upstream-error, and parsed-message states. Subject, From, To, Date, sanitized HTML or plaintext, attachments, source, star control, and deletion remain visible user behaviors. Star changes update loaded mailbox views optimistically and roll back with a visible error if persistence fails. Read styling changes only after the read response succeeds. Changing selection prevents stale message, attachment, source, or renderer results from replacing the current message.
- HTML mail is sanitized and rendered through an authenticated isolated iframe. Sender layout styles, safe external links, CID raster images, safe data images, plaintext linkification, remote-image consent, script blocking, form blocking, no-referrer behavior, and parent isolation remain required. Attachments use authenticated download-only endpoints.
- Monitor has loading, empty, populated, refreshed, unauthorized, and upstream-error outcomes. Its search, read filters, sorting, and mailbox-message navigation use current upstream `seen` data. Archived has dedicated loading, empty, populated, partial-count, catalog-error, restore-pending, and restore-error outcomes. Restore is non-destructive, while mailbox purge remains a separate confirmed action.
- Add-mailbox, mailbox-management, and filter controls close on outside interaction. Escape closes them and restores focus to the invoking control. The application preserves the skip link, headings, labels, live status regions, visible focus, destructive confirmation, and desktop, tablet, and mobile layouts.

### Frontend API contract

Every request uses `credentials: include`, a relative same-origin path, and the Rails encrypted HttpOnly session cookie. JSON requests use `Content-Type: application/json`. Private API responses use `Cache-Control: private, no-store` and `Pragma: no-cache`.

| Operation | Request | Success | Visible failure contract |
| --------- | ------- | ------- | ------------------------ |
| Restore session | `GET /v1/session` | `200` session JSON | `401` signed out, other status unavailable |
| Sign in | `POST /v1/session` with username and password JSON | `200` session JSON | `401` incorrect credentials, other status unavailable |
| Sign out | `DELETE /v1/session` | `204` | `401` treated as signed out, other status retryable |
| Active mailbox catalog | `GET /v1/inbucket/mailboxes` | `200` string array | `401` expired, other status catalog error |
| Archived catalog | `GET /v1/inbucket/mailboxes?archived=true` | `200` name and nullable message-count array | `401` expired, other status archived error |
| Load or open mailbox | `GET /v1/inbucket/mailbox?name=...` | `200` message-summary array | `401` expired, `404` not found, `502` upstream unavailable, other status retryable |
| Archive or restore mailbox | `PATCH /v1/inbucket/mailbox/archive?name=...` with optional `archived=false` | `204` | `401` expired, `404` missing metadata, other status retryable |
| Purge mailbox | `DELETE /v1/inbucket/mailbox?name=...` | `204` | `401` expired, `404` missing, `502` upstream unavailable, partial outcomes retained |
| Monitor summaries | `GET /v1/inbucket/monitor/messages` | `200` array capped by Rails at 200 | `401` expired, `502` upstream unavailable, other status retryable |
| Parsed message | `GET /v1/inbucket/mailboxes/:name/messages/:id` | `200` parsed-message JSON | `401` expired, `404` not found, `502` upstream unavailable |
| Mark read | `PATCH /v1/inbucket/mailboxes/:name/messages/:id/read` | `204` | Any failure leaves the message visibly unread |
| Starred messages | `GET /v1/inbucket/starred/messages` | `200` current user's stored message-summary array | `401` expired, other status visible load error |
| Set starred | `PATCH /v1/inbucket/mailboxes/:name/messages/:id/starred` with boolean `starred` JSON | `200` starred-state JSON with the stored summary when adding | `401` expired, `404` missing upstream message, `422` invalid value, other failures visibly roll back |
| Message source | `GET /v1/inbucket/mailboxes/:name/messages/:id/source` | `200` plain text | `401` expired, `404` not found, `502` upstream unavailable |
| Attachment catalog | `GET /v1/inbucket/mailboxes/:name/messages/:id/attachments` | `200` attachment array | `401` expired, `404` missing, `422` invalid message source, `502` upstream unavailable |
| Attachment download | `GET /v1/inbucket/mailboxes/:name/messages/:id/attachments/:index` | Download response with `Content-Disposition: attachment` | `401` expired, `404` missing |
| Email frame | `GET /v1/email-frame` with optional `remote_images=true` | `200` isolated HTML shell | `401` expired |
| Delete message | `DELETE /v1/inbucket/message?name=...&id=...` | `204` | `401` expired, `404` missing, `502` upstream unavailable |

Rails normalizes parameter errors to `422` JSON, missing records to `404` JSON, and upstream transport or invalid-response failures to `502` JSON. Bulk mailbox actions are independent requests, so the frontend reports completed and failed item totals without turning a partial outcome into full success.

### Delivery and security contract

`frontend/index.html` is the authored shell. Vite clears `public/`, creates `public/index.html`, and emits content-fingerprinted JavaScript, CSS, images, and split chunks under `public/assets`. The Docker Node stage builds those files once, and the final Ruby image copies only `/build/public` into `/app/public`. Puma and Rails static middleware serve `/`, generated assets, `/up`, and `/v1/*` from one origin. StartOS exports that Puma origin as the HTTPS Web Client Interface at `/`.

The shell links a root-scoped web app manifest and dedicated PNG icons from `frontend/public`. The manifest launches the HTTPS Web Client Interface in standalone display mode, while the Apple touch icon and compatibility metadata provide the same branded Home Screen behavior on iPhone and iPad. The installed app uses the same HttpOnly cookie session and same-origin network APIs. It has no service worker or offline message cache, so Inbucket must remain reachable.

Rails sends `Cache-Control: no-cache` for `/`, `/index.html`, `/manifest.webmanifest`, and the stable Home Screen icon paths, so they revalidate after a package upgrade. Files under `/assets/` receive `Cache-Control: public, max-age=31536000, immutable` because Vite gives every production asset a content fingerprint. Private `/v1/*` responses use `private, no-store`.

The document CSP remains `default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; form-action 'self'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'`. Application scripts and styles are external same-origin assets. The email frame has its own response CSP with `default-src 'none'`, no scripts, objects, frames, forms, or base URI, inline sender styles allowed only inside the isolated frame, and remote image origins allowed only after explicit consent. It also sends `Referrer-Policy: no-referrer` and `X-Content-Type-Options: nosniff`.

The Makefile treats the Dockerfile, lockfiles, Gemfiles, Vite configuration, Rails source, database files, support library, and complete `frontend/` tree as client build inputs. A change to any of them invalidates the architecture-specific `.s9pk` target even when `start-cli s9pk list-ingredients` does not enumerate the full Docker context. Release candidates still use `make clean x86` and `make clean arm` so validation never depends on a cached client image or stale `public/` output.

### Local development

Install locked dependencies, start a real PostgreSQL test or development database, and run the checks from the repository root:

```sh
npm ci
npm run check
npm test
bundle exec rspec
```

For browser development, run Rails as the same-origin API and static server in one terminal and Vite's production build watcher in another:

```sh
bundle exec rails server -p 3000
npm run build:frontend:watch
```

The watcher writes fresh fingerprinted output into `public/`, which Rails serves with the same origin, session cookie, Origin validation, email-frame endpoint, downloads, and CSP used by production. There is no Vite development-server proxy. A normal production build is `npm run build:frontend`; `npm run check` runs both StartOS and frontend TypeScript configurations.

### React 19.2 feature decisions

- `<Activity>` is deferred. The three views remain mounted to preserve their user controls, use the native `hidden` attribute for inactive output, and explicitly start and stop Monitor effects from active-view state.
- `useEffectEvent` is deferred. Polling, request, renderer, and listener lifecycles have small explicit dependency sets and abort or clean up directly.
- React Compiler is deferred. The client has no measured rendering bottleneck that justifies adding its build integration after parity validation.
- The client does not use speculative `memo`, `useMemo`, or `useCallback`. Callback identity is stabilized only where an Effect lifecycle requires it.

### Framework-neutral acceptance scenarios

1. Restore a valid session or show the correct signed-out, expired, or unavailable state. Sign in and sign out through visible results with disabled pending controls.
2. Select one or several saved mailboxes and see one deterministic combined list. Add and open an archived name, archive selected names, confirm a purge, and retain failed names after partial results.
3. Search every documented field, switch mutually exclusive read filters, apply every sort, preserve stable ties, place unknown values last, and show the matching empty explanation. In Starred, also filter across all mailboxes or one mailbox.
4. Open a message, mark it read only after success, star and unstar it with visible rollback after failure, keep it unread after read failure, view source, list and download attachments, delete with confirmation, and prevent stale responses after rapid message switching.
5. Render sanitized HTML, plaintext, CID and safe data images, safe external links, blocked unsafe content, and remote images only after consent inside the isolated frame.
6. Load and refresh Monitor only while visible, preserve its controls across refreshes, and open an arrival in its mailbox. Show Archived loading, empty, partial-count, catalog-error, restore-success, and restore-error results.
7. Complete the representative workflows with keyboard access, focus return, labels, headings, live announcements, and desktop, tablet, and mobile layouts.

## Volume and Data Layout

Two volumes: received mail on one, the client's own state on the other.

| Volume            | Mount point                | Contents                                                             |
| ----------------- | -------------------------- | -------------------------------------------------------------------- |
| `main`            | `/config`, `/storage`      | Upstream's config, messages, indexes, and shared `seen` state        |
| `main`            | not mounted                | `store.json`, at the volume root                                     |
| `client-postgres` | `/var/lib/postgresql/data` | Users, sessions, mailbox catalog, bounded shared message metadata, and per-user stars |

Only the `config` and `storage` subdirectories of `main` are mounted, so `store.json` sits beside them and is not visible to any container that does not need it. Messages themselves are files under `/storage`, one directory per mailbox — Inbucket's file store, not a database.

## File Models

One model, holding StartOS-side state. Upstream Inbucket has no configuration file the package owns; everything it is told arrives as an environment variable, re-applied on every start.

| Model        | File              | Seeded                                    | Rewritten       |
| ------------ | ----------------- | ----------------------------------------- | --------------- |
| `store.json` | `main:store.json` | At install, and by **Set Admin Password** | By both actions |

It carries two unrelated things. The first is the settings the user chose: accepted domain, retention period, and per-mailbox message cap. These are read at start and turned into `INBUCKET_*` variables. Changing any of them requires a restart to take effect, and the service reads them fresh each time, so an edit made here always wins.

The second is the client's own secrets: its PostgreSQL password and Rails signing key, seeded once at install and never regenerated — a restore keeps the ones that came with the backup, which is what lets the restored database still be read. The client's password sits alongside them but is minted only by **Set Admin Password**; init never generates one.

**`main` reads the store reactively**, so writing it restarts the service. That is how both actions take effect, and why neither asks the user to restart anything.

## Dependencies

None.

## Network Access and Interfaces

Four interfaces across three hosts. The split matters: two of them have no authentication at all.

| Interface            | Id         | Type  | Host     | Port | Purpose                                          |
| -------------------- | ---------- | ----- | -------- | ---- | ------------------------------------------------ |
| Web Client Interface | `client`   | `ui`  | `client` | 3000 | The authenticated mailbox reader                 |
| Admin Web Interface  | `ui`       | `ui`  | `web`    | 9000 | Upstream webmail, server status, and diagnostics |
| REST API             | `rest-api` | `api` | `web`    | 9000 | Upstream's mailbox API, at `/api/v1/`            |
| Inbound SMTP         | `smtp`     | `api` | `smtp`   | 2500 | Receives mail for the configured domain          |

**`ui` and `rest-api` share one host and neither requires a credential.** Anyone who can reach either can read, and delete, every message in every mailbox. They are upstream's own interfaces and behave exactly as upstream documents; the package adds nothing to them. `client` is the one to publish for ordinary use.

`smtp` is raw TCP with no TLS — Inbucket is a receiver for testing and disposable addresses, and it accepts plaintext SMTP on 2500. Internet mail arrives on port 25, so reaching it from outside needs an external 25 → 2500 forward; an HTTP reverse proxy cannot carry SMTP. POP3 is bound to loopback only and is not exported.

## Installation and First-Run Flow

Install generates the client's database password and Rails signing key, then raises two `critical` tasks: one pointing at **Configure Inbucket**, because Inbucket has nothing to accept mail for without a domain, and one at **Set Admin Password**, because the client has no credential until it is run. Both block startup.

On the first start after that, the client's PostgreSQL initialises, `client-database-prepare` creates its schema, and `client-account-prepare` writes the administrator account from `store.json`. That sync runs on every start, which is what applies a rotated password — the action writes the store, the store change restarts the service, and the oneshot re-syncs the account.

## Actions

Two actions, both user-facing.

### Configure Inbucket

- **When to run it:** First at install, prompted by the task; afterwards to change the accepted domain or storage limits.
- **What the domain is** — a literal match against the recipient address, nothing more. It is never resolved, and the package never verifies ownership, so a reserved name like `mailbox.test` is a perfectly valid answer for someone only feeding Inbucket from their own applications. A domain the user owns is needed only to receive mail from the internet, which additionally needs the port-25 forward under [Limitations](#limitations-and-differences).
- **What it changes:** The domain, retention period, and per-mailbox cap in `store.json`. The form is pre-filled with what is already saved.
- **Cost** — instant to save. The new values reach Inbucket on its next start.
- **Repeat safety** — idempotent.
- **What happens next:** Restart to apply. Changing the domain does not rename existing mailboxes, and mail for the old domain stops being accepted. Lowering retention or the message cap deletes stored messages that no longer fit.
- **Outputs** — none.

### Set Admin Password

- **When to run it** — at install, prompted by the task; afterwards to rotate the password, including after losing it.
- **What it changes** — generates a new random password and writes it to `store.json`. The `client-account-prepare` oneshot applies it to the client's account on the restart that follows.
- **Cost** — writing the store restarts the whole service, so mail delivery is interrupted for as long as that takes.
- **Repeat safety** — safe to repeat, and never a no-op: each run mints a new password and discards the previous one.
- **Outputs** — the username and the new password, shown once. There is no action that reads it back — rotating is how a lost password is replaced.

## Tasks

Two tasks, both raised from init rather than only at install.

| Task                       | Severity   | Raised by                        | Cleared by         |
| -------------------------- | ---------- | -------------------------------- | ------------------ |
| Run **Configure Inbucket** | `critical` | Init, whenever `domain` is unset | Running the action |

`critical` blocks Inbucket from starting and suspends the ordinary Start/Stop controls, so a user reporting "there are no buttons" is looking at this. The check runs on every init, not only at install, so clearing the domain raises it again.

## Health Checks

Six checks, and the ordering between them is the diagnostic.

| Check             | Probes                                                       |
| ----------------- | ------------------------------------------------------------ |
| `inbucket`        | Upstream's web port is listening                             |
| `smtp`            | The SMTP port is listening — requires `inbucket`             |
| `client-postgres` | `pg_isready` against the client's database                   |
| `client-monitor`  | The monitor's ready file exists — requires the account setup |
| `client-reconciler` | The startup reconciliation finished — requires Inbucket and the account setup |
| `client`          | `GET /up` on the Rails client                                |

`smtp` failing while `inbucket` passes means the listener did not bind — almost always a domain Inbucket rejected at start.

`client-monitor` is the one worth understanding: it tracks a websocket subscription to upstream's `/api/v2/monitor/messages`, and its ready file disappears when that socket closes. A monitor that keeps going not-ready and back means the client is losing its connection to upstream rather than failing itself — the monitor reconnects on its own every few seconds. Its failure costs the "Monitor" tab and new mailboxes appearing on their own; reading mail through the client is unaffected.

`client-reconciler` becomes ready after its first pass over the saved mailbox catalog. It then repeats every 24 hours. An upstream failure leaves the previous metadata and stars intact, marks that mailbox's sync error, and retries after five minutes.

`client` failing while `client-postgres` passes means Puma did not come up, or the schema setup ahead of it failed — the `client-database-prepare` and `client-account-prepare` output in the logs says which.

## Backups and Restore

The strategy is mixed. `main` — every received message and upstream's config — is copied wholesale. `client-postgres` is **dumped and replayed**, not copied: its files are never captured, and restore rebuilds the database by replaying the dump into a fresh cluster.

Nothing is deliberately excluded. A restored instance needs nothing re-entered: the domain and storage settings come back in `store.json`, the client's account, saved mailbox catalog, shared metadata index, and per-user stars come back in the dump, and the credentials that worked before the backup still work.

The bounded shared metadata index and per-user star links are in the database dump. Message headers, including Inbucket's canonical `seen` state, are stored with the messages on `main`. The startup reconciliation refreshes the Rails index from those headers after restore.

## Limitations and Differences

1. **Upstream's web interface and REST API have no authentication and the package does not add any.** This is upstream's design, not a gap; it is why the client exists.
2. **The SMTP listener has no TLS**, so mail arrives in the clear. It is a receiver for testing and disposable addresses.
3. **POP3 is bound to loopback and not exported.** Upstream serves it; here it is unreachable.
4. **Only one domain is accepted at a time.** Upstream can accept several; the package's action takes one.
5. **The client renders HTML mail only after sanitizing it** inside an isolated frame. Sender CSS and complex table layouts are preserved. Remote images are blocked by default and load only after explicit approval. `cid:` images are proxied through an authenticated endpoint, only common raster formats are returned, and attachments download instead of displaying inline, including PDF and SVG files. Its desktop workspace gives the message list and selected message independent scrolling, client-side search, read and unread filtering, a cross-mailbox Starred view backed by bounded shared PostgreSQL metadata and per-user links, date and size sorting of loaded mailbox and monitor metadata, unread indicators backed by Inbucket's shared `seen` state, and mailbox creation and management from the compact toolbar.
6. **Reaching Inbucket from the internet needs an external port 25 forward.** StartOS publishes the SMTP interface on 2500 and cannot map 25 for you.

## Quick Reference for AI Consumers

```yaml
package_id: inbucket
images:
  main: inbucket/inbucket
  client: built from Dockerfile
  postgres: postgres
architectures: [x86_64, aarch64]
subcontainers: [inbucket, client-app, client-postgres]
volumes:
  main: /config, /storage
  client-postgres: /var/lib/postgresql/data
file_models:
  - store.json
startos_managed_env_vars:
  - INBUCKET_MAILBOXNAMING
  - INBUCKET_SMTP_ADDR
  - INBUCKET_SMTP_DOMAIN
  - INBUCKET_SMTP_DEFAULTACCEPT
  - INBUCKET_SMTP_ACCEPTDOMAINS
  - INBUCKET_SMTP_DEFAULTSTORE
  - INBUCKET_SMTP_STOREDOMAINS
  - INBUCKET_SMTP_TIMEOUT
  - INBUCKET_WEB_ADDR
  - INBUCKET_POP3_ADDR
  - INBUCKET_STORAGE_TYPE
  - INBUCKET_STORAGE_PARAMS
  - INBUCKET_STORAGE_RETENTIONPERIOD
  - INBUCKET_STORAGE_MAILBOXMSGCAP
  - DATABASE_URL
  - SECRET_KEY_BASE
  - RAILS_ENV
  - RAILS_LOG_TO_STDOUT
  - PORT
  - INBUCKET_BASE_URL
  - ADMIN_USERNAME
  - ADMIN_PASSWORD
  - POSTGRES_DB
  - POSTGRES_USER
  - POSTGRES_PASSWORD
  - PGDATA
dependencies: none
interfaces:
  client: { type: ui, port: 3000 }
  ui: { type: ui, port: 9000 }
  rest-api: { type: api, port: 9000 }
  smtp: { type: api, port: 2500 }
actions:
  - configure-domain
  - set-admin-password
tasks:
  - { action: configure-domain, severity: critical }
  - { action: set-admin-password, severity: critical }
health_checks:
  - inbucket
  - smtp
  - client-postgres
  - client-monitor
  - client-reconciler
  - client
```
