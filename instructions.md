# Inbucket

Inbucket accepts mail for one domain, and you choose that domain before it will start. What to enter depends on where the mail will come from — see **Choosing a domain** below. Changing it later leaves the mailboxes already collected under the old name.

## Documentation

- [Inbucket documentation](https://inbucket.org/) — the upstream site, covering how mailboxes are named, every configuration setting, and what the REST API offers.

## What you get on StartOS

A mail server that accepts anything addressed to your domain without you creating a mailbox first. Send to `anything@yourdomain`, and `anything` exists — useful for signing up to things you don't want in your real inbox, and for watching what an application actually sends.

Four interfaces come with it:

- **Web Client Interface** — a mailbox reader with a username and password. This is the one to use.
- **Admin Web Interface** — Inbucket's own webmail and server diagnostics.
- **REST API** — Inbucket's mailbox API, for scripts.
- **Inbound SMTP** — where mail arrives.

**The Admin Web Interface and the REST API have no password.** Anyone who can open them can read and delete every message. Keep them on addresses only you can reach, and use the Web Client Interface for everyday reading.

## Choosing a domain

The domain is a filter on the recipient address, not a claim of ownership. Inbucket accepts anything addressed to `<anything>@<your domain>` and rejects the rest. Nothing you enter is looked up in DNS, and Inbucket never checks whether the domain is real or yours.

So there are two ways to use it, and they want different answers:

**Mail from your own software, on your own network.** Point your application's SMTP settings at Inbucket and have it send to your chosen domain — a signup email to `signup@mailbox.test`, say. No DNS, no MX record, and nothing on the public internet. Use a name that can never collide with a real one: anything ending in `.test` is reserved for exactly this and will never be a real domain. `mailbox.test`, `dev.test`, `myapp.test` are all fine.

Don't reach for something like `test.com` or `example.com` — those are real registered domains belonging to other people. Nothing will break here, because Inbucket does not resolve them, but mail your applications send may leak to the real owner if it ever escapes to a real mail server.

**Mail from the internet**, so you can hand a disposable address to a website. Then it must be a domain you actually own and can add DNS records to, and you need the port forwarding in the next section. A subdomain of a domain you already have is the usual choice — `temp.yourdomain.com`.

If you are not sure, start with a `.test` name. Changing it later is one action.

## Getting set up

1. Run **Configure Inbucket**. Enter the domain from above, choose how long messages are kept and how many each mailbox holds, and set the maximum accepted SMTP message size.
2. Run **Set Admin Password** and save the username and password it gives you — the password is shown once.
3. Start Inbucket. It will not start until both of the steps above are done, which is why they are the only things you can press at first.
4. Open the **Web Client Interface** and sign in.

At this point Inbucket works for anything on your own network. To receive mail from the internet, continue below.

## Receiving mail from the internet

Only needed if you picked a domain you own and want real senders to reach it. Skip this if you are only testing your own software.

Mail servers deliver to port 25, and StartOS publishes Inbucket's SMTP interface on port 2500, so you need one manual forward. A normal web reverse proxy cannot do this — SMTP is not HTTP.

1. Enable a gateway for **Inbound SMTP** and note the port it is published on, normally `2500`.
2. In StartTunnel, add a published port from external TCP `25` to that port.
3. Open inbound TCP `25` in any cloud firewall in front of the server.
4. Point DNS at it. For `temp.yourdomain.com`, with your server at `203.0.113.10`:

   ```dns
   mx.temp.yourdomain.com.  A      203.0.113.10
   temp.yourdomain.com.     MX 10  mx.temp.yourdomain.com.
   ```

5. Send a message to `hello@temp.yourdomain.com`, then open the mailbox `hello` in the Web Client Interface.

## Using Inbucket

### Web client interface

Sign in, then type a mailbox name to open it — the mailbox does not have to exist yet. Mailboxes you have opened are saved to a list you can come back to, and you can archive the ones you are done with rather than deleting them.

The **Monitor** tab shows deliveries as they arrive across every mailbox, which is the quickest way to catch a message you are waiting on.

Opening a message shows the sanitized HTML body, or the plain text if there is none. Remote images are blocked; images the message carries with it are shown. **View source** shows the raw message, and attachments download rather than open in the browser.

### Actions

- **Configure Inbucket:** Changes the accepted domain (see **Choosing a domain**), how long messages are kept, how many each mailbox holds, and the maximum accepted SMTP message size. Choose **Forever** to disable automatic expiration, or enter `0` messages per mailbox for no per-mailbox limit. Either unlimited setting can fill the data volume. The message-size limit remains finite, accepts 1 to 100 MiB, and defaults to 50 MiB. The form shows your current settings, and saving restarts Inbucket. Mailboxes collected under a previous domain keep their names and stay readable, new mail for that domain is rejected, lowering a storage limit deletes stored messages that no longer fit, and lowering the message-size limit rejects future messages above it.
- **Set Admin Password** — generates a new password for the Web Client Interface and shows it once. Run it again whenever you want a fresh password or have lost the one you had. Saving restarts Inbucket, and once it is back the old password no longer works and everyone signed in has been signed out.

## Limitations

Inbucket receives mail; it does not send it, and there is no way to reply to a message from here.

Mail arrives over plain SMTP with no encryption in transit, which is normal for a disposable-mail server but worth knowing before you send anything sensitive to it.
