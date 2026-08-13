# Inbucket for StartOS

Inbucket receives SMTP mail for a domain you control. This package combines the
upstream Inbucket receiver with an authenticated Rails mailbox client, while
preserving the upstream administration interface and REST API.

## Quick start (StartOS)

Install Inbucket from the start9.tabordalab.com (TabordaLab StartOS registry), or sideload the `.s9pk` package from this repository's GitHub release.

<img width="1419" height="527" alt="image" src="https://github.com/user-attachments/assets/38d7f4f6-73e2-4b8d-a855-b00aa41f852f" />

## Interfaces

| Interface | ID | Purpose | Access guidance |
| --- | --- | --- | --- |
| Web Client Interface | `client` | Authenticated mailbox reading, monitor, source, CID images, and downloads | Normal user interface |
| Admin Web Interface | `ui` | Upstream webmail, status, and diagnostics | Trusted gateway addresses only |
| REST API | `rest-api` | Upstream automated mailbox API at `/api/v1/` | Trusted gateway addresses only |
| Inbound SMTP | `smtp` | Receives mail for the configured domain | Raw TCP delivery |

The Web Client Interface is the ordinary mailbox interface. It has generated
administrator credentials, encrypted HTTP-only sessions, private no-store API
responses, a strict same-origin CSP, sanitized HTML, and a same-origin CID
image proxy for AVIF, GIF, JPEG, PNG, and WebP.

The Admin Web Interface is the unmodified upstream interface. It deliberately
has no mailbox authentication. Do not publish it through untrusted gateway
addresses. The REST API has the same upstream mailbox exposure and should be
treated accordingly.

## Runtime

The package keeps the pinned upstream `inbucket/inbucket` image for SMTP,
storage, upstream webmail, and REST. A separate `client` image builds the Vite
frontend and runs the Rails application. A private PostgreSQL sidecar stores
the client administrator, sessions, saved mailbox catalog, and monitor
summaries.

The Rails client reaches Inbucket through the StartOS bridge address for the
package's own web host. It does not use Compose DNS or loopback to cross
subcontainers.

## Upstream provenance

StartOS package version `3.1.1:3` retains the official multi-architecture
Inbucket image. The image is not rebuilt from the submodule.

| Component | Immutable source |
| --- | --- |
| Upstream release | `v3.1.1` |
| `upstream-project` commit | `6eff554469f681ab99f540fc440e24e06a7be636` |
| Main image | `inbucket/inbucket:3.1.1@sha256:4a4c4cf553967e1863e4f48c828774786ac9ee73c53b3a3ecef10f66e5a2cdfb` |

The upstream release workflow builds the `3.1.1` and `sha-6eff554` image tags
from the same tagged source commit. Docker Hub reports the same architecture
digests for both tags. The manifest pins the multi-architecture `3.1.1` digest,
so the submodule documents and audits the upstream source without changing the
runtime image provenance.

| Volume | Contents |
| --- | --- |
| `main` | Existing upstream `/config`, `/storage`, and StartOS domain settings |
| `client-config` | Generated Rails secret and client credentials |
| `client-postgres` | Private PostgreSQL state for the authenticated client |

Backups retain the existing `main` volume and add the client configuration
volume plus a PostgreSQL dump of `client-postgres`.

## Setup and operations

1. Run **Configure Inbucket** with the recipient domain, retention period, and
   per-mailbox message limit.
2. Run **Show Login Credentials** to retrieve the generated Web Client
   Interface credentials.
3. Use **Refresh Login Password** to rotate the client password. It restarts
   the service and invalidates existing client sessions.
4. Configure DNS and raw TCP forwarding for port 25 to the StartOS Inbound SMTP
   interface as described in [instructions.md](instructions.md).

Inbucket is an SMTP receiver, not an outbound SMTP client. This package does
not use StartOS outbound SMTP credentials or forward received mail externally.

## Security behavior

The client renders untrusted HTML only after sanitization. Its CSP does not
allow third-party image loads or `cid:` URLs. CID images are fetched through an
authenticated same-origin endpoint and only supported raster formats are
returned. Attachments are authenticated downloads with their declared MIME
type, `Content-Disposition: attachment`, and `X-Content-Type-Options: nosniff`.
PDF, HTML, SVG, and other active content are not embedded. A PDF viewer remains
a separate follow-up.

## Standalone Inbucket Client migration

The first integrated release starts with clean client state under the Inbucket
package ID. It does not automatically move the standalone `inbucket-client`
PostgreSQL volume, uninstall the standalone package, or promise a silent
upgrade. Keep the standalone package installed until an export/import
procedure for credentials and saved mailbox state has been validated on a
non-production server.

After live migration validation and release verification, the standalone
package can be marked deprecated in its documentation and registry listing.

## Development

```sh
npm ci
npm run check
npm run build
node node_modules/@start9labs/start-sdk/lint.mjs
bundle exec rspec
make arches
```

The Rails request and service specs require a real PostgreSQL test database.
Build package architectures serially from a clean signed commit and inspect
each S9PK manifest and commitment before publishing.
