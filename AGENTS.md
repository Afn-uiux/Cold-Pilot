<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Session Recap (Jul 8 2026)

## Changes Made
- **Open & Link Tracking**: Replaced 3-way pill group with two independent toggle switches — no mutual exclusion
- **Accounts dropdown**: Changed from inline checkboxes to dropdown multi-select with border field, click-outside-to-close, shows count when collapsed
- **Slow Ramp toggle**: Added UI toggle after Daily Limit, saves `slowRamp` + `rampStart`
- **Pro badge**: Removed from "Send first email as text-only"
- **Stop on Reply toggle**: Simplified to bare ToggleBtn without Disable/Enable labels
- **Subsequences tab**: Removed entirely
- **Tab buttons**: Changed from ink to blue-accent palette
- **Hover states**: All `hover:text-ink` → `hover:text-blue-accent` and `hover:border-ink` → `hover:border-blue-accent` across all dashboard files
- **AB fields removed from schema**: `autoOptimizeAB`, `abWinningMetric` from Campaign; `variantB_subject`, `variantB_bodyHtml` from CampaignStep

## Pending (User Action)
- **Billing**: Sign up at lemonsqueezy.com, create products/tiers, get API key + webhook endpoint. Then I'll build: subscription UI, checkout flow, webhooks, feature gating.

## Wiring Confirmed
- All OptionsTab fields properly round-trip: load ↔ save ↔ PATCH handler ↔ Prisma
- All analytics subtabs (Step Analytics, Activity, Bounces, Suppressed) wired to stats/suppressions API
- ScheduleTab date/schedules upsert in PATCH handler works
- Sequences tab steps save/load, AI, templates, test send all functional
