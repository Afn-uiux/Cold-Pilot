# Coldpilot — Campaigns (sequences)

A campaign is a structured sequence of cold emails you send to a list of leads.
The first email is initial outreach; each following email is a follow-up that
continues the same thread.

## Building a campaign

- **Steps** — each step is an email (subject + body) in the sequence. The first
  step has a subject; follow-ups continue the thread (they don't need a new
  subject).
- **Personalization** — use variable tags like `{{firstName}}`, `{{company}}`,
  `{{title}}`, `{{website}}`, `{{location}}` and any custom fields you imported.
  Coldpilot fills them in per lead.
- **AI writing** — generate a full sequence with AI based on your company,
  offer, target audience, and case studies (on paid plans / during trial /
  pay-as-you-go). AI keeps emails short, plain, and spam-free.

## Scheduling

- You can schedule **when** sending happens — a daily window (e.g. business
  hours) and can also set a start date.
- Outside the schedule, the campaign waits; Coldpilot only sends inside the
  window.

## Sending limits

- Each campaign sends through your chosen connected inboxes.
- Every inbox has a **daily send limit** you control; Coldpilot respects it and
  spreads volume across selected inboxes (rotation).
- If you run out of credits, the campaign **pauses automatically** and resumes
  when you top up.

## Auto-pause & resume

- Campaigns pause when credits run out and **resume automatically** after a
  credit purchase or plan grant — no manual restart needed.
- You can also pause/resume/stop a campaign manually at any time.

## Deliverability protection

- Coldpilot scans outgoing emails for **spam-trigger language** (free,
  guarantee, 100%, act now, urgent, ALL-CAPS, excessive exclamation marks, etc.)
  before they go out.
- Risky or unverified leads are handled per your settings (verify before send,
  or skip unless you opted in to risky sends).

## Tracking & completion

- Coldpilot tracks opens (when enabled), clicks, replies, and bounces per step.
- When every lead has finished their final step, the campaign is marked
  **completed** and you get a completion report with real numbers.

## Personalization engine

- `{{RANDOM | option1 | option2 | option3}}` groups make a single step generate
  many variations so each lead gets a slightly different email (better
  deliverability, less "template-y"). This is called spintax.
- Nested/weighted `{...}` groups are also supported.
- Any variable tag you use that exists on a lead resolves by name — including
  imported custom fields.
