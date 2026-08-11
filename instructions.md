# Inbucket

## Documentation

- [Inbucket manual](https://book.inbucket.org/) — upstream user and reference guide.
- [Configuration reference](https://book.inbucket.org/configuration/index.html) — upstream SMTP, web, storage, and mailbox behavior.
- [REST API reference](https://book.inbucket.org/rest/index.html) — mailbox and message endpoints under `/api/v1/`.

## What you get on StartOS

- **Web Interface** for opening disposable mailboxes and inspecting messages.
- **REST API** for retrieving and deleting mail programmatically.
- **Inbound SMTP** for receiving mail addressed to your disposable domain.
- Persistent message storage with automatic deletion after approximately one hour.

## Getting set up

1. Complete **Configure Domain** and enter a fully qualified domain you control, such as `temp.example.com`.
2. Start Inbucket and wait for the **Web Interface** and **Inbound SMTP** health checks to become ready.
3. Decide how senders will reach the **Inbound SMTP** interface. Internet mail delivery requires a public server that accepts TCP port 25 and forwards raw TCP traffic to the assigned Inbucket SMTP address.
4. Add DNS records similar to the following, replacing the names and address with your own:

   ```dns
   mail.temp.example.com.  A      203.0.113.10
   temp.example.com.       MX 10  mail.temp.example.com.
   ```

5. Send a message to any local part at the configured domain, for example `github-82d2@temp.example.com`.
6. Open the **Web Interface**, enter `github-82d2` as the mailbox name, and inspect the received message.

A normal HTTP reverse proxy cannot carry SMTP. Use raw TCP forwarding—such as a public VPS connected to the StartOS server through StartTunnel/WireGuard—or a direct port-forwarding path supported by your network.

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
