# Inbucket

## Documentation

- [Inbucket manual](https://book.inbucket.org/), the upstream user and reference guide.
- [Configuration reference](https://book.inbucket.org/configuration/index.html), covering upstream SMTP, web, storage, and mailbox behavior.
- [REST API reference](https://book.inbucket.org/rest/index.html), covering mailbox and message endpoints under `/api/v1/`.

## What you get on StartOS

- **Web Interface** for opening disposable mailboxes and inspecting messages.
- **REST API** for retrieving and deleting mail programmatically.
- **Inbound SMTP** for receiving mail addressed to your disposable domain.
- Persistent message storage with automatic deletion after approximately one hour.

## Getting set up

1. Complete **Configure Domain** and enter a fully qualified domain you control, such as `temp.example.com`.
2. Start Inbucket and wait for the **Web Interface** and **Inbound SMTP** health checks to become ready.
3. Enable the StartTunnel gateway for the **Inbound SMTP** interface. Note the assigned SMTP port shown by StartOS, which is normally `2500`.
4. In StartTunnel, add a manual published port with these values:

   | Field | Value |
   | --- | --- |
   | Label | `StartOS Inbucket` |
   | External Port | `25` |
   | Server | The StartOS server running Inbucket |
   | Internal Port | The assigned SMTP port, normally `2500` |
   | Number of Ports | `1` |
   | IP Version | `IPv4` |
   | Hostname | Leave blank |

5. Allow inbound TCP port `25` in the VPS provider firewall when it uses a separate cloud firewall.
6. Add an A record for the mail server hostname and an MX record for the disposable recipient domain. For `temp.example.com`, use:

   ```dns
   mx.temp.example.com.  A      203.0.113.10
   temp.example.com.     MX 10  mx.temp.example.com.
   ```

   Replace `203.0.113.10` with the public IPv4 address shown by StartTunnel. In DNS forms that append the zone name automatically, enter `mx.temp` as the A record host, `temp` as the MX record host, `mx.temp.example.com` as the mail server, and `10` as the MX priority. The mail server A record must be DNS-only when the DNS provider offers HTTP proxying.

7. Verify DNS and the public SMTP port:

   ```bash
   dig +short A mx.temp.example.com
   dig +short MX temp.example.com
   nc -vz mx.temp.example.com 25
   ```

8. Send a test message with `swaks`:

   ```bash
   swaks \
     --server mx.temp.example.com \
     --port 25 \
     --from test@example.com \
     --to hello@temp.example.com
   ```

   A successful delivery ends with an SMTP response similar to `250 Mail accepted for delivery`.

9. Open the **Web Interface**, enter `hello` as the mailbox name, and inspect the received message.

StartOS may automatically publish external port `2500` to internal port `2500`. Keep the manual external port `25` to internal port `2500` rule because Internet MX delivery uses TCP port `25`. The automatic port `2500` mapping does not replace it.

A normal HTTP reverse proxy cannot carry SMTP. Use raw TCP forwarding through StartTunnel or another direct port-forwarding path. Caddy may continue serving HTTP and HTTPS on ports `80` and `443`; it does not need an SMTP reverse-proxy entry.

## Using Inbucket

### Web Interface

Mailboxes are created when mail arrives; there is no account-registration step. The mailbox name is the part before `@`, and `+tag` suffixes are ignored. Anyone who can reach the Web Interface can browse mailbox contents, so enable it only on trusted gateway addresses.

### REST API

Use the **REST API** interface for automated tests and integrations. The upstream API documentation describes listing a mailbox, retrieving message content or source, deleting a message, and purging a mailbox.

### Configure Domain action

Run **Configure Domain** whenever the recipient domain changes. Inbucket reloads with the new domain and rejects messages addressed to the previous domain. Existing stored mailboxes are not renamed.

### Inbound SMTP

The SMTP interface receives messages; it is independent from the StartOS system SMTP relay used by applications that send mail. Inbucket does not send or forward messages, so there is no outbound SMTP credentials action.

## Limitations

POP3 is not exposed as a StartOS interface. The SMTP listener does not provide STARTTLS in this package. Stored messages expire after approximately one hour, and the Web Interface has no upstream login mechanism.
