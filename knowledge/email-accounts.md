# Coldpilot — Connecting and managing email accounts (inboxes)

Email accounts (inboxes) are the real mailboxes Coldpilot sends from. You
connect your own Gmail or Outlook mailboxes.

## Connecting

- Go to **Email Accounts** in your dashboard and connect a Gmail or Outlook
  mailbox.
- You can connect via Google/Outlook OAuth (the recommended, most reliable
  route) or with SMTP/IMAP credentials (for setups that need them).
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
