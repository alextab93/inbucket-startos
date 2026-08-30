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

1. Run **Configure Inbucket**. Enter the domain from above, then choose how long messages are kept and how many each mailbox holds.
2. Run **Set Admin Password** and save the username and password it gives you — the password is shown once.
3. Start Inbucket. It will not start until both of the steps above are done, which is why they are the only things you can press at first.
4. Open the **Web Client Interface** and sign in.

On iPhone or iPad, open the Web Client Interface in Safari, use **Share**, then choose **Add to Home Screen**. The shortcut uses the Inbucket icon and opens without the normal Safari toolbar. It still needs a connection to your StartOS server. If you installed an older shortcut with a letter icon or browser toolbar, remove it and add it again after upgrading so iOS replaces its cached settings.

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

Sign in, then use **Add mailbox** to open a mailbox name. The mailbox does not have to exist yet. Mailboxes you have opened are saved under **Mailboxes**, where you can select several, archive the ones you are done with, or delete them. Use **Search messages** to search the stored summaries by subject, sender, recipient, mailbox, or date. Open **Filter** to show read or unread messages, choose an inclusive **From** or **To** date or both, and sort the results by newest, oldest, largest, or smallest. **Clear dates** removes both date boundaries. The toolbar count is the total number of matching stored messages and does not grow as additional pages load. The list footer shows how many matching messages are currently loaded. The list loads more results automatically as you approach its end. If that request fails, the messages already visible remain available and **Load more messages** lets you retry. Before you open a message, the list uses the full workspace width and shows its sender, subject prefixed by the first tag and remaining tag count, mailbox, and date in compact columns on larger screens. Opening a message hides the list and gives the reader the full workspace width. Use **Back to message list** in the message action bar to close the reader, restore the list, and return keyboard focus to its heading.

The browser address follows the active view. Reloading it, copying it, or using the browser's Back and Forward controls restores Mailboxes, Starred, or Archived instead of reopening a message from another view. Mailboxes and Starred addresses also restore their own selected message when one is open. An old Monitor address safely opens Mailboxes at the root.

The **Starred** tab collects messages you starred across every mailbox. It has the same search, read and unread filters, inclusive date range, sorting choices, and **All tags** control as Mailboxes, plus a mailbox filter that defaults to **All mailboxes**.

The Mailboxes list updates automatically when messages arrive or are deleted. **Live all active mailboxes** is enabled by default, so new arrivals from every active mailbox appear without loading that mailbox's older messages. Turn it off to limit live arrivals to the selected mailboxes. A newly discovered active mailbox is added and checked without clearing your existing selection, while an archived mailbox stays archived. Live changes keep the current message, search, filters, sorting, loaded pages, scroll position, and keyboard focus in place. If updates are temporarily unavailable, current messages remain visible while the client retries.

Unread messages have a blue dot and stronger subject text. Opening a message records it as read in Inbucket, while the blue left border continues to identify the message currently selected. The state is shared with other interfaces using Inbucket's API, retained across browser sessions, and included in backups.

Use the star beside a message or in the selected-message header to add or remove it from **Starred**. Stars belong to the signed-in user, persist across browser sessions, and are included in backups. Deleting a message or purging its mailbox also removes every user's star for that message.

Use **Tag message** in the selected-message action bar to apply several reusable tags. **Create tag** provides ten named color presets and a labeled browser color picker with a live preview. **Manage tags** lets you rename, recolor, or confirm deletion of your tags. Each compact neutral badge places the tag color swatch beside its name. Mailboxes and Starred show the first tag plus a `+N` count, while the reader shows every assigned tag. Tags belong to the signed-in user, persist across browser and service restarts, and are included in backups. Use **All tags** in Mailboxes or Starred to show only messages with one persisted assignment. Removing an assignment keeps the reusable tag. Deleting a message or purging its mailbox removes its assignments without deleting tag definitions.

The private client keeps bounded message summaries, stars, tag definitions, and tag assignments in its database so mailbox pagination and Starred can share the same message state without storing message bodies or attachments twice. New arrivals and deletions update that index through the live monitor. The Mailboxes list reads bounded changes from the index without repeatedly scanning complete mailboxes. Saved mailboxes are checked when the service starts, when selected, and every 24 hours. If Inbucket is temporarily unavailable, the previous summaries, stars, and tag assignments remain until a later successful check. Deleted or otherwise unavailable messages are not shown in Mailboxes or Starred and have no tag assignments. Historical mailboxes that have never been opened in the private client are discovered only when you open them or when a new message arrives.

The **Archived** view reports when its catalog is loading, when mailbox counts are unavailable, and when an action fails. Restoring returns a mailbox to the active list without deleting messages. **Delete mailbox** permanently purges an archived mailbox and all its messages after confirmation.

Opening a message shows the sanitized HTML body with its supported layout and styles, or the plain text if there is no HTML body. Remote images are blocked by default. Use **Load remote images** when you trust the sender and want to retrieve them. Images carried inside the message are shown without that approval. **View source** shows the raw message, and attachments download rather than open in the browser.

### Actions

- **Configure Inbucket:** Changes the accepted domain (see **Choosing a domain**), how long messages are kept, and how many each mailbox holds. The form shows your current settings, and saving restarts Inbucket. Mailboxes collected under a previous domain keep their names and stay readable, new mail for that domain is rejected, and lowering a storage limit deletes stored messages that no longer fit.
- **Set Admin Password** — generates a new password for the Web Client Interface and shows it once. Run it again whenever you want a fresh password or have lost the one you had. Saving restarts Inbucket, and once it is back the old password no longer works and everyone signed in has been signed out.

## Limitations

Inbucket receives mail; it does not send it, and there is no way to reply to a message from here.

Mail arrives over plain SMTP with no encryption in transit, which is normal for a disposable-mail server but worth knowing before you send anything sensitive to it.
