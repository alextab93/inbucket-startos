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

On iPhone or iPad, open the Web Client Interface in Safari, use **Share**, then choose **Add to Home Screen**. The shortcut uses the Inbucket icon and opens without the normal Safari toolbar. It still needs a connection to your StartOS server.

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

After sign-in, **Mailboxes** shows **Recent messages** from all active mailboxes, newest first, without requiring any mailbox selection. The first 30 stored messages appear immediately; scroll to load more, or use search and filters. Archived mailboxes and messages in Trash are excluded. To browse a specific mailbox, select it in **Saved mailboxes**, or enter its name in the compact field and choose **Add**. Use **Clear** to return to Recent messages. Opening a recent message and reloading the page keeps the recent view without selecting its mailbox. The mailbox does not have to exist yet. Mailboxes you have opened are saved in that panel, where you can select several and archive the ones you are done with. Bulk actions that have nothing to change are disabled. The selected mailbox checkboxes survive immediate and repeated reloads; names that are no longer available are removed without clearing the remaining selection. Permanent mailbox deletion is available only after archiving. Saved mailboxes and Filter each have a visible close button; it or Escape closes the panel and returns focus to its trigger. Use **Search messages** to search the stored summaries by subject, sender, recipient, mailbox, or date. Open **Filter** to show read or unread messages, choose an inclusive **From** or **To** date or both, and sort the results by newest, oldest, largest, or smallest. **Clear dates** removes both date boundaries. The toolbar count is the total number of matching stored messages and does not grow as additional pages load. The list footer shows how many matching messages are currently loaded. Changing the selected mailboxes or a filter returns the list to the top. Scrolling down to its end loads one more page and another page waits for another downward list scroll. Keeping Saved mailboxes open does not continue pagination. If that request fails, the messages already visible remain available and **Load more messages** lets you retry. Before you open a message, the list uses the full workspace width and shows its sender, subject prefixed by the first tag and remaining tag count, mailbox, and date in compact columns on larger screens. On phones, the current username opens an account menu for Rules, Archived, Trash, and sign out beside **Inbucket**, and the empty message workspace fills the available height without outer whitespace. The menu closes after choosing an action, clicking elsewhere, or pressing Escape. Use **Show mailbox controls** when you need the collapsed mailbox toolbar. The list runs edge to edge and each compact row shows the subject above the sender, with the unread dot above its star. Messages received today show their local time, such as **3:25 PM**; older messages show the day and abbreviated month, such as **5 Aug**. Trash fills the available workspace height and keeps **Empty trash** compact. Archived mailboxes use a responsive card grid with compact Restore and Delete mailbox actions. Opening a message hides the list and gives the reader the full workspace width. Attachments appear as separate download cards with their type and size. Use **Back to message list** in the message action bar to close the reader, restore the list, and return keyboard focus to its heading.

The browser address follows the active view. Reloading it, copying it, or using the browser's Back and Forward controls restores Mailboxes, Starred, Archived, Trash, or Rules instead of reopening a message from another view. Mailboxes, Starred, and Trash addresses also restore their own selected message when one is open. Old Monitor and Notifications addresses safely open their replacement views.

The **Starred** tab collects messages you starred across every mailbox. It has the same search, read and unread filters, inclusive date range, sorting choices, and **All tags** control as Mailboxes, plus a mailbox filter that defaults to **All mailboxes**.

Use **Move to trash** to hide a message from Mailboxes and Starred without deleting it from Inbucket, changing its read state, or removing its star. The **Trash** tab shows trashed messages from every mailbox. You can search them, filter by read state or mailbox, and sort by newest, oldest, largest, or smallest. The compact **Empty trash** action sits beside those controls instead of repeating the Trash heading. **Restore** returns an available message to Mailboxes and Starred with its star intact. **Delete permanently** asks for confirmation and deletes the upstream message. **Empty trash** also asks for confirmation, reports one result for every message, and keeps failed messages so you can retry. If retention or another client deleted a trashed message first, Trash labels it unavailable until its bounded local summary expires.

