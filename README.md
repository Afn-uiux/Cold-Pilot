# Coldpilot

All-in-one sales outreach platform designed to help businesses find leads and automate cold email campaigns at scale. It combines lead generation, campaign management, and AI-powered tools for businesses running high-volume outbound sales.

## What it does

Coldpilot handles the full outbound workflow — from finding and verifying leads to sending personalized sequences and tracking what works.

### Lead generation & management

- **Lead import** — Upload CSVs or add leads manually. Coldpilot deduplicates automatically and validates emails on import.
- **Email verification** — Multi-layer verification catches bad emails before you send: disposable domain detection (129,000+ known domains), typosquat detection for common misspellings, DNS MX validation, and SMTP-level checks.
- **Domain reputation** — Track sender reputation per domain. Get alerts when bounce rates climb or reputation drops.
- **CRM basics** — Manage leads with tags, notes, and deal tracking. No need for a separate tool when you're getting started.

### Campaign automation

- **Multi-step sequences** — Build multi-step campaigns with personalized subject lines and body text using custom fields (first name, company, etc.).
- **A/B testing** — Test subject lines and body variants to find what converts.
- **Smart scheduling** — Set send windows, timezones, and daily limits. Coldpilot spaces sends with natural delays so your patterns look human.
- **Multi-inbox rotation** — Connect unlimited email accounts. Sends rotate across all of them so no single address carries the volume — or the risk.
- **Stop on reply** — The moment a lead replies, books, or bounces, their sequence stops. No awkward follow-up.

### Deliverability infrastructure

- **Inbox warm-up** — New inboxes send a slow, human-looking pattern so mailbox providers learn to trust the address before your campaign starts.
- **Spam-score checks** — A deliverability monitor runs before every send, catching flagged domains or spammy subject lines before your leads see them.
- **Bounce protection** — Automatic bounce tracking with configurable thresholds. Campaigns pause before your sender reputation takes damage.
- **Custom tracking domains** — Use your own domain for open and click tracking instead of a shared third-party pixel.

### Analytics & reporting

- **Campaign analytics** — Opens, replies, bounces, and conversions on one screen.
- **Real-time monitoring** — Watch sends happen live. See which inboxes are performing, which steps convert, and where leads drop off.
- **Weekly & monthly digests** — Automated summary emails keep you updated without logging in.

### AI-powered features

- **AI email generation** — Generate subject lines and body copy from a brief description of your offer.
- **AI warm-up content** — Warm-up messages use AI-generated, unique content so no two emails look the same.
- **AI health monitoring** — Smart detection of warm-up issues with automated recommendations.

### Transactional email

- **27 built-in templates** — Welcome emails, billing notifications, campaign alerts, weekly digests, and more — all with a consistent, professional design.
- **Admin preview** — Preview and test all transactional emails before they go live.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | React 19, Tailwind CSS 4 |
| Database | SQLite (dev) / PostgreSQL (prod) via Prisma |
| Auth | NextAuth v5 (credentials + OAuth) |
| Email | Nodemailer (SMTP), ImapFlow (IMAP), Google APIs (Gmail OAuth) |
| Queue | BullMQ + Redis |
| AI | OpenAI for email generation and warm-up content |
| Fonts | Geist Sans, Geist Mono, Instrument Serif |

## Getting started

### Prerequisites

- Node.js 20+
- npm or yarn
- Redis (for queue processing, optional in dev)

### Setup

```bash
# Clone
git clone https://github.com/Afn-uiux/Cold-Pilot.git
cd Cold-Pilot

# Install dependencies
npm install

# Set up environment
cp .env.example .env   # then fill in your values

# Run database migrations
npx prisma migrate dev

# Seed the database (optional)
npx prisma db seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production

```bash
npx next build
npx next start
```

Or with PM2:

```bash
npx next build
pm2 start ecosystem.config.cjs
```

## Environment variables

```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"

# Google OAuth (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# SMTP (for sending emails)
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""

# IMAP (for reply detection)
IMAP_HOST=""
IMAP_PORT="993"
IMAP_USER=""
IMAP_PASS=""

# Redis (for BullMQ queues)
REDIS_URL="redis://localhost:6379"

# OpenAI (for AI features)
OPENAI_API_KEY=""
```

## Project structure

```
coldpilot/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
├── src/
│   ├── app/                   # Next.js App Router pages
│   │   ├── actions/           # Server actions (auth)
│   │   ├── api/               # API routes
│   │   ├── auth/              # Auth pages (login, signup, verify)
│   │   ├── dashboard/         # Dashboard pages
│   │   │   ├── leads/         # Lead management
│   │   │   ├── campaigns/     # Campaign builder & analytics
│   │   │   ├── email-accounts/ # Email account management
│   │   │   ├── templates/     # Email templates
│   │   │   ├── warmup/        # Warmup dashboard
│   │   │   └── settings/      # User settings
│   │   ├── admin/             # Admin pages (email previews)
│   │   └── legal/             # Privacy & terms
│   ├── components/            # React components
│   │   ├── auth/              # Auth UI components
│   │   ├── dashboard/         # Dashboard UI components
│   │   └── email-*/           # Email-related components
│   ├── engine/                # Core sending engine
│   │   ├── campaign.ts        # Campaign execution
│   │   ├── send.ts            # SMTP sending
│   │   └── warmup/            # Warmup system
│   ├── lib/                   # Shared libraries
│   │   ├── email/             # Email templates & sending
│   │   ├── verify.ts          # Email verification
│   │   ├── disposable.ts      # Disposable domain list (129k+)
│   │   ├── typosquat.ts       # Typosquat detection
│   │   └── send-gate.ts       # Rate limiting
│   └── workers.ts             # Background job workers
├── start.js                   # PM2 start wrapper
└── ecosystem.config.cjs       # PM2 config
```

## Pricing

Coldpilot is free to start. Connect your inboxes, send your first sequence, and scale when you're ready.

## License

Proprietary. All rights reserved.

## Built by

[Too Design](mailto:hello@coldpilot.io) — built for the inbox, not the spam folder.
