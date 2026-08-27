# Inbucket

Inbucket receives mail for a domain you control and provides an authenticated
Web Client Interface for reading it.

## Documentation

- [Inbucket documentation](https://www.inbucket.org/) covers upstream SMTP,
  REST API, POP3, and message behavior.
- [Package reference](https://github.com/alextab93/inbucket-startos) documents
  StartOS-specific interfaces, settings, storage, security, and limitations.
- [StartTunnel documentation](https://docs.start9.com/start-tunnel) explains
  public TCP forwarding when the server is behind StartTunnel.

## What you get on StartOS

- **Web Client Interface** for authenticated mailbox reading, monitoring,
  source viewing, CID images, attachments, deletion, and archived mailboxes.
- **Admin Web Interface** for upstream webmail, status, and diagnostics.
- **REST API** for upstream mailbox automation.
- **Inbound SMTP** for messages addressed to the configured domain.

The Admin Web Interface and REST API do not add mailbox authentication. Expose
them only through trusted StartOS gateway addresses.

## Getting set up

1. Run **Configure Inbucket**.
2. Enter a fully qualified domain such as `temp.example.com`.
3. Choose message retention, messages per mailbox, and the maximum SMTP message
   size. The default message size is 50 MiB and includes headers and MIME
   encoding.
4. Wait for all five health checks to become ready.
5. Run **Show Login Credentials** and sign in through the Web Client Interface.

Use **Refresh Login Password** when credentials need to be rotated. Rotation
restarts the service and signs out every current Web Client session.

## Receiving Internet mail

1. Publish the **Inbound SMTP** interface through a raw TCP gateway.
2. Forward external TCP port 25 to the assigned Inbucket SMTP port on the
   StartOS server. StartTunnel commonly maps this to internal port 2500.
3. Allow inbound TCP port 25 through any cloud or router firewall.
4. Add an A record for the mail host and an MX record for the recipient domain.

For `temp.example.com`, a typical DNS configuration is:

```dns
mx.temp.example.com.  A      203.0.113.10
temp.example.com.     MX 10  mx.temp.example.com.
```

Send a message to `hello@temp.example.com`, then open the `hello` mailbox in
the Web Client Interface. An HTTP reverse proxy cannot transport SMTP.

## Reading messages safely

Received email is untrusted Internet content. The Web Client sanitizes HTML and
CSS and renders it inside an isolated frame. Plain-text links are clickable.

Remote images are blocked by default because they can report that a message was
opened. Choose **Load remote images** only when you trust the sender. This
choice applies only to the active message.

Supported CID images render through the authenticated client. Attachments are
downloaded rather than embedded. **View source** shows the original message as
plain text when a malformed or unusual message needs diagnosis.

## Backups and existing client data

StartOS backups include received mail, generated client configuration, and the
private client database dump.

The former standalone `inbucket-client` package has a separate package ID and
database volume. Keep it installed until a validated export and import process
is available. Installing this package does not move or delete standalone client
state.

## Limitations

- Inbucket receives mail but does not send or forward outbound mail.
- Internet delivery requires a reachable raw TCP port 25.
- Admin Web Interface and REST API mailbox access is not authenticated.
- SVG, HTML, PDF, and other active attachments are not rendered inline.
- Client state from the standalone package is not migrated automatically.