The Mailboxes list updates automatically when messages arrive or are deleted. **Live all active mailboxes** is enabled by default, so new arrivals from every active mailbox appear without loading that mailbox's older messages. Mailbox checks do not replay older messages through the live feed, and changes to messages outside the loaded pages do not add those rows to the visible list. Recent messages always follows all active mailboxes, so its live checkbox stays checked until you select a mailbox. With mailboxes selected, uncheck it to limit new arrivals to that selection. A newly discovered active mailbox is added to Saved mailboxes. When you are browsing selected mailboxes, it is checked without clearing your selection. In Recent messages, it stays unchecked and its new messages appear automatically. An archived mailbox stays archived. Live changes keep the current message, search, filters, sorting, loaded pages, scroll position, and keyboard focus in place. If updates are temporarily unavailable, current messages remain visible while the client retries.

Unread messages have a blue dot and stronger subject text. Opening a message records it as read in Inbucket, while the blue left border continues to identify the message currently selected. The state is shared with other interfaces using Inbucket's API, retained across browser sessions, and included in backups.

Use the star beside a message or in the selected-message header to add or remove it from **Starred**. Stars belong to the signed-in user, persist across browser sessions, and are included in backups. Moving a message to Trash keeps its star. Permanently deleting a message or purging an archived mailbox removes every user's star for that message.

Use **Tag message** in the selected-message action bar to apply several reusable tags. **Create tag** provides ten named color presets and a labeled browser color picker with a live preview. **Manage tags** lets you rename, recolor, or confirm deletion of your tags. Each compact neutral badge places the tag color swatch beside its name. Mailboxes and Starred show the first tag plus a `+N` count, while the reader shows every assigned tag. Tags belong to the signed-in user, persist across browser and service restarts, and are included in backups. Use **All tags** in Mailboxes or Starred to show only messages with one persisted assignment. Removing an assignment keeps the reusable tag. Deleting a message or purging its mailbox removes its assignments without deleting tag definitions.

### Rules

Open **Rules** from the username menu to automate matching messages. The three-step editor first names the rule and explains that cooldown is the minimum time between runs, then collects match conditions, and finally selects one or more actions. A rule can limit itself by one or more known mailboxes, tokenized sender and recipient values, subject text, byte size, attachment presence, your tags, and weekly UTC time windows. Leaving the mailbox list empty matches all mailboxes. Actions can send a notification, star the message, mark it as read, apply one or more existing tags, or move it to the signed-in user's Trash. Move to Trash is reversible and keeps the upstream message, its read state, and its star. Permanent deletion remains a confirmed manual action in Trash. The notification action can use the in-app center, browser notifications, and any combination of named delivery destinations. The recent-metadata preview shows matching subject, sender, recipients, time, size, mailbox, and message identity before saving. Inbucket uses a package-managed rule event bridge, so saving a rule takes effect without restarting incoming mail. Executable bridge source is not displayed or editable in the browser. Before Inbucket starts, the service checks the generated Lua syntax before replacing its saved hook, and a failed check retains the previous hook while Rules shows a generic warning.

