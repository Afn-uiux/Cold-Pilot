# ColdPilot — Inbox warmup

Inbox warmup is ColdPilot's way of building a connected mailbox's sender
reputation gradually, so your real cold emails land in the main folder instead
of spam.

## Why warmup matters

- New or low-volume sending inboxes have little reputation with mail providers.
- Without warmup, cold emails are far more likely to be filtered to spam.
- Warmup builds the mailbox's trust by sending and receiving a modest, growing
  volume of mail between real accounts.

## How it works

- Warmup is **enabled by default** for newly connected Gmail accounts.
- Every connected inbox has warmup settings you can tune:
  - **Warmup base** — starting daily volume.
  - **Warmup increase** — how much volume ramps up per day.
  - **Warmup max** — the ceiling it grows toward.
  - **Warmup days** — how long the warmup plan runs.
  - **Start/end time** — a custom active window, if you want one.
- Volume ramps up **gradually** (never all at once) toward the target, with
  safe day-to-day pacing.
- A warmup day starts each morning at **09:00** and that day's sends spread
  naturally across the following 24 hours, so activity looks like real human
  use of the mailbox.

## How the timing looks

- **Send times are randomized daily.** Each day the inbox gets a fresh set of
  send times, so no two days look the same. At a low daily volume the sends are
  many hours apart; at a higher daily volume they're more frequent but still
  spread out.
- Sends are spaced out with **natural-looking gaps** — like a real person
  checking and writing email — never a burst of sends at the same moment.
- Warmup won't fire alongside other sending from the same mailbox: it stays
  spaced away from your campaign sends too, so the mailbox's activity stays
  even and human.

## What warmup monitors

- **Health score** per inbox (0–100).
- **Reply rate** target (warmup can emulate the realistic chance of a reply).
- **Open rate**, **spam protection**, and marked-important settings.
- If an inbox's health drops, warmup adjusts and you may see a health warning.

## Pausing / stopping

- You can pause warmup on any inbox at any time.
- If an inbox is connected but warmup is off, it won't generate warmup traffic
  — it just waits for real campaign sends.

## What warmup is NOT

- Warmup is not the same as sending your campaign. Warmup is background
  reputation building; campaigns are your actual outreach. Run both: warm the
  inbox, then send campaigns through it.

## Getting the best results

- Connect each inbox you plan to send from.
- Keep warmup enabled for at least a week or two before heavy sending.
- Keep your real bounce rate low (verify leads) so it doesn't fight the warmup.