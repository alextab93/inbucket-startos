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
| `client`   | Built from this repo's `Dockerfile`                        | `puma`, and two `rails runner` |
| `postgres` | Upstream `postgres` alpine, pinned by digest               | Upstream's                     |

All three build for `x86_64` and `aarch64`.

The `client` image is not a wrapper around anything upstream — it is a Rails API and a Vite-built browser frontend written for this package, backed by its own PostgreSQL. It exists because upstream Inbucket's webmail deliberately has no authentication: anyone who can reach it can read every mailbox. The client puts a login in front of the same data, which it reads through upstream's REST API and monitor websocket over loopback.

Three subcontainers run: `inbucket` (upstream), `client-postgres`, and `client-app`. The last hosts three processes — the Puma web server, the monitor, and the two setup oneshots — in one subcontainer, so they share a filesystem. Attach with `start-cli package attach inbucket -n client-app`.

## Volume and Data Layout

Two volumes: received mail on one, the client's own state on the other.

| Volume            | Mount point                | Contents                                                             |
| ----------------- | -------------------------- | -------------------------------------------------------------------- |
| `main`            | `/config`, `/storage`      | Upstream's config directory and the message store                    |
| `main`            | not mounted                | `store.json`, at the volume root                                     |
| `client-postgres` | `/var/lib/postgresql/data` | The client's users, sessions, mailbox catalog, read state, and monitor summaries |

Only the `config` and `storage` subdirectories of `main` are mounted, so `store.json` sits beside them and is not visible to any container that does not need it. Messages themselves are files under `/storage`, one directory per mailbox — Inbucket's file store, not a database.

## File Models

One model, holding StartOS-side state. Upstream Inbucket has no configuration file the package owns; everything it is told arrives as an environment variable, re-applied on every start.

| Model        | File              | Seeded                                    | Rewritten       |
| ------------ | ----------------- | ----------------------------------------- | --------------- |
| `store.json` | `main:store.json` | At install, and by **Set Admin Password** | By both actions |

It carries two unrelated things. The first is the settings the user chose: accepted domain, retention period, per-mailbox message cap, and maximum SMTP message size. These are read at start and turned into `INBUCKET_*` variables. Changing any of them requires a restart to take effect, and the service reads them fresh each time, so an edit made here always wins.

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

- **When to run it:** First at install, prompted by the task; afterwards to change the accepted domain, storage limits, or maximum SMTP message size.
- **What the domain is** — a literal match against the recipient address, nothing more. It is never resolved, and the package never verifies ownership, so a reserved name like `mailbox.test` is a perfectly valid answer for someone only feeding Inbucket from their own applications. A domain the user owns is needed only to receive mail from the internet, which additionally needs the port-25 forward under [Limitations](#limitations-and-differences).
- **What it changes:** The domain, retention period, per-mailbox cap, and maximum SMTP message size in `store.json`. The form is pre-filled with what is already saved. The message-size limit accepts 1 to 100 MiB and defaults to 50 MiB.
- **Cost** — instant to save. The new values reach Inbucket on its next start.
- **Repeat safety** — idempotent.
- **What happens next:** Restart to apply. Changing the domain does not rename existing mailboxes, and mail for the old domain stops being accepted. Lowering retention or the message cap deletes stored messages that no longer fit. Lowering the SMTP message-size limit rejects future messages above that limit.
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

Four checks, and the ordering between them is the diagnostic.

| Check             | Probes                                                       |
| ----------------- | ------------------------------------------------------------ |
| `inbucket`        | Upstream's web port is listening                             |
| `smtp`            | The SMTP port is listening — requires `inbucket`             |
| `client-postgres` | `pg_isready` against the client's database                   |
| `client-monitor`  | The monitor's ready file exists — requires the account setup |
| `client`          | `GET /up` on the Rails client                                |

`smtp` failing while `inbucket` passes means the listener did not bind — almost always a domain Inbucket rejected at start.

`client-monitor` is the one worth understanding: it tracks a websocket subscription to upstream's `/api/v2/monitor/messages`, and its ready file disappears when that socket closes. A monitor that keeps going not-ready and back means the client is losing its connection to upstream rather than failing itself — the monitor reconnects on its own every few seconds. Its failure costs the "Monitor" tab and new mailboxes appearing on their own; reading mail through the client is unaffected.

`client` failing while `client-postgres` passes means Puma did not come up, or the schema setup ahead of it failed — the `client-database-prepare` and `client-account-prepare` output in the logs says which.

## Backups and Restore

The strategy is mixed. `main` — every received message and upstream's config — is copied wholesale. `client-postgres` is **dumped and replayed**, not copied: its files are never captured, and restore rebuilds the database by replaying the dump into a fresh cluster.

Nothing is deliberately excluded. A restored instance needs nothing re-entered: the domain and storage settings come back in `store.json`, the client's account and saved mailbox catalog come back in the dump, and the credentials that worked before the backup still work.

The monitor's summaries of past deliveries and per-user message read state are in the dump too, but the messages themselves are on `main` and are what actually matters.

## Limitations and Differences

1. **Upstream's web interface and REST API have no authentication and the package does not add any.** This is upstream's design, not a gap; it is why the client exists.
2. **The SMTP listener has no TLS**, so mail arrives in the clear. It is a receiver for testing and disposable addresses.
3. **POP3 is bound to loopback and not exported.** Upstream serves it; here it is unreachable.
4. **Only one domain is accepted at a time.** Upstream can accept several; the package's action takes one.
5. **The client renders HTML mail only after sanitizing it** inside an isolated frame. Sender CSS and complex table layouts are preserved. Remote images are blocked by default and load only after explicit approval. `cid:` images are proxied through an authenticated endpoint, only common raster formats are returned, and attachments download instead of displaying inline, including PDF and SVG files.
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
  - INBUCKET_SMTP_MAXMESSAGEBYTES
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
  - client
```
