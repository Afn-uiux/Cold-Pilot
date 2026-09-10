# Coldpilot — Connecting and managing email accounts (inboxes)

Email accounts (inboxes) are the real mailboxes Coldpilot sends from. You
connect mailboxes from a wide range of providers — not just Gmail and Outlook.

## Connecting

- Go to **Email Accounts** in your dashboard and connect a mailbox.
- **Gmail and Microsoft (Outlook/Hotmail)** can be connected with one-click
  OAuth — that's the smoothest route for those two providers, and it's why you
  see those buttons.
- **Every other provider works too** — Yahoo, Zoho, iCloud, Proton (via the
  app with a bridge), and any custom-domain mailbox (your own domain's email
  host). Connect these with SMTP/IMAP credentials:
  - Incoming (IMAP) server, port 993
  - Outgoing (SMTP) server and port (usually 465 or 587)
  - Your mailbox email and an app password
- Use an **app-specific password** (not your regular login password) for
  providers that require one, such as Yahoo and Gmail. Enable IMAP access on
  the provider if it isn't already on.
- **How to get a Google app password, briefly:** turn on 2-Step Verification first at myaccount.google.com/security (required). Then open myaccount.google.com/apppasswords, type any label in the box (e.g. Mail) and click Create, then copy the 16-character code from the yellow box and paste it into Coldpilot (spaces are fine). Always use the app password, never your regular Gmail login password.
- Your credentials are **encrypted at rest** and never exposed to the browser
  after connect — only safe, non-secret fields come back to the client.

## Limits by plan

- **Free**: up to 2 connected inboxes.
- **Starter / Pro / Agency**: unlimited inboxes.
- If you hit your limit you'll be asked to upgrade to connect more.

## How Coldpilot picks the sender

- When you launch a campaign you choose which connected inboxes to send from.
- You can spread a campaign across multiple inboxes ("rotation") to keep volume
  per inbox manageable and protect reputation.
- Each inbox has a **daily send limit** you can set; Coldpilot respects it.

## Disconnecting

- When you disconnect an inbox it is **soft-deleted** (kept for history) and
  stops sending immediately.
- **Important:** a mailbox is permanently fingerprinted. Once one account
  connects a given mailbox, another account can't reconnect the same mailbox to
  start a fresh trial — this prevents trial abuse.

## Health & reputation

- Each inbox has a **health score** (0–100) and a **health state** (healthy /
  warning / critical / etc.).
- If an inbox's health drops (e.g. high bounce rate), Coldpilot may pause it
  automatically and flag it for attention in the dashboard.
- Keep bounce rates low by verifying leads before sending and using warmup.

## Warmup on accounts

- Accounts can have **warmup enabled** so Coldpilot gradually builds sender
  reputation (see the warmup doc). Warmup is on by default for Gmail accounts.