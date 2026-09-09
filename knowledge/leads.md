# Coldpilot — Leads: import, verification, and suppressions

Leads are the contacts you email. Coldpilot imports, dedupes, verifies, and
tracks leads so you only send to real addresses.

## Importing leads

- Import via **CSV upload** or add leads **manually**.
- Leads can live in a **CRM / pipeline** and be **tagged** with custom fields
  for personalization.
- Importing a lead costs **0.05 credits** per lead.
- **Plan lead limits:**
  - Free: 300 total leads
  - Starter: 5,000
  - Pro: 30,000
  - Agency: 150,000
  - Pay-as-you-go (free user with purchased credits): **unlimited** — the
    credit cost of importing is the only throttle.

## Important: lead limits are permanent

- Your lead count counts **every lead ever created, including deleted ones**.
- Deleting leads is data cleanup, **not** a limit reset — the capacity you used
  stays used. This prevents delete-and-reimport tricks.

## Deduplication

- Coldpilot deduplicates automatically on import, so the same contact isn't
  added twice.

## Verification

- Every email address is checked before sending, using multiple layers:
  **disposable-domain detection**, **typosquat detection**, **DNS checks**, and
  **SMTP-level verification**.
- Verifying one lead costs **0.25 credits**.
- Each lead gets a verification status:
  - **Valid** — safe to send to.
  - **Invalid** — hard-bad; Coldpilot won't send to these.
  - **Risky** — uncertain; sent only if you opted in to risky sends.
  - **Unknown / flagged** — not confirmable; treated conservatively.

## Send-time policy

- Only a definitive **invalid** address is ever blocked outright.
- Risky sends are gated behind your **enable risky emails** opt-in.
- Unknown / catch-all addresses are allowed through (soft) so your sequence
  isn't throttled by over-eager verification.

## Bounces

- When a send bounces, Coldpilot records the **bounce type** (hard / soft /
  connection / auth / suppressed) and links it to the lead.
- Repeated hard bounces on an inbox hurt its health score and may auto-pause it.

## Suppressions

- **Suppressed** contacts are excluded from sends.
- Adds a permanent suppression list entry (reason + type) for the lead, so that
  address is never emailed again.
- Unsubscribes and bounce-driven suppressions are handled here too.

## Where to see it

- **Leads** tab: your full list with verification status and filters.
- **CRM / pipeline**: organize leads toward a deal.
- **Suppressions**: everything currently suppressed with reasons.
- **Analytics**: valid vs invalid breakdown and activity per step.