# Inbucket for StartOS

Run a private disposable-email service on StartOS. Inbucket receives SMTP mail
for a domain you control and makes captured messages available through a web
interface and REST API, without delivering mail to external recipients.

## Quick start (StartOS)

Install Inbucket from the start9.tabordalab.com (TabordaLab StartOS registry),
or sideload the `.s9pk` package from this repository's GitHub release.

<img width="1419" height="527" alt="image" src="https://github.com/user-attachments/assets/38d7f4f6-73e2-4b8d-a855-b00aa41f852f" />

> **Upstream docs:** <https://book.inbucket.org/>
>
> Everything not listed here should behave the same as upstream Inbucket. If a
> feature, setting, or behavior is not mentioned here, the upstream
> documentation is applicable.

This repository packages [Inbucket](https://github.com/inbucket/inbucket), an
SMTP receiver that exposes captured mail through webmail and a REST API.

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Configuration Management](#configuration-management)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Actions](#actions)
- [Backups and Restore](#backups-and-restore)
- [Health Checks](#health-checks)
- [Dependencies](#dependencies)
- [Limitations and Differences](#limitations-and-differences)
- [What Is Unchanged from Upstream](#what-is-unchanged-from-upstream)
- [Contributing](#contributing)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

## Image and Container Runtime

The package uses the unmodified official `inbucket/inbucket` image and its
upstream entrypoint. The OCI index is pinned by digest in the manifest and
contains native x86_64 and aarch64 images.

## Volume and Data Layout

One StartOS volume named `main` is backed up as a unit:

| Volume subpath | Container path | Purpose |
| --- | --- | --- |
| `config/` | `/config` | Upstream-generated `greeting.html` and future container configuration |
| `storage/` | `/storage` | Received messages and mailbox indexes |
| `store.json` | Not mounted into the container | StartOS-managed domain, retention, and mailbox-limit settings |

The package selects Inbucket's file-storage backend. Mail therefore survives
service and server restarts.

## Installation and First-Run Flow

A critical **Configure Inbucket** task appears on a clean install. Inbucket cannot
start until the user enters a fully qualified recipient domain. The action
stores the domain, retention period, and per-mailbox message limit. The daemon
reads these values reactively, so later changes rebuild its configuration.

## Configuration Management

| StartOS-managed | Upstream behavior retained |
| --- | --- |
| SMTP listener on port 2500 | SMTP message parsing and mailbox creation |
| Web UI and REST listener on port 9000 | Webmail, monitor, message display, deletion, and API handlers |
| Accepted and stored recipient domain | Mailbox naming by local part |
| File storage at `/storage` | Upstream flat-file storage implementation |
| Configurable retention period | Periodic retention scan |
| Configurable per-mailbox message limit | Older-message deletion when the limit is exceeded |
| 30-second SMTP idle timeout | SMTP protocol handling |
| POP3 bound to container loopback only | Embedded POP3 daemon remains available inside the container |

The package deliberately does not add the StartOS outbound SMTP credentials
form. Stock Inbucket receives mail but has no outbound SMTP client, forwarding,
or notification feature. StartOS system SMTP credentials are therefore not
passed to Inbucket.

## Network Access and Interfaces

| Interface | Internal port | Protocol | Purpose |
| --- | ---: | --- | --- |
| Web Interface | 9000 | HTTP | Browser mailbox and message UI |
| REST API | 9000 | HTTP | `/api/v1/` mailbox and message API |
| Inbound SMTP | 2500 | Raw SMTP over TCP | Mail delivery for the configured recipient domain |

The package declares these interfaces; the administrator decides which gateway
addresses are enabled. It does not create public DNS, enable Tor, or make SMTP
public automatically.

Internet MX delivery normally requires an `A` record for a mail host, an `MX`
record pointing the disposable domain at that host, and raw TCP forwarding from
public port 25 to the assigned Inbucket SMTP interface. An HTTP reverse proxy is
not an SMTP transport.

## Actions

### Configure Inbucket

- **Visibility:** Enabled
- **Availability:** Any service status
- **Inputs:** One fully qualified disposable-mail domain, a retention period from 15 minutes to 7 days, and a per-mailbox limit from 1 to 10,000 messages
- **Effect:** Restricts SMTP acceptance and storage to that domain and applies the selected storage limits
- **Output:** A confirmation; no credentials or secrets

## Backups and Restore

StartOS snapshots the complete `main` volume while the service is stopped. The
backup includes received mail, mailbox indexes, the customized greeting file,
and the configured domain and storage limits. The Monitor's recent-message
history is held in memory and is not a separate backup dataset. After a restore,
mailbox messages return from `/storage`, while Monitor history begins empty and
repopulates as new messages arrive. Restore uses the SDK's volume restore flow
and then reapplies interfaces, actions, and daemon configuration.

## Health Checks

- Daemon readiness checks that the web listener has bound port 9000.
- A standalone **Inbound SMTP** check monitors whether port 2500 is listening.

Both checks inspect listening sockets without transmitting a message or
exposing stored mail.

## Dependencies

None. Inbucket embeds its SMTP, HTTP, POP3, and file-storage services.

## Limitations and Differences

1. Only mail for the configured domain is accepted and stored. Upstream accepts
   every recipient domain by default.
2. Message retention is configurable from 15 minutes to 7 days.
3. POP3 is not exported as a StartOS interface.
4. Inbucket does not authenticate mailbox viewers. Keep the Web Interface and
   REST API limited to trusted gateway addresses.
5. The inbound SMTP interface is plaintext SMTP. The package does not generate
   certificates or enable Inbucket STARTTLS.
6. There is no outbound SMTP action because upstream provides no outbound SMTP
   feature. Adding forwarding would require a separately specified component.

## What Is Unchanged from Upstream

The webmail UI, real-time monitor, REST API, MIME/attachment rendering, mailbox
creation, local-part mailbox naming, SMTP protocol handling, and file-storage
format are provided by the unmodified upstream image.

## Contributing

See [UPDATING.md](UPDATING.md) for this repository's development workflow and the local StartOS packaging-guide entry point.

## Quick Reference for AI Consumers

```yaml
package_id: inbucket
architectures: [x86_64, aarch64]
volumes:
  main:
    - /config
    - /storage
ports:
  web_and_rest: 9000
  inbound_smtp: 2500
  pop3_loopback_only: 1100
dependencies: none
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
actions:
  - configure-domain
```