A named destination can contain Email, ntfy, Webhook, or any combination of those methods. Saved destinations are collapsed by default. Expand one to review its methods, endpoint summary, and safe test payload, or to send a real test through each configured method. A custom Webhook body is never displayed in the saved-destination preview. Email recipients are the addresses you explicitly configure in the destination. ntfy accepts an HTTP or HTTPS server and topic. Webhook accepts POST, PUT, PATCH, or DELETE, custom headers, and an optional request body. When you create another destination, the editor prefills the ntfy host and Webhook URL from the most recently updated saved destination of each type. Topics, request methods, headers, bodies, and recipients are not copied. Inbucket never takes a delivery address from a message header. Outbound requests have bounded timeouts and contain a safe notification summary, not the original message body, raw source, or attachments. Cooldown is the minimum number of seconds after a rule runs before it may run again; matching messages during that period are skipped, and 0 allows every match. Priority controls how rules are ordered in the list, with higher numbers first; it does not prevent lower-priority rules from running. The Match messages step groups optional conditions into collapsible sections, and Preview matches opens a dismissible dialog with recent matching message metadata. One durable record per rule, message, destination, and delivery method prevents duplicate notifications. Disabling or deleting a rule stops pending and retrying deliveries. Deleting a destination safely disables its queued deliveries and removes it from affected rules. A rule is disabled when that destination was its only action. The bell beside the username shows the unread count and opens the notification history from every view. Inside it you can enable browser notifications, mark records read, retry eligible outbound deliveries, clear records, or refresh the list. The bell and account menus close when you click elsewhere or press Escape. A generic Rule needs attention state keeps rule-processing failures visible without exposing message content or destination secrets. Browser permission is requested only after you select **Enable browser notifications**.

The private client keeps bounded message summaries, per-user stars and Trash links, tag definitions, and tag assignments in its database so mailbox pagination, Starred, and Trash can share the same message state without storing message bodies or attachments twice. New arrivals and deletions update that index through the live monitor. The Mailboxes list reads bounded changes from the index without repeatedly scanning complete mailboxes. Saved mailboxes are checked when the service starts, when selected, and every 24 hours. If Inbucket is temporarily unavailable, the previous summaries and user metadata remain until a later successful check. Trashed messages are hidden from Mailboxes and Starred only for the user who moved them. Deleted or otherwise unavailable messages are not shown in Mailboxes or Starred. Historical mailboxes that have never been opened in the private client are discovered only when you open them or when a new message arrives.

The **Archived** view reports when its catalog is loading, when mailbox counts are unavailable, and when an action fails. Restoring returns a mailbox to the active list without deleting messages. **Delete mailbox** permanently purges an archived mailbox and all its messages after confirmation.

Opening a message shows the sanitized HTML body with its supported layout and styles, or the plain text if there is no HTML body. Remote images are blocked by default. Use **Load remote images** when you trust the sender and want to retrieve them. Images carried inside the message are shown without that approval. **View source** shows the raw message, and attachments download rather than open in the browser.

### Actions

- **Configure Inbucket** — changes the accepted domain (see **Choosing a domain**), how long messages are kept, how many each mailbox holds, and the maximum accepted SMTP message size. Choose **Forever** to disable automatic expiration, or enter `0` messages per mailbox for no per-mailbox limit. Either unlimited setting can fill the data volume. The message-size limit remains finite, accepts 1 to 100 MiB, and defaults to 50 MiB. The form shows your current settings, and saving restarts Inbucket. Mailboxes collected under a previous domain keep their names and stay readable, new mail for that domain is rejected, lowering a storage limit deletes stored messages that no longer fit, and lowering the message-size limit rejects future messages above it.
- **Configure SMTP** — chooses disabled email delivery, StartOS system SMTP, or custom SMTP credentials for notification email. SMTP credentials remain inside the service and never appear in a rule, browser page, generated Lua, or delivery record. Custom SMTP supports TLS and STARTTLS. Saving restarts the service. Queued emails retry with backoff after temporary failures, while disabled or invalid delivery remains visible in Rules without affecting incoming mail.
- **Set Admin Password** — generates a new password for the Web Client Interface and shows it once. Run it again whenever you want a fresh password or have lost the one you had. Saving restarts Inbucket, and once it is back the old password no longer works and everyone signed in has been signed out.

## Limitations

Inbucket receives mail and can send separate notification summaries through optional SMTP. It cannot reply to, forward, or resend a received message.

Mail arrives over plain SMTP with no encryption in transit, which is normal for a disposable-mail server but worth knowing before you send anything sensitive to it.
