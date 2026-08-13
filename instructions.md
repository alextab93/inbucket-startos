# Inbucket

## What you get

- **Web Client Interface** is the normal authenticated mailbox reader.
- **Admin Web Interface** is upstream Inbucket webmail, status, and diagnostics.
- **REST API** provides upstream mailbox automation at `/api/v1/`.
- **Inbound SMTP** receives messages for your configured domain.

The Admin Web Interface and REST API do not add upstream mailbox authentication.
Expose them only through trusted StartOS gateway addresses. Use the Web Client
Interface for normal mailbox access.

## First setup

1. Complete **Configure Inbucket** with a fully qualified domain you control,
   such as `temp.example.com`, then choose retention and mailbox limits.
2. Wait for **Admin Web Interface**, **Inbound SMTP**, **Client Database**,
   **Web Client Interface**, and **Client Monitor** to become ready.
3. Run **Show Login Credentials** and open the **Web Client Interface** with
   the generated username and password.
4. Rotate client credentials with **Refresh Login Password** when needed. This
   signs out current Web Client Interface sessions.

## Receiving Internet mail

1. Enable the StartTunnel gateway for **Inbound SMTP** and note its assigned
   StartOS port, normally `2500`.
2. In StartTunnel, create a manual published port from external TCP `25` to the
   Inbucket SMTP port on the StartOS server.
3. Allow inbound TCP port `25` in any cloud firewall.
4. Add an A record for the mail host and an MX record for the recipient domain.
   For `temp.example.com`:

   ```dns
   mx.temp.example.com.  A      203.0.113.10
   temp.example.com.     MX 10  mx.temp.example.com.
   ```

5. Send a test message to `hello@temp.example.com`, then open `hello` in the
   Web Client Interface.

The manual external port `25` rule is needed for Internet MX delivery even when
StartTunnel also publishes port `2500`. An HTTP reverse proxy cannot carry SMTP.

## Mailbox safety

The Web Client Interface stores sessions, mailbox names, and monitor summaries
in a private PostgreSQL database. Received mail remains in Inbucket's existing
storage volume. Backups include received mail, generated client configuration,
and the private database dump.

The client sanitizes HTML, proxies supported inline raster images through its
authenticated same-origin endpoint, and downloads attachments rather than
embedding them. Do not rely on the Admin Web Interface as a protected mailbox
viewer.

## Existing standalone client users

The integrated package begins with a clean client database. It cannot silently
move the standalone `inbucket-client` package's PostgreSQL volume into this
package. Keep the standalone package and data in place until a tested
export/import procedure is available. Do not uninstall it based only on this
upgrade.
