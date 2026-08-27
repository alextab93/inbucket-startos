<p align="center">
  <img src="icon.png" alt="Inbucket Logo" width="21%">
</p>

# Inbucket on StartOS

> Upstream documentation: <https://www.inbucket.org/>
>
> Everything not listed here should behave like upstream Inbucket 3.1.1. If a
> feature, setting, or behavior is not mentioned, the upstream documentation is
> accurate and fully applicable.

[Inbucket](https://github.com/inbucket/inbucket) is a disposable email server.
This package adds StartOS orchestration, persistent settings, an authenticated
mailbox client, and a private client database around the upstream receiver.

---

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [File Models](#file-models)
- [Dependencies](#dependencies)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Configuration Management](#configuration-management)
- [Actions](#actions)
- [Tasks](#tasks)
- [Health Checks](#health-checks)
- [Backups and Restore](#backups-and-restore)
- [Limitations and Differences](#limitations-and-differences)
- [What Is Unchanged from Upstream](#what-is-unchanged-from-upstream)
- [Contributing](#contributing)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

---

## Image and Container Runtime

| Image | Source | Architectures | Purpose |
| --- | --- | --- | --- |
| `main` | Digest-pinned `inbucket/inbucket:3.1.1` | x86_64, aarch64 | SMTP, upstream webmail, REST API, POP3, and file-backed mail storage |
| `client` | Package Dockerfile | x86_64, aarch64 | Rails API and Vite mailbox client |
| `postgres` | Digest-pinned PostgreSQL 17.6 Alpine | x86_64, aarch64 | Private authenticated-client state |

The official Inbucket image remains unmodified. `upstream-project` is pinned to
commit `6eff554469f681ab99f540fc440e24e06a7be636` for source provenance; the
runtime image is pinned separately by OCI digest.

## Volume and Data Layout

| Volume | Mount point | Contents |
| --- | --- | --- |
| `main` | `/config` and `/storage` in Inbucket | Received mail, upstream configuration, and StartOS `store.json` |
| `client-config` | StartOS-managed file storage | Reserved client configuration volume |
| `client-postgres` | `/var/lib/postgresql/data` | Users, sessions, saved mailbox catalog, and monitor summaries |

Email bodies remain file-backed in upstream Inbucket. PostgreSQL does not store
received messages.

## File Models

`store.json` is managed through the StartOS SDK and contains:

- recipient domain;
- retention period;
- per-mailbox message cap;
- maximum SMTP message size in MiB;
- generated database password, Rails secret, username, and login password.

Missing or invalid settings use safe defaults. Existing installations without
the message-size field resolve to 50 MiB.

## Dependencies

There are no external StartOS package dependencies. Inbucket, the Rails client,
and PostgreSQL are orchestrated as subcontainers of this package.

## Network Access and Interfaces

| Interface | ID | Internal port | Type | Purpose |
| --- | --- | --- | --- | --- |
| Web Client Interface | `client` | 3000 | UI | Authenticated mailbox access |
| Admin Web Interface | `ui` | 9000 | UI | Upstream webmail, status, and diagnostics |
| REST API | `rest-api` | 9000 | API | Upstream `/api/v1/` automation |
| Inbound SMTP | `smtp` | 2500 | Raw TCP | Receives mail for the configured domain |

The Admin Web Interface and REST API retain upstream's unauthenticated mailbox
access. Publish them only through trusted StartOS gateway addresses. The Web
Client Interface is the normal private mailbox interface.

Internet MX delivery requires external TCP port 25 to reach the Inbound SMTP
interface. An HTTP reverse proxy cannot transport SMTP.

## Installation and First-Run Flow

1. Installation generates the client database password, Rails secret, and
   administrator credentials.
2. A critical task asks for the disposable mail domain and storage limits.
3. Inbucket, PostgreSQL, database preparation, account synchronization, the
   mailbox monitor, and the client start in dependency order.
4. Use **Show Login Credentials** to sign in to the Web Client Interface.
5. Configure DNS MX records and raw TCP forwarding separately.

## Configuration Management

| Setting | StartOS input | Runtime behavior |
| --- | --- | --- |
| Recipient domain | Fully qualified domain | Sets accepted and stored SMTP domains |
| Message retention | 15 minutes to 7 days | Deletes messages after the selected period |
| Messages per mailbox | 1 to 10,000 | Deletes older messages when the cap is exceeded |
| Maximum message size | 1 to 100 MiB, default 50 MiB | Sets the SMTP limit including headers and MIME encoding |

The package fixes mailbox naming to local parts, stores mail under `/storage`,
disables default acceptance and storage for other domains, and binds upstream
POP3 only on loopback.

## Actions

| Action | Purpose | Availability | Result |
| --- | --- | --- | --- |
| Configure Inbucket | Changes recipient domain, retention, mailbox cap, and SMTP size limit | Any status | Saves settings for the next service application |
| Show Login Credentials | Displays generated Web Client credentials | Any status | Copyable username and masked password |
| Refresh Login Password | Replaces the client password and restarts the service | Any status | Copyable username and new masked password |

Refreshing the password invalidates every existing Web Client session.

## Tasks

The package raises a critical **Configure Inbucket** task until a valid domain
has been saved. Inbound SMTP does not start without that configuration.

## Health Checks

| Check | Method | Observable result |
| --- | --- | --- |
| Admin Web Interface | Port 9000 listening | Upstream web service is ready |
| Inbound SMTP | Port 2500 listening | SMTP receiver is ready |
| Client Database | `pg_isready` | PostgreSQL accepts the client database connection |
| Client Monitor | Readiness file | Monitor event loop reached its running state |
| Web Client Interface | `GET /up` | Rails client and database are available |

Checks remain separate so a client failure does not hide the state of upstream
Inbucket or inbound SMTP.

## Backups and Restore

Backups include the complete `main` and `client-config` volumes plus a
PostgreSQL dump of `client-postgres`. Generated credentials are stored in
`store.json` on `main`; authenticated client records are restored from the
database dump.

The standalone `inbucket-client` package uses a different package ID, so
StartOS cannot silently move its PostgreSQL volume into this package. Keep the
standalone package until an export and import procedure has been validated.

## Limitations and Differences

1. Inbucket receives mail but does not send or forward outbound mail.
2. The Admin Web Interface and REST API have upstream's unauthenticated mailbox
   access and should remain on trusted addresses.
3. The authenticated client renders email in a sanitized, sandboxed iframe.
   Remote images are blocked until explicitly loaded for the active message.
4. CID rendering is limited to AVIF, GIF, JPEG, PNG, and WebP. Attachments are
   forced downloads; HTML, SVG, PDF, and other active types are not embedded.
5. MIME warnings from the internal upstream web UI route are not proxied. View
   Source remains the stable diagnostic path.
6. Client state from the standalone package is not migrated automatically.

## What Is Unchanged from Upstream

- SMTP receiving and domain policy;
- enmime parsing and body selection;
- file-backed message storage;
- upstream Admin Web Interface;
- REST API v1;
- POP3 behavior inside the package network;
- upstream retention and mailbox-cap enforcement.

## Contributing

Report package bugs and feature requests in the
[package repository](https://github.com/alextab93/inbucket-startos/issues).
General Inbucket behavior belongs in the
[upstream repository](https://github.com/inbucket/inbucket/issues).

---

## Quick Reference for AI Consumers

```yaml
package_id: inbucket
upstream_version: 3.1.1
upstream_commit: 6eff554469f681ab99f540fc440e24e06a7be636
architectures: [x86_64, aarch64]
volumes:
  main: [/config, /storage]
  client-config: reserved StartOS-managed files
  client-postgres: /var/lib/postgresql/data
ports:
  client: 3000
  ui: 9000
  rest-api: 9000
  smtp: 2500
dependencies: none
startos_managed_env_vars:
  - INBUCKET_SMTP_DOMAIN
  - INBUCKET_SMTP_MAXMESSAGEBYTES
  - INBUCKET_STORAGE_RETENTIONPERIOD
  - INBUCKET_STORAGE_MAILBOXMSGCAP
actions:
  - configure-domain
  - show-credentials
  - refresh-login-password
```
